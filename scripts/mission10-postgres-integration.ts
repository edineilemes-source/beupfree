import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPostgresResearchCache, type SqlExecutor } from "../server/productIntelligence/postgresCache";
import type { ResearchProvider } from "../server/productIntelligence/research";
import { createSuperCatalogCard } from "../server/productIntelligence/superCatalog";

async function verify() {
  const connectionString = process.env.DATABASE_URL;
  assert.ok(connectionString, "Configure DATABASE_URL para o catálogo de homologação");
  const target = URL.canParse(connectionString) ? new URL(connectionString) : null;
  assert.ok(target && ["postgres:", "postgresql:"].includes(target.protocol) &&
    target.hostname === "127.0.0.1" && target.port === "5435" &&
    target.pathname === "/uppulse_catalog" && !target.search && !target.hash,
  "DATABASE_URL deve apontar para 127.0.0.1:5435/uppulse_catalog sem parâmetros extras");

  const { pool } = await import("../server/db");
  try {
    const { createPostgresProductResearch } = await import("../server/productIntelligence/postgresResearch");
    const identity = { masterId: "", brand: "Synthetic", model: randomUUID() };
    let key = "";
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: [database] } = await client.query(
        "SELECT current_database() AS name, to_regclass('public.product_intelligence_cache') IS NOT NULL AS has_cache",
      );
      assert.equal(database.name, "uppulse_catalog");
      assert.equal(database.has_cache, true);
      await client.query("SET LOCAL search_path TO public");
      const { rows: masters } = await client.query<{ id: string }>(
        "SELECT id FROM products ORDER BY id LIMIT 2",
      );
      assert.equal(masters.length, 2, "São necessários dois Master IDs existentes");
      identity.masterId = masters[0].id;
      key = createSuperCatalogCard(identity).superHash;

      const executor: SqlExecutor = { query: (sql, params) => client.query(sql, [...params]) };
      const cache = createPostgresResearchCache(executor);
      const { rowCount } = await client.query(
        "SELECT 1 FROM product_intelligence_cache WHERE super_hash = $1", [key],
      );
      assert.equal(rowCount, 0, "O hash sintético deve estar livre");

      const calls: string[] = [];
      const provider: ResearchProvider = {
        async search() {
          calls.push("search");
          return [{ url: "https://example.test/spec", title: "Synthetic specs", snippet: "", sourceType: "RETAILER" }];
        },
        async extract(_, hit) {
          calls.push("extract");
          return [{
            field: "cabedal", value: "Synthetic mesh", sourceUrl: hit.url,
            sourceType: hit.sourceType, observedAt: new Date().toISOString(),
          }];
        },
      };
      const enrich = createPostgresProductResearch(provider, executor);
      const first = await enrich(identity);
      assert.equal(first.state, "ENRICHED");
      assert.equal(first.queried, true);
      const persisted = { ...first, queried: false };
      assert.deepEqual(await cache.get(key), persisted);
      assert.deepEqual(await enrich(identity), persisted);
      assert.deepEqual(calls, ["search", "extract"]);

      const updated = { ...persisted, warnings: ["SYNTHETIC_UPDATE"] };
      await cache.set(key, updated);
      assert.deepEqual(await cache.get(key), updated);
      await assert.rejects(
        cache.set(key, { ...updated, card: { ...updated.card, masterId: masters[1].id } }),
        /CACHE_MASTER_ID_MISMATCH/,
      );
      assert.deepEqual(await cache.get(key), updated);

      await client.query(
        "UPDATE product_intelligence_cache SET expires_at = NOW() - INTERVAL '1 second' WHERE super_hash = $1",
        [key],
      );
      assert.equal(await cache.get(key), null);
      const refreshed = await enrich(identity);
      assert.equal(refreshed.queried, true);
      assert.deepEqual(await cache.get(key), { ...refreshed, queried: false });
      assert.deepEqual(await enrich(identity), { ...refreshed, queried: false });
      assert.deepEqual(calls, ["search", "extract", "search", "extract"]);
    } finally {
      try {
        await client.query("ROLLBACK");
      } finally {
        client.release(true);
      }
    }
    const { rowCount } = await pool.query(
      "SELECT 1 FROM public.product_intelligence_cache WHERE super_hash = $1", [key],
    );
    assert.equal(rowCount, 0, "O registro sintético deve desaparecer após o rollback");
  } finally {
    await pool.end();
  }
}

verify().then(() => {
  console.log("MISSÃO 10.5: integração PostgreSQL aprovada e registro sintético ausente após ROLLBACK");
}).catch((error: unknown) => {
  // Avoid printing connection strings or database error details.
  const code = (error as { code?: string } | undefined)?.code;
  const diagnostic = typeof code === "string" && /^[A-Z0-9_]{5,40}$/.test(code)
    ? code
    : "UNEXPECTED_ERROR";
  console.error("MISSÃO 10.5: falha na integração", diagnostic);
  process.exitCode = 1;
});
