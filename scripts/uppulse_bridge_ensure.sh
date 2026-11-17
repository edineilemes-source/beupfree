#!/usr/bin/env bash
# Restart bridge when an interactive Codespaces shell opens.
# Never modifies Git checkout or application servers.
set -Eeuo pipefail
root=/workspaces/uppulse-homologacao/missao9/codigo
agent="$HOME/.local/share/uppulse-bridge/uppulse_codespace_agent.py"
[[ -d "$root" && -f "$agent" ]] || exit 0
gitdir="$(git -C "$root" rev-parse --absolute-git-dir 2>/dev/null)" || exit 0
state="$gitdir/uppulse-bridge"
mkdir -p "$state"
pidfile="$state/agent.pid"
if [[ -f "$pidfile" ]]; then
 pid="$(cat "$pidfile")"
 if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
  if tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null | grep -Fq "$agent"; then
   exit 0
  fi
  exit 2
 fi
fi
command -v gh >/dev/null || exit 0
gh auth status >/dev/null 2>&1 || exit 0
UPPULSE_BRIDGE_STATE_DIR="$state" nohup python3 -u "$agent" >>"$state/bridge.log" 2>&1 </dev/null &
echo "$!" > "$pidfile"
