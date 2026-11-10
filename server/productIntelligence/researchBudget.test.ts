import test from "node:test";
import assert from "node:assert/strict";
import { createResearchBudget } from "./researchBudget";
import type { SqlExecutor } from "./postgresCache";

const policy = {
  RESEARCH_PAID_ENABLED: "true",
  RESEARCH_POSTGRES_HOMOLOGATED: "true",
  RESEARCH_BUDGET_PERIOD_SECONDS: "60",
  RESEARCH_BUDGET_USD: "0.025",
  RESEARCH_TAVILY_MAX_CALLS: "2",
  RESEARCH_OPENAI_MAX_CALLS: "3",
  RESEARCH_TAVILY_ESTIMATED_USD: "0.005",
  RESEARCH_OPENAI_ESTIMATED_USD: "0.010",
};

test("shared atomic reservations cap ten simultaneous calls and track each operation", async () => {
  let tavily = 0;
  let openai = 0;
  let reserved = 0;
  const executor: SqlExecutor = {
    async query(sql, params) {
      assert.match(sql, /ON CONFLICT \(singleton\) DO UPDATE/);
      assert.match(sql, /budget.policy = EXCLUDED.policy/);
      const [, , tavilyDelta, openaiDelta, cost, tavilyLimit, openaiLimit, usdLimit] = params as number[];
      if (tavily + tavilyDelta > tavilyLimit || openai + openaiDelta > openaiLimit || reserved + cost > usdLimit) return { rows: [] };
      tavily += tavilyDelta;
      openai += openaiDelta;
      reserved += cost;
      return { rows: [{ singleton: true }] };
    },
  };
  const first = createResearchBudget(executor, policy);
  const second = createResearchBudget(executor, policy);
  const requests = await Promise.allSettled(Array.from({ length: 10 }, (_, i) =>
    (i % 2 ? first : second).reserve(i < 5 ? "tavily" : "openai"),
  ));
  assert.equal(requests.filter(result => result.status === "fulfilled").length, 3);
  assert.deepEqual([tavily, openai, reserved], [2, 1, 20_000]);
  await assert.rejects(second.reserve("openai"), /RESEARCH_BUDGET_EXHAUSTED/);
});

test("budget fails closed for missing opt-in, invalid configuration and unavailable storage", async () => {
  const executor = { query: async () => { throw Error("private DB error"); } };
  await assert.rejects(createResearchBudget(executor, {}).reserve("tavily"), /RESEARCH_PAID_DISABLED/);
  await assert.rejects(createResearchBudget(executor, { ...policy, RESEARCH_POSTGRES_HOMOLOGATED: "" }).reserve("openai"), /RESEARCH_PAID_DISABLED/);
  await assert.rejects(createResearchBudget(executor, { ...policy, RESEARCH_BUDGET_USD: "Infinity" }).reserve("openai"), /RESEARCH_BUDGET_INVALID/);
  await assert.rejects(createResearchBudget(executor, policy).reserve("openai"), /RESEARCH_BUDGET_UNAVAILABLE/);
});
