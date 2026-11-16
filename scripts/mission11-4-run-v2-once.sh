#!/usr/bin/env bash
# One explicitly authorized *real* Tavily + OpenAI pilot, one model, max 1 + 3 API calls.
set -Eeuo pipefail
cd /workspaces/uppulse-homologacao/missao9/codigo
ref=origin/feat/uppulse-missao10-supercatalogo
if [[ -f /tmp/uppulse-evo-sl-real-research-v2.json ]]; then
  echo "LIVE_PILOT_ALREADY_EXECUTED: saved report /tmp/uppulse-evo-sl-real-research-v2.json"
  echo "To avoid unintended repeated charges, a new run requires separate review."
  exit 0
fi
if [[ -z "${TAVILY_API_KEY:-}" || -z "${OPENAI_API_KEY:-}" ]]; then
  echo "LIVE_PILOT_NEEDS_KEYS: Configure TAVILY_API_KEY and OPENAI_API_KEY as Codespaces secrets. Do not paste keys into chat or this command."
  echo "Tavily/OpenAI calls not started and no charge incurred by this script."
  exit 2
fi
sandbox=$(mktemp -d /tmp/uppulse-evo-sl-v2-src-XXXXXX)
git archive "$ref" | tar -x -C "$sandbox"
ln -s /workspaces/uppulse-homologacao/missao9/codigo/node_modules "$sandbox/node_modules"
cd "$sandbox"
echo "SOURCE $(git -C /workspaces/uppulse-homologacao/missao9/codigo rev-parse --short "$ref")"
echo "=== PRE-FLIGHT CHECKS BEFORE PAID APIS ==="
npm run check
node --import tsx --test server/productIntelligence/sourceSelection.test.ts server/productIntelligence/liveProvider.test.ts server/productIntelligence/research.test.ts
echo "=== REAL V2: MAX TWO TAVILY + THREE OPENAI ==="
if ! mkdir /tmp/uppulse-evo-sl-real-v2-attempted.lock 2>/dev/null; then
  echo "LIVE_PILOT_PREVIOUS_ATTEMPT_EXISTS: no duplicate paid calls."
  exit 2
fi
set +e
node --import tsx scripts/mission11-4-evo-sl-live-v2.ts --execute
pilot_exit=$?
set -e
if [[ ! -f /tmp/uppulse-evo-sl-real-research-v2.json ]]; then
 echo "V2_REPORT_MISSING: paid attempt failed before producing a report; do not automatically retry."
 exit "$pilot_exit"
fi
echo "LIVE_PILOT_FINISHED_REPORT /tmp/uppulse-evo-sl-real-research-v2.json"
echo "No commercial database writes. No HTML scraping, no mass research."
echo "V2_QUALITY_GATE $([[ $pilot_exit -eq 0 ]] && echo PASS || echo NOT_MET)"


echo "=== PREVIEW RESULT IN FICHA (PORT 5007) ==="
if curl -fsS --max-time 3 http://127.0.0.1:5007/ >/dev/null 2>&1; then
  echo "PORT_5007_ALREADY_IN_USE: not modifying existing server"
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
export PORT=5007 NODE_ENV=development
unset TAVILY_API_KEY OPENAI_API_KEY
nohup npm run dev > "$sandbox/evo-sl-live-preview.log" 2>&1 </dev/null &
echo "$!" > "$sandbox/evo-sl-live-preview.pid"
ready=0
for attempt in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:5007/api/product-knowledge/pilot/live-evo-sl-v2 > /dev/null 2>&1; then ready=1; break;fi
  if ! kill -0 "$(cat "$sandbox/evo-sl-live-preview.pid")" 2>/dev/null;then break;fi
  sleep 1
done
if ((ready==1));then
  echo "LIVE_FICHA_READY: Codespaces PORTS -> 5007 -> Open in Browser"
  echo "Ficha inteligente e fornecedores -> Ver IA real — rodada 2"
else
  echo "PREVIEW_NOT_READY; live report remains at /tmp/uppulse-evo-sl-real-research-v2.json"
  tail -25 "$sandbox/evo-sl-live-preview.log" | sed -E 's#(postgres(ql)?://)[^[:space:]]+#\1[REDACTED]#g' || true
fi
