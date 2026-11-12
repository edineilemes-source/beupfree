#!/usr/bin/env bash
# Restart the existing catalog DB and launch preview without touching git or data.
set -euo pipefail
cd /workspaces/uppulse-homologacao/missao9/codigo
container=beupfree-catalog-pg17
echo "=== START EXISTING POSTGRESQL ==="
docker start "$container" >/dev/null
for i in $(seq 1 30); do
  if docker exec "$container" sh -c 'pg_isready -U "${POSTGRES_USER:-postgres}" -d uppulse_catalog' >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$container" sh -c 'pg_isready -U "${POSTGRES_USER:-postgres}" -d uppulse_catalog'
echo "=== VERIFY CATALOG (READ ONLY) ==="
docker exec "$container" sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d uppulse_catalog -X -At -v ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM products), (SELECT count(*) FROM offers), (SELECT count(*) FROM catalog_search_products)"'
echo "=== VERIFY HOST PORT ==="
docker port "$container" 5432
port=$(docker port "$container" 5432 | head -1 | sed -E 's/.*:([0-9]+)$/\1/')
if [[ ! "$port" =~ ^[0-9]+$ ]]; then echo "POSTGRES_HOST_PORT_UNKNOWN"; exit 1; fi
if ss -ltn | grep -Eq ":5000[[:space:]]"; then
  echo "PORT_5000_ALREADY_IN_USE; not replacing existing process"
  curl -sSI --max-time 5 http://127.0.0.1:5000/ | head -1 || true
  exit 0
fi
echo "=== START UPPULSE PREVIEW ==="
# Read Docker's already-configured PostgreSQL credentials; never print secrets.
docker_env=$(docker inspect --format '{{json .Config.Env}}' "$container")
export DATABASE_URL=$(DOCKER_ENV="$docker_env" PG_HOST_PORT="$port" node - <<'NODE'
const env=Object.fromEntries(JSON.parse(process.env.DOCKER_ENV).map(x=>{const p=x.indexOf('=');return [x.slice(0,p),x.slice(p+1)]}));
const user=env.POSTGRES_USER||'postgres', password=env.POSTGRES_PASSWORD;
if (!password) { console.error('POSTGRES_PASSWORD_NOT_AVAILABLE'); process.exit(1); }
const url=new URL('postgresql://localhost/');
url.username=user;url.password=password;url.port=process.env.PG_HOST_PORT;url.pathname='/uppulse_catalog';
process.stdout.write(url.toString());
NODE
)
export PORT=5000 HOST=0.0.0.0 NODE_ENV=development
export RESEARCH_PAID_ENABLED=false RESEARCH_POSTGRES_HOMOLOGATED=false
echo "DATABASE_URL derived from existing Docker configuration (secret not printed)"
echo "Starting npm run dev; keep terminal open; use Codespaces PORTS > 5000 > Open in Browser."
npm run dev
