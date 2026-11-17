#!/usr/bin/env bash
# One-time non-destructive install; the first manual command is unavoidable
# because GitHub repository access alone cannot run a terminal in Codespaces.
set -Eeuo pipefail
cd /workspaces/uppulse-homologacao/missao9/codigo
ref=origin/feat/uppulse-missao10-supercatalogo
target="$HOME/.local/share/uppulse-bridge"
state="$HOME/.local/state/uppulse-bridge"
mkdir -p "$target" "$state"
if ! command -v gh >/dev/null || ! command -v python3 >/dev/null; then
 echo "BRIDGE_NEEDS_GH_AND_PYTHON3: no changes made to running services";exit 2
fi
if ! gh auth status >/dev/null 2>&1; then
 echo "BRIDGE_GH_NOT_AUTHENTICATED: sign into gh in Codespaces first";exit 2
fi
git show "$ref:scripts/uppulse_bridge_doctor.py" > "$target/uppulse_bridge_doctor.py"
echo "=== AGENT DEPENDENCY AND VERSION PREFLIGHT ==="
python3 "$target/uppulse_bridge_doctor.py"
git show "$ref:scripts/uppulse_codespace_agent.py" > "$target/uppulse_codespace_agent.py"
python3 -m py_compile "$target/uppulse_codespace_agent.py"
if [[ -f "$state/agent.pid" ]] && kill -0 "$(cat "$state/agent.pid")" 2>/dev/null; then
 echo "UPPULSE_BRIDGE_ALREADY_RUNNING: pid $(cat "$state/agent.pid")"
 echo "Existing agent not replaced in memory. Revalidate its version before new tasks."
 echo "No running app ports were touched"
 exit 0
fi
nohup python3 -u "$target/uppulse_codespace_agent.py" >>"$state/bridge.log" 2>&1 </dev/null &
echo "$!" > "$state/agent.pid"
sleep 3
if ! kill -0 "$(cat "$state/agent.pid")" 2>/dev/null;then
 echo "UPPULSE_BRIDGE_START_FAILED: inspect $state/bridge.log"
 exit 2
fi
if ! tail -20 "$state/bridge.log" | grep -q UPPULSE_BRIDGE_READY;then
 echo "UPPULSE_BRIDGE_PENDING: check log $state/bridge.log"
 exit 2
fi
echo "UPPULSE_BRIDGE_READY: GitHub Issues queue active (after dependency preflight)"
echo "Actions: STATUS, VALIDAR, PREVIEW (5011-5015), PARAR PREVIEW"
echo "No catalog writes, no port shutdowns, no reset/checkout/commit/push"
echo "This process survives terminal closure, but not a stopped/rebuilt Codespace without startup hooks"
