import { pool } from "../db";
import { createPostgresResearchCache, type SqlExecutor } from "./postgresCache";
import { createPostgresResearchClaim } from "./postgresResearchClaim";
import { enrichProduct, type ResearchOptions, type ResearchProvider } from "./research";
import type { IdentityDescriptor } from "./superCatalog";

const sharedExecutor: SqlExecutor = {
  query(sql, params) {
    const query = { text: sql, values: [...params], query_timeout: 5_000 };
    return pool.query(query);
  },
};
const sharedCache = createPostgresResearchCache(sharedExecutor);
const sharedClaim = createPostgresResearchClaim(sharedExecutor);

export function createPostgresProductResearch(
  provider: ResearchProvider,
  transactionExecutor?: SqlExecutor,
) {
  // The optional executor preserves the rollback-only test of the cache adapter.
  // A claim inside a caller transaction would be invisible to other sessions.
  const cache = transactionExecutor ? createPostgresResearchCache(transactionExecutor) : sharedCache;
  return (identity: IdentityDescriptor, options?: ResearchOptions) =>
    enrichProduct(identity, provider, cache, options, transactionExecutor ? undefined : sharedClaim);
}
