#!/usr/bin/env bash
# Check the existing 5005 pilot without Docker restart or paid research.
set -Eeuo pipefail
checkout=/workspaces/uppulse-homologacao/missao9/codigo
cd "$checkout"
ref=origin/feat/uppulse-missao10-supercatalogo
port=5005
curl -fsS --max-time 8 "http://127.0.0.1:$port/api/product-knowledge/pilot/evo-sl" |
 node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s);if(x.status!=="PRE_EXTRACTED_NOT_LIVE"||x.metrics?.sourcePages!==3)process.exit(1);console.log("PILOT_API_READY sources="+x.metrics.sourcePages+" fields="+x.metrics.fields)})'
sandbox=$(mktemp -d /tmp/uppulse-evo-sl-ui-check-XXXXXX)
git archive "$ref" | tar -x -C "$sandbox"
ln -s "$checkout/node_modules" "$sandbox/node_modules"
cd "$sandbox"
echo "Testing UI against existing port 5005; source: $(git -C "$checkout" rev-parse --short "$ref")"
export PLAYWRIGHT_BASE_URL="http://127.0.0.1:$port" PLAYWRIGHT_EXTERNAL_SERVER=true
npx playwright test --config=playwright.mission11-ai.config.ts --grep "ficha inteligente abre piloto de tres fontes"
echo "EVO_SL_PILOT_UI_OK"
echo "Open Codespaces port 5005 in browser."
