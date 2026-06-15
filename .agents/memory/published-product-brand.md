---
name: Published product brand/category resolution
description: Public products API returns populated brand/category; how they are resolved and persisted at publish time, replacing the old client-side title parsing.
---

The `/api/products` response (catalog) now returns populated `brand` and `category`
objects for published items. Brand/category are resolved and persisted at publish time.

**Why:** Previously the Collect→Process→Triage→Publish pipeline published products
without setting `brand_id`/`category_id`, so the catalog parsed the title client-side
and the server `?brand=slug` filter couldn't be trusted. That fallback was removed.
The `gender`, `usage_type`, and `average_rating`/`total_reviews` columns on `products`
remain unpopulated (all published rows are NULL/0). Rating is the exception: it is
scraped (`avaliacao_media`) yet never persisted (no rating column on `processed_items`,
`createProduct` in the approve flow doesn't set `averageRating`), so it is NOT derivable
from the title and there is no stored rating to filter on.

**How to apply:**
- Brand/category detection lives in `server/services/productSync.ts`:
  `detectBrand`/`detectCategory` (title + ML brand hint + aliases) produce slug-ish
  names; `resolveBrandId`/`resolveCategoryId` map them to FK ids (resolveBrandId
  CREATES the brand if missing, resolveCategoryId only looks up existing categories).
- All three publish paths set the FKs: manual approve + bulk-approve in
  `server/routes.ts`, and the auto-publish path in `server/jobs/collectCollections.ts`.
- Keep the server `BRAND_LIST` in `productSync.ts` in sync with any brand list the UI
  expects — multi-word names (e.g. "on running", "new balance") must come first so
  they win over single-word substrings.
- Unknown brands resolve to the "Outra" brand (slug `outra`); the client shows
  "Outras" when `p.brand` is null.
- For catalog filters/badges that are NOT brand/category (gender, size, age, sport),
  derive client-side from the product title in `client/src/lib/catalogFilters.ts`
  (`genderOf`/`ageOf`/`sizeOf`/`modalityOf`) rather than trusting `product.*` fields.
- Do NOT build a rating filter from title/DB data — it requires first persisting
  the scraped rating through the pipeline and backfilling existing products.
