#!/usr/bin/env bash
# Reuse completed paid pilot report; no new external calls, no database changes.
set -Eeuo pipefail
cd /workspaces/uppulse-homologacao/missao9/codigo
ref=origin/feat/uppulse-missao10-supercatalogo
report=/tmp/uppulse-evo-sl-real-research.json
if [[ ! -f "$report" ]]; then
 echo "LIVE_PILOT_REPORT_MISSING: no paid calls will be made"; exit 2
fi
echo "=== REAL RESEARCH EVIDENCE (NO NEW API CALLS) ==="
node --input-type=module - <<'NODE'
import {readFile} from "node:fs/promises";
const report=JSON.parse(await readFile("/tmp/uppulse-evo-sl-real-research.json","utf8"));
if(report.pilot!=="EVO_SL_LIVE_RESEARCH_V1"||report.live!==true)throw Error("INVALID_LIVE_REPORT");
console.log("status",report.status,"sources with evidence",report.sourceCount,"domains selected",report.distinctDomains);
console.log("queries reserved",JSON.stringify(report.requestsReserved));
for(const source of report.candidateSources??[])console.log("TAVILY_CANDIDATE",source.eligible?"MATCH":"SKIP",source.title,source.url);
for(const f of report.fields??[])console.log("EXTRACTED",f.field,JSON.stringify(f.value),"status",f.status,"references",(f.sources??[]).map(s=>s.url).join(" "));
if(report.sourceCount<2)console.log("RESEARCH_QUALITY_GATE_NOT_MET: evidence from two independent sources is required.");
NODE
echo "=== PREPARING SEPARATE PREVIEW ==="
sandbox=$(mktemp -d /tmp/uppulse-evo-sl-report-preview-XXXXXX)
git archive "$ref" | tar -x -C "$sandbox"
ln -s /workspaces/uppulse-homologacao/missao9/codigo/node_modules "$sandbox/node_modules"
cd "$sandbox"
echo "Source: $(git -C /workspaces/uppulse-homologacao/missao9/codigo rev-parse --short "$ref")"
echo "=== PREVIEW RESULT IN FICHA (PORT 5006) ==="
if curl -fsS --max-time 3 http://127.0.0.1:5006/ >/dev/null 2>&1; then
  echo "PORT_5006_ALREADY_IN_USE: not modifying existing server"
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
export PORT=5006 NODE_ENV=development
unset TAVILY_API_KEY OPENAI_API_KEY
nohup npm run dev > "$sandbox/evo-sl-live-preview.log" 2>&1 </dev/null &
echo "$!" > "$sandbox/evo-sl-live-preview.pid"
ready=0
for attempt in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:5006/api/product-knowledge/pilot/live-evo-sl > /dev/null 2>&1; then ready=1; break;fi
  if ! kill -0 "$(cat "$sandbox/evo-sl-live-preview.pid")" 2>/dev/null;then break;fi
  sleep 1
done
if ((ready==1));then
  echo "LIVE_FICHA_READY: Codespaces PORTS -> 5006 -> Open in Browser"
  echo "Ficha inteligente e fornecedores -> Ver resultado da IA real"
else
  echo "PREVIEW_NOT_READY; live report remains at /tmp/uppulse-evo-sl-real-research.json"
  tail -25 "$sandbox/evo-sl-live-preview.log" | sed -E 's#(postgres(ql)?://)[^[:space:]]+#\1[REDACTED]#g' || true
fi
