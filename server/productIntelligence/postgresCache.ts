import type { ResearchCache, ResearchResult } from "./research";

/** A minimal SQL adapter allows unit testing without a live database or API. */
export type SqlExecutor = {
  query(sql: string, params: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};
const validKey = (key: string) => {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error("INVALID_CACHE_KEY");
};
export function createPostgresResearchCache(executor: SqlExecutor): ResearchCache {
  return {
    async get(key) {
      validKey(key);
      const { rows } = await executor.query(
        "SELECT result FROM product_intelligence_cache WHERE super_hash = $1 AND (expires_at IS NULL OR expires_at > NOW())",
        [key],
      );
      const value = rows[0]?.result as ResearchResult | undefined;
      if (!value || value.state !== "ENRICHED" || value.card?.superHash !== key ||
          !Array.isArray(value.card.fields) || !Array.isArray(value.warnings)) return null;
      return value;
    },
    async set(key, result) {
      validKey(key);
      if (result.state !== "ENRICHED" || result.card.superHash !== key) throw new Error("INVALID_CACHE_ENTRY");
      await executor.query(
        `INSERT INTO product_intelligence_cache (super_hash, master_id, result, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (super_hash) DO UPDATE SET
           result = EXCLUDED.result, updated_at = NOW()
         WHERE product_intelligence_cache.master_id = EXCLUDED.master_id`,
        [key, result.card.masterId, JSON.stringify({ ...result, queried: false })],
      );
    },
  };
}
