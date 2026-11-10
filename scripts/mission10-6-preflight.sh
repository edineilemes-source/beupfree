#!/usr/bin/env bash
# Read-only preflight: no migrations, writes, or API calls.
set -euo pipefail
container=beupfree-catalog-pg17
echo "=== REPOSITORY ==="
git branch --show-current
git rev-parse --short HEAD
git status --short
echo "=== POSTGRES CONTAINER ==="
docker inspect -f 'name={{.Name}} state={{.State.Status}} image={{.Config.Image}}' "$container"
echo "=== DATABASE STRUCTURE AND COUNTS (READ ONLY) ==="
docker exec -i "$container" sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -X -v ON_ERROR_STOP=1' <<'SQL'
BEGIN READ ONLY;
SELECT current_database() AS database_name;
SELECT table_name, count(*) AS columns FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('products','offers','catalog_search_products','product_intelligence_cache','research_claims','research_budget') GROUP BY table_name ORDER BY table_name;
SELECT 'products' AS table_name, count(*) FROM public.products
UNION ALL SELECT 'offers', count(*) FROM public.offers
UNION ALL SELECT 'catalog_search_products', count(*) FROM public.catalog_search_products;
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.products'::regclass AND contype='p';
COMMIT;
SQL
echo "=== BACKUP FILES (METADATA ONLY) ==="
find /workspaces /tmp -maxdepth 5 -type f \( -name '*.dump' -o -name '*.backup' -o -name '*.pgdump' \) -printf '%s bytes %TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null | head -30 || true
echo "PREFLIGHT COMPLETE: no database changes performed."
