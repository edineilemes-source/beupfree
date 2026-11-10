import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresResearchCache, type SqlExecutor } from "./postgresCache";
import { enrichProduct, type ResearchProvider } from "./research";

test("Postgres cache reuses a researched Master without further API calls", async () => {
  const rows = new Map<string, unknown>();
  const queries: string[] = [];
  const executor: SqlExecutor = { async query(sql, params) {
    queries.push(sql);
    if (sql.startsWith("SELECT")) return { rows: rows.has(String(params[0])) ? [{ result: rows.get(String(params[0])) }] : [] };
    if (sql.startsWith("INSERT")) { rows.set(String(params[0]), JSON.parse(String(params[2]))); return { rows: [] }; }
    throw Error("Unexpected SQL");
  }};
  let calls = 0;
  const provider: ResearchProvider = {
    search: async () => { calls++; return [{ url: "https://example.org/spec", title: "Specs", snippet: "", sourceType: "RETAILER" }]; },
    extract: async (_, hit) => [{ field: "cabedal", value: "Mesh", sourceUrl: hit.url, sourceType: hit.sourceType, observedAt: "2026-11-09" }],
  };
  const identity = { masterId: "master-1", brand: "Adidas", model: "Adios Pro 4" };
  const first = await enrichProduct(identity, provider, createPostgresResearchCache(executor));
  const second = await enrichProduct(identity, provider, createPostgresResearchCache(executor));
  assert.equal(first.state, "ENRICHED");
  assert.equal(second.queried, false);
  assert.equal(calls, 1);
  assert.ok(queries.some(sql => sql.includes("ON CONFLICT")));
});
test("Postgres cache refuses unsafe keys", async () => {
  const executor: SqlExecutor = { query: async () => { throw Error("Must not query"); } };
  await assert.rejects(createPostgresResearchCache(executor).get("../bad"), /INVALID_CACHE_KEY/);
});
