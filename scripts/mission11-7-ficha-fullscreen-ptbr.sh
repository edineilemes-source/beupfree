#!/usr/bin/env bash
# Reconcile the existing real Evo SL V2 report offline. No Tavily/OpenAI calls.
set -Eeuo pipefail
cd /workspaces/uppulse-homologacao/missao9/codigo
ref=origin/feat/uppulse-missao10-supercatalogo
report=/tmp/uppulse-evo-sl-real-research-v2.json
if [[ ! -f "$report" ]]; then echo "V2_REPORT_NOT_FOUND: no paid calls will be made";exit 2;fi
sandbox=$(mktemp -d /tmp/uppulse-ficha-telacheia-XXXXXX)
git archive "$ref" | tar -x -C "$sandbox"
ln -s /workspaces/uppulse-homologacao/missao9/codigo/node_modules "$sandbox/node_modules"
cd "$sandbox"
echo "Source: $(git -C /workspaces/uppulse-homologacao/missao9/codigo rev-parse --short "$ref")"
echo "=== OFFLINE TYPESCRIPT AND UNIT TESTS ==="
npm run check
node --import tsx --test server/productIntelligence/customerKnowledge.test.ts server/productIntelligence/technicalPresentation.test.ts server/productIntelligence/technicalNormalization.test.ts server/productIntelligence/reportReconciliation.test.ts server/productIntelligence/superCatalog.test.ts server/productIntelligence/evoSlPilot.test.ts
echo "=== OFFLINE RECONCILIATION OF REAL V2 REPORT ==="
node --import tsx --input-type=module - <<'NODE'
import {readFile} from "node:fs/promises";
import {reconcileLiveReport} from "./server/productIntelligence/reportReconciliation.ts";
const report=JSON.parse(await readFile("/tmp/uppulse-evo-sl-real-research-v2.json","utf8"));
if(report.pilot!=="EVO_SL_LIVE_RESEARCH_V2")throw Error("NOT_V2_REPORT");
const result=reconcileLiveReport(report);
console.log("RECONCILIATION_METRICS",JSON.stringify(result.metrics));
for(const field of result.fields){
 console.log("FIELD",field.field,field.status);
 for(const group of field.agreements)console.log("  AGREEMENT",group.count,"sources:",group.value);
}
console.log("NO_API_CALLS_NO_DB_WRITES");
NODE
echo "=== PREVIEW RESULT IN FICHA (PORT 5010) ==="
if curl -fsS --max-time 3 http://127.0.0.1:5010/ >/dev/null 2>&1; then
  echo "PORT_5010_ALREADY_IN_USE: not modifying existing server"
  exit 0
fi
container=beupfree-catalog-pg17
if [[ "$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)" != "running" ]]; then
  echo "PREVIEW_DB_NOT_RUNNING; live research report saved and preserved"
  exit 0
fi
dbport=$(docker port "$container" 5432 | head -1 | sed -E 's/.*:([0-9]+)$/\1/')
if [[ ! "$dbport" =~ ^[0-9]+$ ]]; then
  echo "PREVIEW_DB_PORT_UNKNOWN; live research report saved and preserved"
  exit 0
fi
docker_env=$(docker inspect --format '{{json .Config.Env}}' "$container")
export DATABASE_URL=$(DOCKER_ENV="$docker_env" PG_HOST_PORT="$dbport" node - <<'NODE'
const env=Object.fromEntries(JSON.parse(process.env.DOCKER_ENV).map(x=>{const i=x.indexOf("=");return[x.slice(0,i),x.slice(i+1)]}));
if(!env.POSTGRES_PASSWORD)process.exit(1);
const url=new URL("postgresql://localhost");
url.username=env.POSTGRES_USER||"postgres";url.password=env.POSTGRES_PASSWORD;
url.port=process.env.PG_HOST_PORT;url.pathname="/uppulse_catalog";
process.stdout.write(url.toString());
NODE
)
export AWIN_CURATOR_DATABASE_URL="$DATABASE_URL"
export UPPULSE_PUBLIC_CATALOG_SOURCE=operational UPPULSE_PUBLIC_CATALOG_APPROVED=true
export UPPULSE_DISABLE_EXTERNAL_JOBS=true RESEARCH_PAID_ENABLED=false RESEARCH_POSTGRES_HOMOLOGATED=false PUBLIC_DEMO_MODE=false
export PORT=5010 NODE_ENV=development
unset TAVILY_API_KEY OPENAI_API_KEY
nohup npm run dev > "$sandbox/evo-sl-live-preview.log" 2>&1 </dev/null &
echo "$!" > "$sandbox/evo-sl-live-preview.pid"
ready=0
for attempt in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:5010/api/product-knowledge/pilot/live-evo-sl-v2 > /dev/null 2>&1; then ready=1; break;fi
  if ! kill -0 "$(cat "$sandbox/evo-sl-live-preview.pid")" 2>/dev/null;then break;fi
  sleep 1
done
if ((ready==1));then
  echo "LIVE_FICHA_READY: Codespaces PORTS -> 5010 -> Open in Browser"
  echo "Características do produto · Ficha inteligente -> Ver IA real — rodada 2"
  echo "=== BROWSER TEST: FULLSCREEN CARD, BRAZILIAN PORTUGUESE, METRIC UNITS AND AUDIT ==="
  PLAYWRIGHT_BASE_URL=http://127.0.0.1:5010 PLAYWRIGHT_EXTERNAL_SERVER=true npx playwright test --config=playwright.mission11-ai.config.ts --grep "ficha narrativa da IA real exibe citacoes discretas"
  echo "FICHA_TELA_CHEIA_PTBR_OK"
else
  echo "PREVIEW_NOT_READY; live report remains at /tmp/uppulse-evo-sl-real-research-v2.json"
  tail -25 "$sandbox/evo-sl-live-preview.log" | sed -E 's#(postgres(ql)?://)[^[:space:]]+#\1[REDACTED]#g' || true
fi
