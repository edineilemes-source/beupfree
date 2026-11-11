#!/usr/bin/env bash
# Mission 11: non-destructive diagnosis and launch of UpPulse in Codespaces.
set -euo pipefail
cd /workspaces/uppulse-homologacao/missao9/codigo
echo "=== CHECKOUT (NO GIT MUTATION) ==="
git branch --show-current
git rev-parse --short HEAD
git status --short
echo "=== DATABASE CONTAINER ==="
docker inspect -f '{{.Name}} {{.State.Status}}' beupfree-catalog-pg17 || true
echo "=== SERVER / PORT 5000 ==="
if curl -fsS --max-time 3 http://127.0.0.1:5000/ >/dev/null 2>&1; then
  echo "UPPULSE_HTTP_200_PORT_5000"
else
  echo "PORT_5000_NOT_READY"
  echo "=== STARTUP CANDIDATES ==="
  ls -l start-codespace.sh node_modules/.bin/tsx 2>/dev/null || true
  echo "=== PORT LISTENERS ==="
  ss -ltnp | grep -E ':5000|:5435' || true
  echo "=== DATABASE ENV CONFIGURATION (NO SECRETS PRINTED) ==="
  if test -n "${DATABASE_URL:-}"; then echo "DATABASE_URL_SET"; else echo "DATABASE_URL_UNSET"; fi
  if test -f .env; then echo "DOTENV_PRESENT"; else echo "DOTENV_ABSENT"; fi
fi
echo "=== SAFE STATUS CHECK COMPLETE ==="
