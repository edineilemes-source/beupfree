-- Mission 10: additive, opt-in migration. Do NOT execute automatically.
-- Product Identity Master remains the authority; no product merge or offer update.
BEGIN;
CREATE TABLE IF NOT EXISTS product_intelligence_cache (
  super_hash varchar(64) PRIMARY KEY,
  master_id varchar(36) NOT NULL REFERENCES products(id),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz,
  CONSTRAINT ck_m10_super_hash CHECK (super_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ck_m10_enriched CHECK (result->>'state' = 'ENRICHED'),
  CONSTRAINT ck_m10_master_matches CHECK (result->'card'->>'masterId' = master_id),
  CONSTRAINT ck_m10_hash_matches CHECK (result->'card'->>'superHash' = super_hash)
);
CREATE INDEX IF NOT EXISTS idx_m10_cache_master ON product_intelligence_cache(master_id);
CREATE INDEX IF NOT EXISTS idx_m10_cache_expiration ON product_intelligence_cache(expires_at);
COMMIT;
