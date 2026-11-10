import test from "node:test";
import assert from "node:assert/strict";
import { createPostgresResearchClaim } from "./postgresResearchClaim";
import { enrichProduct, type ResearchCache, type ResearchProvider, type ResearchResult } from "./research";
import { createSuperCatalogCard } from "./superCatalog";
import type { SqlExecutor } from "./postgresCache";

test("two coordinators sharing claim storage allow one research and reject a Master conflict", async () => {
  const claims = new Map<unknown, { master_id: unknown; owner: unknown }>();
  const executor: SqlExecutor = {
    async query(sql, [key, master, owner]) {
      const existing = claims.get(key);
      if (sql.startsWith("INSERT")) {
        assert.match(sql, /ON CONFLICT \(super_hash\) DO NOTHING/);
        if (existing) return { rows: [] };
        claims.set(key, { master_id: master, owner });
        return { rows: [{ owner }] };
      }
      if (sql.startsWith("SELECT")) return { rows: existing ? [existing] : [] };
      assert.equal(existing?.owner, owner);
      assert.equal(existing?.master_id, master);
      claims.delete(key);
      return { rows: [] };
    },
  };
  const first = createPostgresResearchClaim(executor);
  const second = createPostgresResearchClaim(executor);
  const identity = { masterId: "master-1", brand: "Test", model: "Test" };
  let stored: ResearchResult | null = null;
  const makeCache = (): ResearchCache => ({
    get: async () => stored,
    set: async (_, result) => { stored = result; },
  });
  let searches = 0;
  let started!: () => void;
  let finish!: () => void;
  const startedSearching = new Promise<void>(resolve => { started = resolve; });
  const blocked = new Promise<void>(resolve => { finish = resolve; });
  const provider: ResearchProvider = {
    async search() {
      searches++;
      started();
      await blocked;
      return [{ url: "https://example.org/spec", title: "", snippet: "", sourceType: "RETAILER" }];
    },
    extract: async (_, hit) => [{ field: "cabedal", value: "Mesh", sourceUrl: hit.url, sourceType: hit.sourceType, observedAt: "2026-11-09" }],
  };
  const active = enrichProduct(identity, provider, makeCache(), {}, first);
  await startedSearching;
  try {
    const conflict = { ...createSuperCatalogCard(identity), masterId: "other" };
    await assert.rejects(second(conflict), /CACHE_MASTER_ID_MISMATCH/);
    assert.deepEqual((await enrichProduct(identity, provider, makeCache(), {}, second)).warnings, ["RESEARCH_IN_PROGRESS"]);
  } finally {
    finish();
  }
  assert.equal((await active).state, "ENRICHED");
  assert.equal((await enrichProduct(identity, provider, makeCache(), {}, second)).queried, false);
  assert.equal(claims.size, 0);
  assert.equal(searches, 1);

  const keepAlive = setTimeout(() => {}, 2_000);
  stored = null;
  try {
    const hung: ResearchProvider = { ...provider, search: () => new Promise(() => {}) };
    const timedOut = await enrichProduct(identity, hung, makeCache(), { timeoutMs: 10 }, first);
    assert.deepEqual(timedOut.warnings, ["RESEARCH_TIMEOUT"]);
    assert.equal(claims.size, 0);
  } finally {
    clearTimeout(keepAlive);
  }
});
