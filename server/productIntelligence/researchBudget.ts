import type { SqlExecutor } from "./postgresCache";

export type ResearchOperation = "tavily" | "openai";
export type ResearchBudget = { reserve(operation: ResearchOperation): Promise<void> };

function positiveInteger(value: string | undefined) {
  const number = /^\d+$/.test(value ?? "") ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function microUsd(value: string | undefined) {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(value ?? "");
  return match ? positiveInteger(match[1] + (match[2] ?? "").padEnd(6, "0")) : null;
}

export function createResearchBudget(
  executor: SqlExecutor,
  env: NodeJS.ProcessEnv = process.env,
): ResearchBudget {
  const enabled = env.RESEARCH_PAID_ENABLED === "true" && env.RESEARCH_POSTGRES_HOMOLOGATED === "true";
  const period = positiveInteger(env.RESEARCH_BUDGET_PERIOD_SECONDS);
  const limit = microUsd(env.RESEARCH_BUDGET_USD);
  const tavilyLimit = positiveInteger(env.RESEARCH_TAVILY_MAX_CALLS);
  const openaiLimit = positiveInteger(env.RESEARCH_OPENAI_MAX_CALLS);
  const tavilyCost = microUsd(env.RESEARCH_TAVILY_ESTIMATED_USD);
  const openaiCost = microUsd(env.RESEARCH_OPENAI_ESTIMATED_USD);

  return {
    async reserve(operation) {
      if (!enabled) throw new Error("RESEARCH_PAID_DISABLED");
      if (!period || period > 2147483647 || !limit || !tavilyLimit || !openaiLimit || !tavilyCost || !openaiCost) {
        throw new Error("RESEARCH_BUDGET_INVALID");
      }
      if (operation !== "tavily" && operation !== "openai") throw new Error("RESEARCH_BUDGET_INVALID");
      const tavily = operation === "tavily" ? 1 : 0;
      const openai = operation === "openai" ? 1 : 0;
      const cost = tavily ? tavilyCost : openaiCost;
      if (cost > limit) throw new Error("RESEARCH_BUDGET_EXHAUSTED");
      // The singleton row serializes reservations across processes. A different
      // policy cannot replace an active window or reset its counters.
      const policy = JSON.stringify({ period, limit, tavilyLimit, openaiLimit, tavilyCost, openaiCost });
      let reserved: boolean;
      try {
        const { rows } = await executor.query(
          `INSERT INTO research_budget AS budget
             (singleton, policy, window_end, tavily_calls, openai_calls, reserved_microusd)
           VALUES (true, $1::jsonb, NOW() + make_interval(secs => $2::integer), $3, $4, $5)
           ON CONFLICT (singleton) DO UPDATE SET
             policy = EXCLUDED.policy,
             window_end = CASE WHEN budget.window_end <= NOW() THEN EXCLUDED.window_end ELSE budget.window_end END,
             tavily_calls = EXCLUDED.tavily_calls + CASE WHEN budget.window_end <= NOW() THEN 0 ELSE budget.tavily_calls END,
             openai_calls = EXCLUDED.openai_calls + CASE WHEN budget.window_end <= NOW() THEN 0 ELSE budget.openai_calls END,
             reserved_microusd = EXCLUDED.reserved_microusd + CASE WHEN budget.window_end <= NOW() THEN 0 ELSE budget.reserved_microusd END
           WHERE budget.window_end <= NOW() OR (
             budget.policy = EXCLUDED.policy
             AND budget.tavily_calls <= $6::bigint - EXCLUDED.tavily_calls
             AND budget.openai_calls <= $7::bigint - EXCLUDED.openai_calls
             AND budget.reserved_microusd <= $8::bigint - EXCLUDED.reserved_microusd
           )
           RETURNING singleton`,
          [policy, period, tavily, openai, cost, tavilyLimit, openaiLimit, limit],
        );
        reserved = rows.length === 1;
      } catch {
        throw new Error("RESEARCH_BUDGET_UNAVAILABLE");
      }
      if (!reserved) throw new Error("RESEARCH_BUDGET_EXHAUSTED");
    },
  };
}
