#!/usr/bin/env bash
# Missao 11.1: isolated preview + read-only real-catalog smoke + Playwright.
# Never mutates original checkout, branch, commercial data or deployment.
set -Eeuo pipefail
checkout=/workspaces/uppulse-homologacao/missao9/codigo
cd "$checkout"
ref=origin/feat/uppulse-missao10-supercatalogo
container=beupfree-catalog-pg17
echo "=== PREPARING ISOLATED PREVIEW (NO GIT CHECKOUT CHANGES) ==="
docker start "$container" >/dev/null
docker exec "$container" sh -c 'pg_isready -U "${POSTGRES_USER:-postgres}" -d uppulse_catalog'
port=$(docker port "$container" 5432 | head -1 | sed -E 's/.*:([0-9]+)$/\1/')
[[ "$port" =~ ^[0-9]+$ ]] || { echo "POSTGRES_HOST_PORT_UNKNOWN"; exit 1; }
if curl -fsS --max-time 3 http://127.0.0.1:5002/ >/dev/null 2>&1; then
  echo "PORT_5002_IN_USE; will not stop or replace existing server"
  exit 1
fi
sandbox=$(mktemp -d /tmp/uppulse-m11-ai-XXXXXX)
git archive "$ref" | tar -x -C "$sandbox"
ln -s "$checkout/node_modules" "$sandbox/node_modules"
echo "Preview source snapshot: $(git rev-parse --short "$ref")"
echo "Isolated checkout: $sandbox"
# No credentials are printed. Use Docker's current PostgreSQL configuration.
docker_env=$(docker inspect --format '{{json .Config.Env}}' "$container")
export DATABASE_URL=$(DOCKER_ENV="$docker_env" PG_HOST_PORT="$port" node - <<'NODE'
const env=Object.fromEntries(JSON.parse(process.env.DOCKER_ENV).map(x=>{const p=x.indexOf('=');return [x.slice(0,p),x.slice(p+1)]}));
if(!env.POSTGRES_PASSWORD)process.exit(1);
const url=new URL('postgresql://localhost/');
url.username=env.POSTGRES_USER||'postgres';
url.password=env.POSTGRES_PASSWORD;
url.port=process.env.PG_HOST_PORT;
url.pathname='/uppulse_catalog';
process.stdout.write(url.toString());
NODE
)
export AWIN_CURATOR_DATABASE_URL="$DATABASE_URL"
export UPPULSE_PUBLIC_CATALOG_SOURCE=operational UPPULSE_PUBLIC_CATALOG_APPROVED=true
export RESEARCH_PAID_ENABLED=false RESEARCH_POSTGRES_HOMOLOGATED=false
export UPPULSE_DISABLE_EXTERNAL_JOBS=true PUBLIC_DEMO_MODE=false
export PORT=5002 NODE_ENV=development
cd "$sandbox"
echo "=== STARTING PREVIEW 5002 ==="
nohup npm run dev > "$sandbox/mission11-ai-server.log" 2>&1 < /dev/null &
echo "$!" > "$sandbox/mission11-ai-server.pid"
ready=0
for i in $(seq 1 90); do
  if curl -fsS --max-time 2 http://127.0.0.1:5002/ >/dev/null 2>&1; then ready=1; break; fi
  if ! kill -0 "$(cat "$sandbox/mission11-ai-server.pid")" 2>/dev/null; then break; fi
  sleep 1
done
if (( ready == 0 )); then
  echo "PREVIEW_FAILED"; tail -50 "$sandbox/mission11-ai-server.log"; exit 1
fi
echo "=== VALIDATING ACTUAL OPERATIONAL API (READ ONLY) ==="
response=$(mktemp /tmp/uppulse-ai-catalog-XXXXXX.json)
curl -fsS --max-time 30 'http://127.0.0.1:5002/api/products?limit=2' -o "$response"
product_id=$(node - "$response" <<'NODE'
const fs=require('fs');
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(data.catalogSource!=='operational'||data.demonstrative||!Array.isArray(data.products)||!data.products.length){
 console.error('OPERATIONAL_CATALOG_NOT_READY',JSON.stringify({source:data.catalogSource,total:data.total,error:data.error}));process.exit(1);
}
const p=data.products[0];
if(!p.bestOffer?.affiliateUrl||!/^https?:\/\//.test(p.bestOffer.affiliateUrl)){
 console.error('ELIGIBLE_OFFER_MISSING');process.exit(1);
}
console.error('OPERATIONAL_PRODUCT_OK',p.id,p.mainName,'products_found',data.products.length,'total',data.total);
process.stdout.write(p.id);
NODE
)
rm -f "$response"
knowledge=$(mktemp /tmp/uppulse-ai-knowledge-XXXXXX.json)
curl -fsS --max-time 20 "http://127.0.0.1:5002/api/product-knowledge/$product_id" -o "$knowledge"
node - "$knowledge" "$product_id" <<'NODE'
const fs=require('fs'),data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(data.catalogSource!=='operational'||data.card?.masterId!==process.argv[3]||!(/^[a-f0-9]{64}$/).test(data.card?.superHash||'')){
 console.error('KNOWLEDGE_NOT_READY',JSON.stringify({code:data.code,status:data.status}));process.exit(1);
}
console.log('REAL_KNOWLEDGE_OK',data.status,'master',data.card.masterId,'superhash',data.card.superHash);
NODE
rm -f "$knowledge"
echo "=== PLAYWRIGHT IA UI (MOCK DATA, REAL BROWSER) ==="
export PLAYWRIGHT_BASE_URL=http://127.0.0.1:5002 PLAYWRIGHT_EXTERNAL_SERVER=true
npx playwright install chromium
if ! npx playwright test --config=playwright.mission11-ai.config.ts; then
 echo "PLAYWRIGHT_FAILED; results under $sandbox/test-results/mission11-ai"
 exit 1
fi
echo "M11_1_REAL_CATALOG_AND_PLAYWRIGHT_OK"
echo "Preview: Codespaces PORTS -> 5002 -> Open in Browser"
echo "Snapshot and log: $sandbox"
echo "Original checkout and commercial tables unchanged; paid research disabled."
