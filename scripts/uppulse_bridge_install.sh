#!/usr/bin/env bash
# One-time non-destructive install; the first manual command is unavoidable
# because GitHub repository access alone cannot run a terminal in Codespaces.
set -Eeuo pipefail
cd /workspaces/uppulse-homologacao/missao9/codigo
ref=origin/feat/uppulse-missao10-supercatalogo
target="$HOME/.local/share/uppulse-bridge"
# Separate locally held administrator upload token; never check into GitHub.
upload_token="$HOME/.local/share/uppulse/admin-upload.token"
mkdir -p -- "$(dirname "$upload_token")"
if [[ ! -s "$upload_token" ]];then
 umask 077
 openssl rand -hex 24 > "$upload_token"
fi
chmod 600 "$upload_token"
# Worktrees can use a .git FILE. Ask Git for the actual metadata directory.
git_dir="$(git rev-parse --absolute-git-dir 2>/dev/null)" || {
 echo "BRIDGE_GIT_METADATA_NOT_FOUND"; exit 2;
}
if [[ ! -d "$git_dir" ]]; then
 echo "BRIDGE_GIT_METADATA_INVALID"; exit 2
fi
state="$git_dir/uppulse-bridge"
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
old_checksum=""
if [[ -f "$target/uppulse_codespace_agent.py" ]]; then
 old_checksum="$(sha256sum "$target/uppulse_codespace_agent.py" | cut -d' ' -f1)"
fi
git show "$ref:scripts/uppulse_codespace_agent.py" > "$target/uppulse_codespace_agent.py.new"
python3 -m py_compile "$target/uppulse_codespace_agent.py.new"
new_checksum="$(sha256sum "$target/uppulse_codespace_agent.py.new" | cut -d' ' -f1)"
mv "$target/uppulse_codespace_agent.py.new" "$target/uppulse_codespace_agent.py"
git show "$ref:scripts/uppulse_bridge_ensure.sh" > "$target/uppulse_bridge_ensure.sh"
chmod u+x "$target/uppulse_bridge_ensure.sh"
# Recovery on next terminal attach. Does not claim to wake a stopped Codespace.
hook='[[ -f "$HOME/.local/share/uppulse-bridge/uppulse_bridge_ensure.sh" ]] && bash "$HOME/.local/share/uppulse-bridge/uppulse_bridge_ensure.sh" >/dev/null 2>&1 || true'
if ! grep -Fqx "$hook" "$HOME/.bashrc" 2>/dev/null; then
 printf '\n# UpPulse Codespaces bridge: restore on interactive terminal attach\n%s\n' "$hook" >> "$HOME/.bashrc"
fi
if [[ -f "$state/agent.pid" ]] && kill -0 "$(cat "$state/agent.pid")" 2>/dev/null; then
 pid="$(cat "$state/agent.pid")"
 if ! [[ "$pid" =~ ^[0-9]+$ ]] || ! grep -azFq "$target/uppulse_codespace_agent.py" "/proc/$pid/cmdline" 2>/dev/null; then
  echo "UPPULSE_BRIDGE_PROCESS_NOT_OWNED: refusing to stop unknown process";exit 2
 fi
 if [[ "$old_checksum" == "$new_checksum" ]]; then
  echo "UPPULSE_BRIDGE_ALREADY_RUNNING: pid $pid, installed version unchanged"
  echo "ADMIN_UPLOAD_TOKEN (cole apenas no formulário da Curadoria):"
  cat "$upload_token"
  exit 0
 fi
 echo "Updating bridge process only (not application previews)..."
 kill -TERM "$pid"
 for attempt in {1..20};do
  if ! kill -0 "$pid" 2>/dev/null;then break;fi
  sleep 0.2
 done
 if kill -0 "$pid" 2>/dev/null;then
  echo "UPPULSE_BRIDGE_OLD_PROCESS_STILL_RUNNING: no duplicate will be started";exit 2
 fi
fi
UPPULSE_BRIDGE_STATE_DIR="$state" nohup python3 -u "$target/uppulse_codespace_agent.py" >>"$state/bridge.log" 2>&1 </dev/null &
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
echo "ADMIN_UPLOAD_TOKEN (cole apenas no formulário da Curadoria):"
cat "$upload_token"
echo
echo "Recovery installed on terminal attach; stopped Codespace still requires opening the workspace; postStart rebuild hook not yet verified"
# Queue the isolated Curadoria preview without altering the existing 5013 service.
preview_sha="$(git rev-parse "$ref")"
preview_json="{\"commit\":\"$preview_sha\",\"port\":5014,\"profile\":\"basic\"}"
if gh issue create --repo edineilemes-source/beupfree --title "[UPPULSE-AGENT] PREVIEW" --body "$preview_json" >/dev/null;then
 echo "PREVIEW_5014_REQUESTED: Curadoria -> Feeds de parceiros (AWIN)"
else
 echo "PREVIEW_5014_NOT_QUEUED: bridge installed; create PREVIEW issue separately"
fi
