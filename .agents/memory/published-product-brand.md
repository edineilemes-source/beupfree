---
name: Published products missing structured attributes
description: Public products API returns null brand/category/gender/size/rating; how the catalog UI fills the gap and which attrs can't be derived.
---

The `/api/products` response (catalog) commonly has `brand: null` and `category: null`
even for published items, because the Collect→Process→Triage→Publish pipeline often
publishes products without setting `brand_id` / `category_id`. The same is true for the
`gender`, `usage_type`, and `average_rating`/`total_reviews` columns on `products` — the
columns exist but are NEVER populated (all published rows are NULL/0).

**Why:** ML listing titles are rich (brand, "Masculino/Feminino", "Infantil/Menina",
trailing BR shoe size like "...Lisa 43", sport words), so the catalog derives those
facets from the title instead of from FKs/columns. But rating is the exception: it is
scraped (`avaliacao_media`) yet never persisted (no rating column on `processed_items`,
`createProduct` in the approve flow doesn't set `averageRating`), so it is NOT derivable
from the title and there is no stored rating to filter on.

**How to apply:** For catalog filters/badges (brand, category, gender, size, age, sport),
derive client-side from the product title in `client/src/lib/catalogFilters.ts`
(`brandNameOf`/`categoryNameOf`/`genderOf`/`ageOf`/`sizeOf`/`modalityOf`) rather than
trusting `product.*` fields. The server `?brand=slug` filter is unreliable for the same
reason. Do NOT build a rating filter from title/DB data — it requires first persisting
the scraped rating through the pipeline and backfilling existing products.
