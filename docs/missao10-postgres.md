# Mission 10 — PostgreSQL research cache

The first production-shaped persistence adapter is `createPostgresResearchCache`.
It implements the existing `ResearchCache` interface, and does not invoke paid APIs.
The local file-cache pilot remains the default for the smoke-test script.

## Safety and rollout

- Migration: `migrations/mission10_product_intelligence_cache.sql`.
- **Do not run the migration automatically.** Review schema, backup and environment first.
- The `master_id` foreign key requires a real `products.id`; the smoke-test's
  placeholder Master ID must not be written to PostgreSQL.
- Only `ENRICHED` cards are stored. Offers, prices and commercial identities are untouched.
- Cache records are keyed by the Master-specific SuperHash, preventing cross-Master sharing.
- The adapter uses parameterized SQL and an injectable executor.
- Concurrent misses may still call research twice; add advisory locking or a job queue
  before enabling parallel production enrichment.
- Evidence and conflicting values are currently serialized in the JSONB card;
  dedicated normalized evidence records and usage/budget controls are next.
- Existing results have no automatic expiry until a policy is approved.

## Verification (no DB changes or paid calls)

```sh
npm run check && npm run test:mission10
```
