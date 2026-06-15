---
name: Product attribute backfill from raw scrape data
description: How to backfill products.* columns from the original scraped values
---
Scraped per-item attributes (rating, reviews, etc.) live in
`raw_collected_items.raw_data` (jsonb: avaliacao_media, qtd_avaliacoes, marca,
frete_gratis, parcelas). They are NOT automatically on `products`.

To backfill a product column from scrape data, join:
`products.id = offers.product_id` and `offers.external_id = raw_collected_items.external_id`.
external_id (MLBxxxx) is the only stable link between a published product and its
raw scrape rows. Use DISTINCT ON (external_id) ORDER BY collected_at DESC to pick
the latest raw row per item.

**Why:** publish paths (auto-publish in collectCollections.ts, triage approve in
routes.ts) only persisted a subset of fields, so historical products have NULLs
even though the data was scraped. ~83% coverage typical (some items had no value
captured at scrape time).
