---
name: ML membership deactivation & anti-flapping
description: Why scraped products vanish from the BeUpFree home page and how deactivation must work
---

# Membership deactivation drives home-page visibility

The home "Produtos com desconto" section (server/routes/dealSections.ts) serves
rows straight from `collection_memberships WHERE cm.is_active = true` joined to
`processed_items`. A published `products` row alone does NOT make an item show on
the home page — its membership must be active. Deactivated items only appear under
"Ofertas Anteriores" (is_active=false).

**Why this matters:** The Mercado Livre `/ofertas` page rotates which products it
shows across runs (same item present one run, absent the next, back later — still
for sale the whole time). The collect job scrapes one ~250-item snapshot per run.

**The rule:** `deactivateByBatch` (server/usecases/upsertMembership.ts) must NOT
mark an item esgotado on a single missed run. It increments `missed_runs_count`
for memberships not in the current batch and only sets `is_active=false` once the
count reaches `MISSED_RUNS_THRESHOLD` (2 = documented "2× frequency"). `upsert`
resets the count to 0 when an item reappears. A zero-tolerance version (deactivate
on first miss) silently hides still-available products — that was a real bug.

**How to apply:** If users report "scraped product X isn't on the site" but X is
scrapeable, check `collection_memberships.is_active` for X before suspecting the
scraper. Heavy churn (e.g. 179 new / 339 deactivated in one run) is the signature
of over-aggressive deactivation, not real sell-through.
