#!/usr/bin/env bash
# One explicitly authorized *real* Tavily + OpenAI pilot, one model, max 1 + 3 API calls.
set -Eeuo pipefail
cd /workspaces/uppulse-homologacao/missao9/codigo
ref=origin/feat/uppulse-missao10-supercatalogo
if [[ -f /tmp/uppulse-evo-sl-real-research.json ]]; then
  echo "LIVE_PILOT_ALREADY_EXECUTED: saved report /tmp/uppulse-evo-sl-real-research.json"
  echo "To avoid unintended repeated charges, a new run requires separate review."
  exit 0
fi
if [[ -z "${TAVILY_API_KEY:-}" || -z "${OPENAI_API_KEY:-}" ]]; then
  echo "LIVE_PILOT_NEEDS_KEYS: Configure TAVILY_API_KEY and OPENAI_API_KEY as Codespaces secrets. Do not paste keys into chat or this command."
  echo "Tavily/OpenAI calls not started and no charge incurred by this script."
  exit 2
fi
sandbox=$(mktemp -d /tmp/uppulse-evo-sl-live-src-XXXXXX)
git archive "$ref" | tar -x -C "$sandbox"
ln -s /workspaces/uppulse-homologacao/missao9/codigo/node_modules "$sandbox/node_modules"
cd "$sandbox"
echo "SOURCE $(git -C /workspaces/uppulse-homologacao/missao9/codigo rev-parse --short "$ref")"
echo "=== TYPECHECK BEFORE ANY API CALL ==="
npm run check
echo "=== ONE-SHOT REAL TAVILY + OPENAI ==="
if ! mkdir /tmp/uppulse-evo-sl-live-attempted.lock 2>/dev/null; then
  echo "LIVE_PILOT_PREVIOUS_ATTEMPT_EXISTS: no duplicate paid calls."
  exit 2
fi
node --import tsx scripts/mission11-3-evo-sl-live-research.ts --execute
echo "LIVE_PILOT_FINISHED_REPORT /tmp/uppulse-evo-sl-real-research.json"
echo "No commercial database writes. No HTML scraping, no mass research."
