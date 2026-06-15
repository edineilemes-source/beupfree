---
name: Published products missing brand/category
description: Public products API returns null brand/category; how the catalog UI fills the gap.
---

The `/api/products` response (catalog) commonly has `brand: null` and `category: null`
even for published items, because the Collect→Process→Triage→Publish pipeline often
publishes products without setting `brand_id` / `category_id`.

**Why:** ML listing titles always contain the brand (e.g. "Tênis On Running Cloud...",
"Tênis Asics ..."), so the pipeline doesn't strictly need the FK populated to display
something useful. But any UI that filters/groups by brand will get empty facets.

**How to apply:** For brand/category filters or badges in the public catalog, derive
the value from the product title client-side (`detectBrand` / `brandNameOf` /
`categoryNameOf` in `client/src/lib/catalogFilters.ts`) rather than trusting
`product.brand`/`product.category`. The server `?brand=slug` filter is also unreliable
for the same reason.
