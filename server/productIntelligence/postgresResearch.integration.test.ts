import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { createPostgresResearchClaim } from "./postgresResearchClaim";
import { createResearchBudget } from "./researchBudget";
import { createSuperCatalogCard } from "./superCatalog";

const config = {
  host: process.env.PGHOST ?? "localhost",
  port: Number(process.env.PGPORT ?? 5432),
  user: process.env.PGUSER ?? "mission10",
  password: process.env.PGPASSWORD ?? "",
  database: process.env.PGDATABASE ?? "mission10_ci",
};
const budgetEnv = {
  RESEARCH_PAID_ENABLED: "true",
  RESEARCH_POSTGRES_HOMOLOGATED: "true",
  RESEARCH_BUDGET_PERIOD_SECONDS: "60",
  RESEARCH_BUDGET_USD: "0.025",
  RESEARCH_TAVILY_MAX_CALLS: "2",
  RESEARCH_OPENAI_MAX_CALLS: "3",
  RESEARCH_TAVILY_ESTIMATED_USD: "0.005",
  RESEARCH_OPENAI_ESTIMATED_USD: "0.010",
};
const executor = (pool: pg.Pool) => ({
  query: async (sql: string, params: readonly unknown[]) => {
    const result = await pool.query(sql, [...params]);
    return { rows: result.rows };
  },
});

test("PostgreSQL real: exclusao entre pools e liberacao do detentor", { skip: process.env.MISSION10_POSTGRES_INTEGRATION !== "true" }, async () => {
  const firstPool = new pg.Pool(config);
  const secondPool = new pg.Pool(config);
  const card = createSuperCatalogCard({ masterId: "test-master", brand: "Test", model: "Concurrent" });
  try {
    const first = createPostgresResearchClaim(executor(firstPool));
    const second = createPostgresResearchClaim(executor(secondPool));
    const release = await first(card);
    assert.ok(release);
    assert.equal(await second(card), null);
    await release!();
    const next = await second(card);
    assert.ok(next);
    await next!();
    const count = await firstPool.query("SELECT count(*)::integer AS n FROM research_claims WHERE super_hash=$1", [card.superHash]);
    assert.equal(count.rows[0].n, 0);
  } finally {
    await Promise.all([firstPool.end(), secondPool.end()]);
  }
});

test("PostgreSQL real: dez reservas concorrentes respeitam teto agregado", { skip: process.env.MISSION10_POSTGRES_INTEGRATION !== "true" }, async () => {
  const firstPool = new pg.Pool(config);
  const secondPool = new pg.Pool(config);
  try {
    const first = createResearchBudget(executor(firstPool), budgetEnv);
    const second = createResearchBudget(executor(secondPool), budgetEnv);
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) =>
      (i % 2 ? first : second).reserve(i < 5 ? "tavily" : "openai"),
    ));
    assert.equal(results.filter(result => result.status === "fulfilled").length, 3);
    const { rows: [row] } = await firstPool.query(
      "SELECT tavily_calls, openai_calls, reserved_microusd FROM research_budget WHERE singleton=true",
    );
    const tavily = Number(row.tavily_calls);
    const openai = Number(row.openai_calls);
    const reserved = Number(row.reserved_microusd);
    assert.ok(tavily <= 2 && openai <= 3);
    assert.equal(tavily + openai, 3);
    assert.equal(reserved, tavily * 5_000 + openai * 10_000);
    assert.ok(reserved <= 25_000);
  } finally {
    await Promise.all([firstPool.end(), secondPool.end()]);
  }
});
