#!/usr/bin/env bash
# Additive migration only. Run after explicit authorization and backup verification.
set -euo pipefail
container=beupfree-catalog-pg17
db=uppulse_catalog
: "${M10_6_MIGRATION_APPROVED:?Set M10_6_MIGRATION_APPROVED=YES only after explicit approval}"
test "$M10_6_MIGRATION_APPROVED" = YES
echo "=== PRE-MIGRATION VERIFICATION ==="
docker inspect -f '{{.State.Status}}' "$container" | grep -qx running
docker exec -i "$container" sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d uppulse_catalog -X -v ON_ERROR_STOP=1' <<'SQL'
BEGIN READ ONLY;
SELECT current_database();
SELECT 'products' AS source, count(*) FROM products UNION ALL SELECT 'offers', count(*) FROM offers UNION ALL SELECT 'catalog_search_products', count(*) FROM catalog_search_products;
SELECT to_regclass('public.research_claims') AS claims_before, to_regclass('public.research_budget') AS budget_before;
COMMIT;
SQL
echo "=== APPLYING VERSIONED ADDITIVE MIGRATION ==="
# The SQL is read from the remote-tracking Git object, not the divergent local working tree.
git show origin/feat/uppulse-missao10-supercatalogo:migrations/mission10_research_coordination.sql |
  docker exec -i "$container" sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d uppulse_catalog -X -v ON_ERROR_STOP=1'
echo "=== POST-MIGRATION VERIFICATION ==="
docker exec -i "$container" sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d uppulse_catalog -X -v ON_ERROR_STOP=1' <<'SQL'
BEGIN READ ONLY;
SELECT to_regclass('public.research_claims') AS claims_after, to_regclass('public.research_budget') AS budget_after;
SELECT 'products' AS source, count(*) FROM products UNION ALL SELECT 'offers', count(*) FROM offers UNION ALL SELECT 'catalog_search_products', count(*) FROM catalog_search_products;
COMMIT;
SQL
echo "M10_6_MIGRATION_APPLIED; paid research remains disabled."
