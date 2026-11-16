#!/usr/bin/env bash
# Read-only, isolated three-source golden-data pilot. No paid calls.
set -Eeuo pipefail
cd /workspaces/uppulse-homologacao/missao9/codigo
ref=origin/feat/uppulse-missao10-supercatalogo
container=beupfree-catalog-pg17
port=5005
if curl -fsS --max-time 3 "http://127.0.0.1:$port/" >/dev/null 2>&1; then echo "PORT_5005_IN_USE"; exit 1; fi
sandbox=$(mktemp -d /tmp/uppulse-evo-sl-pilot-XXXXXX)
git archive "$ref" | tar -x -C "$sandbox"
ln -s /workspaces/uppulse-homologacao/missao9/codigo/node_modules "$sandbox/node_modules"
echo "Source: $(git rev-parse --short "$ref"); isolated at $sandbox"
cd "$sandbox"
echo "=== OFFLINE TESTS (DOCKER NOT REQUIRED) ==="
npm run check
node --import tsx --test server/productIntelligence/evoSlPilot.test.ts
echo "=== POSTGRESQL DOCKER PRECHECK ==="
status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)
echo "Catalog container status: ${status:-not-found}"
if [[ "$status" != "running" ]]; then
  echo "Attempting to start existing catalog container once, without recreating it"
  if ! docker start "$container" >/dev/null; then
    echo "DOCKER_RUNTIME_BLOCKED: catalog container could not start"
    docker inspect -f 'state={{.State.Status}} exit={{.State.ExitCode}} error={{.State.Error}} image={{.Config.Image}}' "$container" || true
    docker ps -a --filter "name=beupfree-catalog-pg17" --format 'name={{.Names}} state={{.Status}}' || true
    echo "Offline TypeScript and pilot unit tests already executed. Browser preview requires Docker recovery."
    echo "Do NOT docker rm, docker compose down -v, prune or delete volumes."
    exit 2
  fi
fi
echo "=== WAITING FOR POSTGRESQL READINESS (MAX 90s) ==="
ready=0
for attempt in $(seq 1 45); do
  if docker exec "$container" sh -c 'pg_isready -q -U "${POSTGRES_USER:-postgres}" -d uppulse_catalog' >/dev/null 2>&1; then
    ready=1
    break
  fi
  state=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)
  if [[ "$state" != "running" ]]; then
    echo "POSTGRES_EXITED_EARLY: state=$state attempt=$attempt"
    break
  fi
  sleep 2
done
if ((ready==0)); then
  echo "CATALOG_POSTGRES_NOT_READY: preserve existing container and volume"
  docker inspect -f 'state={{.State.Status}} exit={{.State.ExitCode}} error={{.State.Error}} image={{.Config.Image}} started={{.State.StartedAt}}' "$container" || true
  docker logs --tail 45 "$container" 2>&1 | sed -E 's#(postgres(ql)?://)[^[:space:]]+#\1[REDACTED]#g' || true
  echo "Read-only troubleshooting only; no docker rm, prune, compose down -v, or volume changes."
  exit 2
fi
echo "CATALOG_POSTGRES_READY after attempt $attempt"
dbport=$(docker port "$container" 5432 | head -1 | sed -E 's/.*:([0-9]+)$/\1/')
[[ "$dbport" =~ ^[0-9]+$ ]] || { echo "CATALOG_PORT_UNAVAILABLE"; exit 2; }

docker_env=$(docker inspect --format '{{json .Config.Env}}' "$container")
export DATABASE_URL=$(DOCKER_ENV="$docker_env" PG_HOST_PORT="$dbport" node - <<'NODE'
const env=Object.fromEntries(JSON.parse(process.env.DOCKER_ENV).map(x=>{const p=x.indexOf("=");return[x.slice(0,p),x.slice(p+1)]}));
if(!env.POSTGRES_PASSWORD)process.exit(1);
const url=new URL("postgresql://localhost");
url.username=env.POSTGRES_USER||"postgres";url.password=env.POSTGRES_PASSWORD;
url.port=process.env.PG_HOST_PORT;url.pathname="/uppulse_catalog";process.stdout.write(url.toString());
NODE
)
export AWIN_CURATOR_DATABASE_URL="$DATABASE_URL"
export UPPULSE_PUBLIC_CATALOG_SOURCE=operational UPPULSE_PUBLIC_CATALOG_APPROVED=true
export PUBLIC_DEMO_MODE=false UPPULSE_DISABLE_EXTERNAL_JOBS=true
export RESEARCH_PAID_ENABLED=false RESEARCH_POSTGRES_HOMOLOGATED=false
export NODE_ENV=development PORT="$port"
cd "$sandbox"
echo "=== START ISOLATED PREVIEW ==="
nohup npm run dev > "$sandbox/server.log" 2>&1 </dev/null &
echo "$!" > "$sandbox/server.pid"
ready=0
for i in $(seq 1 90); do
 if curl -fsS --max-time 3 "http://127.0.0.1:$port/" >/dev/null 2>&1; then ready=1;break;fi
 if ! kill -0 "$(cat "$sandbox/server.pid")" 2>/dev/null;then break;fi
 sleep 1
done
if ((ready==0));then echo "PREVIEW_FAILED";tail -60 "$sandbox/server.log";exit 1;fi
echo "=== CAN SITES BE READ DIRECTLY? ONE REQUEST PER SOURCE (NO PAID APIS) ==="
node --input-type=module - <<'NODE'
const urls=[
"https://www.adidas.com.br/tenis-adizero-evo-sl/KJ1363.html",
"https://www.centauro.com.br/tenis-masculino-adidas-adizero-evo-sl-996133.html",
"https://www.netshoes.com.br/p/tenis-adidas-adizero-evo-sl-masculino-preto%2Bbranco-FBA-83DK-026?promoted=true&sellerId=0",
];
for(const uri of urls){
 const host=new URL(uri).hostname;
 try{
  const res=await fetch(uri,{signal:AbortSignal.timeout(12000),redirect:"follow",headers:{"accept":"text/html"}});
  const type=res.headers.get("content-type")||"";
  if(!res.ok||!type.includes("html")){console.log("DIRECT_SOURCE",host,"HTTP",res.status,"HTML",false);continue;}
  const html=(await res.text()).slice(0,200000);
  const normalized=html.toLowerCase();
  const nameMatch=normalized.includes("adizero")&&normalized.includes("evo");
  console.log("DIRECT_SOURCE",host,"HTTP",res.status,"HTML",true,"MODEL_VISIBLE",nameMatch,"BYTES_SAMPLED",html.length);
 }catch(error){console.log("DIRECT_SOURCE",host,"UNAVAILABLE",error instanceof Error?error.name:"error");}
}
console.log("DIRECT_SOURCE_CHECK_COMPLETE; site accessibility may change; this did not extract or store attributes.");
NODE
echo "=== THREE-SOURCE PILOT RESPONSE ==="
curl -fsS --max-time 15 "http://127.0.0.1:$port/api/product-knowledge/pilot/evo-sl" |
 node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s);if(!x.pilot||x.status!=="PRE_EXTRACTED_NOT_LIVE"||x.metrics.sourcePages!==3||x.metrics.conflictingFields<1)process.exit(1);console.log("PILOT_3_SOURCES_OK",x.metrics)})'
echo "=== PLAYWRIGHT PILOT ==="
export PLAYWRIGHT_BASE_URL="http://127.0.0.1:$port" PLAYWRIGHT_EXTERNAL_SERVER=true
npx playwright install chromium
npx playwright test --config=playwright.mission11-ai.config.ts --grep "laboratório de 3 fontes"
echo "EVO_SL_PILOT_UI_OK"
echo "Preview PORTS -> 5005 -> Open in Browser"
echo "No commercial writes, paid calls, or automatic live extraction."
