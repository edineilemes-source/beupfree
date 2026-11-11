#!/usr/bin/env bash
# Read-only backup archive check with PostgreSQL 17 tools, matching the Docker database.
set -euo pipefail
backup=/workspaces/backups/uppulse_catalog_pre_missao10.dump
container=beupfree-catalog-pg17
test -s "$backup" || { echo "BACKUP_MISSING"; exit 1; }
echo "=== BACKUP FILE ==="
stat -c '%n %s bytes %y' "$backup"
file "$backup"
echo "=== POSTGRESQL RESTORE TOOL ==="
docker exec "$container" pg_restore --version
echo "=== BACKUP ARCHIVE CONTENTS (PG17) ==="
# stdin streaming avoids mounting the host backup inside the container.
docker exec -i "$container" pg_restore --list < "$backup" |
  awk '/ TABLE (public )?(products|offers|catalog_search_products) / || / TABLE DATA (public )?(products|offers|catalog_search_products) / { print; n++ } END { if(n<6) { print "EXPECTED_TABLE_ENTRIES_MISSING" > "/dev/stderr"; exit 1 } }'
echo "BACKUP_INDEX_OK_WITH_PG17; full restore not verified."
