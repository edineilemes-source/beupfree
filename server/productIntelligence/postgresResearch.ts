import { pool } from "../db";
import { createPostgresResearchCache, type SqlExecutor } from "./postgresCache";
import { enrichProduct, type ResearchOptions, type ResearchProvider } from "./research";
import type { IdentityDescriptor } from "./superCatalog";

export function createPostgresProductResearch(
  provider: ResearchProvider,
  executor: SqlExecutor = { query: (sql, params) => pool.query(sql, [...params]) },
) {
  const cache = createPostgresResearchCache(executor);
  return (identity: IdentityDescriptor, options?: ResearchOptions) =>
    enrichProduct(identity, provider, cache, options);
}
