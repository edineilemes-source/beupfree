-- UPCAT001.1: proposed indexes for the read-only operational catalog preview.
-- Applied under controlled UPCAT001.2 authorization; statements remain idempotent.

-- EXPLAIN showed a 36.5s hash join with sequential scans because the feed item
-- lookup used by brand/audience had no merchant_product_id access path.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_feed_merchant_product
  ON commerce_raw_feed_items (merchant_id, merchant_product_id);

-- Supports normalized-size filters without scanning every current
-- normalization. The version predicate preserves append-only/latest semantics.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_variant_normalizations_preview_size
  ON product_variant_normalizations
  (normalizer_version, size_status, size_normalized, variant_id);
