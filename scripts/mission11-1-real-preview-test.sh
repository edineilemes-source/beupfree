#!/usr/bin/env bash
# Missao 11.1: isolated preview + read-only real-catalog smoke + Playwright.
# Never mutates original checkout, branch, commercial data or deployment.
set -Eeuo pipefail
checkout=/workspaces/uppulse-homologacao/missao9/codigo
cd "$checkout"
ref=origin/feat/uppulse-missao10-supercatalogo
container=beupfree-catalog-pg17
preview_port=${UPPULSE_AI_PREVIEW_PORT:-5004}
if [[ ! "$preview_port" =~ ^[0-9]{4,5}$ ]]; then echo "INVALID_PREVIEW_PORT"; exit 1; fi
echo "=== PREPARING ISOLATED PREVIEW (NO GIT CHECKOUT CHANGES) ==="
docker start "$container" >/dev/null
docker exec "$container" sh -c 'pg_isready -U "${POSTGRES_USER:-postgres}" -d uppulse_catalog'
port=$(docker port "$container" 5432 | head -1 | sed -E 's/.*:([0-9]+)$/\1/')
[[ "$port" =~ ^[0-9]+$ ]] || { echo "POSTGRES_HOST_PORT_UNKNOWN"; exit 1; }
if curl -fsS --max-time 3 http://127.0.0.1:${preview_port}/ >/dev/null 2>&1; then
  echo "PORT_${preview_port}_IN_USE; will not stop or replace existing server"
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
export PORT="$preview_port" NODE_ENV=development
cd "$sandbox"
echo "=== STARTING PREVIEW ${preview_port} ==="
nohup npm run dev > "$sandbox/mission11-ai-server.log" 2>&1 < /dev/null &
echo "$!" > "$sandbox/mission11-ai-server.pid"
ready=0
for i in $(seq 1 90); do
  if curl -fsS --max-time 2 http://127.0.0.1:${preview_port}/ >/dev/null 2>&1; then ready=1; break; fi
  if ! kill -0 "$(cat "$sandbox/mission11-ai-server.pid")" 2>/dev/null; then break; fi
  sleep 1
done
if (( ready == 0 )); then
  echo "PREVIEW_FAILED"; tail -50 "$sandbox/mission11-ai-server.log"; exit 1
fi
echo "=== VALIDATING ACTUAL OPERATIONAL API (READ ONLY) ==="
response=$(mktemp /tmp/uppulse-ai-catalog-XXXXXX.json)
curl -fsS --max-time 30 "http://127.0.0.1:${preview_port}/api/products?limit=2" -o "$response"
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
curl -fsS --max-time 20 "http://127.0.0.1:${preview_port}/api/product-knowledge/$product_id" -o "$knowledge"
node - "$knowledge" "$product_id" <<'NODE'
const fs=require('fs'),data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(data.catalogSource!=='operational'||data.card?.masterId!==process.argv[3]||!(/^[a-f0-9]{64}$/).test(data.card?.superHash||'')){
 console.error('KNOWLEDGE_NOT_READY',JSON.stringify({code:data.code,status:data.status}));process.exit(1);
}
console.log('REAL_KNOWLEDGE_OK',data.status,'master',data.card.masterId,'superhash',data.card.superHash);
NODE
rm -f "$knowledge"
echo "=== VERIFY SEARCH FILTERS AGAINST REAL POSTGRESQL (READ ONLY) ==="
node --input-type=module - <<'NODE'
const port=process.env.PORT;
for(const [brand,activity] of [["Adidas","Corrida"],["Nike","Caminhada"]]){
 const q=new URLSearchParams({marca:brand,modalidade:activity,limit:"6",offset:"0",sort:"recommended"});
 const response=await fetch("http://127.0.0.1:"+port+"/api/products?"+q.toString());
 if(!response.ok)throw Error("OPERATIONAL_QUERY_HTTP_"+response.status);
 const data=await response.json();
 if(data.catalogSource!=="operational"||!Number.isInteger(data.total))throw Error("OPERATIONAL_QUERY_INVALID");
 for(const p of data.products??[]){
  if((p.brand?.name??"").toLowerCase()!==brand.toLowerCase())throw Error("BRAND_FILTER_LEAK");
  if(!(p.activities??[]).includes(activity==="Corrida"?"RUNNING":"WALKING"))throw Error("ACTIVITY_FILTER_LEAK");
 }
 console.log("REAL_SEARCH_OK",brand,activity,"total",data.total,"returned",data.products.length);
}
NODE
echo "=== READ-ONLY TECHNICAL EVIDENCE SEARCH ==="
node --input-type=module - <<'NODE'
const url="http://127.0.0.1:"+process.env.PORT+"/api/assistant/technical/search?tecnica=amortecimento&marca=Nike";
const response=await fetch(url);
if(!response.ok)throw Error("TECHNICAL_SEARCH_HTTP_"+response.status);
const data=await response.json();
if(data.catalogSource!=="operational"||data.technicalSource!=="verified-cache-only"||!Number.isInteger(data.total))
 throw Error("TECHNICAL_SEARCH_RESPONSE_INVALID");
for(const p of data.products??[]){
 if(p.brand?.name?.toLowerCase()!=="nike"||!p.verifiedEvidence?.length)throw Error("TECHNICAL_EVIDENCE_MISSING");
 if(p.verifiedEvidence.some(f=>!["VERIFIED","SINGLE_SOURCE"].includes(f.status)))throw Error("UNVERIFIED_EVIDENCE_EXPOSED");
}
console.log("REAL_TECHNICAL_SEARCH_OK","matching_knowledge_rows",data.total);
NODE
echo "=== PLAYWRIGHT IA UI V11.1.3 (MOCK DATA, REAL BROWSER) ==="
export PLAYWRIGHT_BASE_URL=http://127.0.0.1:${preview_port} PLAYWRIGHT_EXTERNAL_SERVER=true
npx playwright install chromium
if ! npx playwright test --config=playwright.mission11-ai.config.ts; then
 echo "PLAYWRIGHT_FAILED; results under $sandbox/test-results/mission11-ai"
 exit 1
fi
echo "M11_1_REAL_CATALOG_AND_PLAYWRIGHT_OK"
echo "Preview: Codespaces PORTS -> ${preview_port} -> Open in Browser"
echo "Snapshot and log: $sandbox"
echo "Original checkout and commercial tables unchanged; paid research disabled."
