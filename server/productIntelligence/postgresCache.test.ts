import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresResearchCache, type SqlExecutor } from "./postgresCache";
import { enrichProduct, type ResearchProvider, type ResearchResult } from "./research";
import { createSuperCatalogCard } from "./superCatalog";

test("Postgres cache reuses a researched Master without further provider calls", async () => {
  let stored: ResearchResult | undefined;
  const calls: string[] = [];
  const executor: SqlExecutor = {
    async query(sql, params) {
      calls.push(sql.startsWith("SELECT") ? "read" : "write");
      if (sql.startsWith("SELECT")) return { rows: stored ? [{ result: stored }] : [] };
      assert.match(sql, /ON CONFLICT/);
      assert.match(sql, /RETURNING super_hash/);
      stored = JSON.parse(String(params[2]));
      return { rows: [{ super_hash: params[0] }] };
    },
  };
  const provider: ResearchProvider = {
    async search() {
      calls.push("search");
      return [{ url: "https://example.org/spec", title: "Specs", snippet: "", sourceType: "RETAILER" }];
    },
    async extract(_, hit) {
      calls.push("extract");
      return [{ field: "cabedal", value: "Mesh", sourceUrl: hit.url, sourceType: hit.sourceType, observedAt: "2026-11-09" }];
    },
  };
  const identity = { masterId: "master-1", brand: "Adidas", model: "Adios Pro 4" };
  const cache = createPostgresResearchCache(executor);
  const first = await enrichProduct(identity, provider, cache);
  const second = await enrichProduct(identity, provider, cache);

  assert.equal(first.state, "ENRICHED");
  assert.deepEqual(second, { ...first, queried: false });
  assert.deepEqual(calls, ["read", "search", "extract", "write", "read"]);
});

test("Postgres cache refreshes expired records and rejects a guarded update with no returned row", async () => {
  const card = createSuperCatalogCard({ masterId: "master-1", brand: "Test", model: "Test" });
  const result: ResearchResult = { card, state: "ENRICHED", queried: true, warnings: [] };
  const cache = createPostgresResearchCache({
    async query(sql, params) {
      assert.equal(params[0], card.superHash);
      if (sql.startsWith("SELECT")) {
        assert.match(sql, /expires_at IS NULL OR expires_at > NOW\(\)/);
      } else {
        assert.match(sql, /WHEN product_intelligence_cache\.expires_at <= NOW\(\) THEN EXCLUDED\.expires_at/);
        assert.match(sql, /WHERE product_intelligence_cache\.master_id = EXCLUDED\.master_id/);
      }
      return { rows: [] };
    },
  });

  assert.equal(await cache.get(card.superHash), null);
  await assert.rejects(cache.set(card.superHash, result), /CACHE_MASTER_ID_MISMATCH/);
});

test("Postgres cache refuses unsafe keys", async () => {
  const executor: SqlExecutor = { query: async () => { throw Error("Must not query"); } };
  await assert.rejects(createPostgresResearchCache(executor).get("../bad"), /INVALID_CACHE_KEY/);
});
