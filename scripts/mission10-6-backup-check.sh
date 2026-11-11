#!/usr/bin/env bash
# Read-only validation of existing backup archive; never restores into the catalog database.
set -euo pipefail
backup=/workspaces/backups/uppulse_catalog_pre_missao10.dump
test -s "$backup" || { echo "BACKUP_MISSING"; exit 1; }
echo "=== BACKUP ==="
stat -c '%n %s bytes %y' "$backup"
file "$backup"
echo "=== ARCHIVE INTEGRITY (TABLE OF CONTENTS) ==="
pg_restore --list "$backup" >/tmp/uppulse-m10-backup-toc-$$.txt
grep -E ' TABLE (public )?(products|offers|catalog_search_products) ' /tmp/uppulse-m10-backup-toc-$$.txt || true
echo "=== ARCHIVE DATA ENTRIES ==="
grep -E ' TABLE DATA (public )?(products|offers|catalog_search_products) ' /tmp/uppulse-m10-backup-toc-$$.txt || true
rm -f /tmp/uppulse-m10-backup-toc-$$.txt
echo "ARCHIVE_INDEX_OK; full restore still unverified."
