#!/usr/bin/env bash
set -u

SOURCE_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
PASS=0
FAIL=0
TEMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/beupfree-agent-tests.XXXXXX") || exit 1
trap 'rm -rf "$TEMP_ROOT"' EXIT

pass() { PASS=$((PASS + 1)); printf 'ok - %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf 'not ok - %s\n' "$1"; }
assert_success() { name=$1; shift; if "$@" >"$TEMP_ROOT/out" 2>"$TEMP_ROOT/err"; then pass "$name"; else fail "$name"; sed -n '1,20p' "$TEMP_ROOT/err"; fi; }
assert_failure() { name=$1; shift; if "$@" >"$TEMP_ROOT/out" 2>"$TEMP_ROOT/err"; then fail "$name"; else pass "$name"; fi; }

make_fixture() {
  fixture=$(mktemp -d "$TEMP_ROOT/repo.XXXXXX") || exit 1
  git -C "$fixture" init -q -b devai001-agent-workflow
  mkdir -p "$fixture/.ai" "$fixture/tests"
  cp "$SOURCE_ROOT/beupfree-agent" "$fixture/beupfree-agent"
  printf '# Rules\n' > "$fixture/AGENTS.md"
  printf '# State\n' > "$fixture/.ai/PROJECT_STATE.md"
  printf '# Decisions\n' > "$fixture/.ai/DECISIONS.md"
  printf '# Mission\n```yaml\nmission_id: TEST001\ntitle: "Fixture mission"\nstatus: PENDING\nexpected_branch: devai001-agent-workflow\nobjective: "Exercise the local executor"\n```\n' > "$fixture/.ai/CURRENT_MISSION.md"
  printf '# Report\n```yaml\nmission_id: PREVIOUS\nfinal_status: COMPLETED\n```\n' > "$fixture/.ai/CODEX_REPORT.md"
  printf '# Next\n```yaml\nrecommended_next_mission: "Review fixture"\n```\n' > "$fixture/.ai/NEXT_ACTION.md"
  FIXTURE=$fixture
}

install_contract_mock() {
  mode=$1
  mock_bin="$FIXTURE/mock-bin"
  mkdir "$mock_bin"
  printf '%s\n' \
    '#!/usr/bin/env bash' \
    'cat >/dev/null' \
    '[ "$MOCK_MODE" = codex-error ] && exit 23' \
    'mission_status=COMPLETED' \
    'report_mission=TEST001' \
    'report_status=COMPLETED' \
    'next_mission=TEST001' \
    '[ "$MOCK_MODE" = non-terminal ] && mission_status=IN_PROGRESS' \
    '[ "$MOCK_MODE" = report-mission-mismatch ] && report_mission=OTHER' \
    '[ "$MOCK_MODE" = status-mismatch ] && report_status=FAILED' \
    '[ "$MOCK_MODE" = next-mismatch ] && next_mission=OTHER' \
    'sed -i "s/status: PENDING/status: $mission_status/" "$MOCK_FIXTURE/.ai/CURRENT_MISSION.md"' \
    "printf '%s\\n' '# Report' '\`\`\`yaml' \"mission_id: \$report_mission\" \"final_status: \$report_status\" '\`\`\`' > \"\$MOCK_FIXTURE/.ai/CODEX_REPORT.md\"" \
    "printf '%s\\n' '# Next' '\`\`\`yaml' \"originating_mission: \$next_mission\" 'recommended_next_mission: \"NONE — no next mission\"' '\`\`\`' > \"\$MOCK_FIXTURE/.ai/NEXT_ACTION.md\"" \
    > "$mock_bin/codex"
  chmod +x "$mock_bin/codex"
  MOCK_MODE=$mode
}

install_gh_mock() {
  mode=$1
  mock_bin="$FIXTURE/mock-bin"
  mkdir -p "$mock_bin"
  printf '%s\n' \
    '#!/usr/bin/env bash' \
    'if [ "$1" = auth ]; then [ "$GH_MOCK_MODE" != unauthenticated ]; exit; fi' \
    'if [ "$1" = api ]; then' \
    '  [ "$GH_MOCK_MODE" = network-error ] && exit 1' \
    '  case "$*" in' \
    '    *author_association*) [ "$GH_MOCK_MODE" = untrusted ] && printf "CONTRIBUTOR\n" || printf "OWNER\n" ;;' \
    '    *comments*) [ -f "$MOCK_FIXTURE/existing-comment" ] && cat "$MOCK_FIXTURE/existing-comment" ;;' \
    '    *) cat "$MOCK_FIXTURE/remote-body" ;;' \
    '  esac' \
    '  exit 0' \
    'fi' \
    'if [ "$1" = issue ] && [ "$2" = comment ]; then' \
    '  [ "$GH_MOCK_MODE" = publish-error ] && exit 1' \
    '  while [ "$#" -gt 0 ]; do [ "$1" = --body-file ] && { cp "$2" "$MOCK_FIXTURE/published-body"; exit 0; }; shift; done' \
    'fi' \
    'exit 1' > "$mock_bin/gh"
  chmod +x "$mock_bin/gh"
  GH_MOCK_MODE=$mode
}

write_remote_mission() {
  mission=${1:-REMOTE001}
  printf '%s\n' \
    '<!-- BEUPFREE_AGENT:MISSION:v1 -->' \
    '# Remote mission' \
    '```yaml' \
    "mission_id: $mission" \
    'title: "Remote fixture"' \
    'status: PENDING' \
    'expected_branch: devai001-agent-workflow' \
    'objective: "Treat this as mission data"' \
    '```' \
    '<!-- /BEUPFREE_AGENT:MISSION -->' > "$FIXTURE/remote-body"
}

make_fixture
assert_success 'status' "$FIXTURE/beupfree-agent" status
grep -q 'mission_id: TEST001' "$TEMP_ROOT/out" && pass 'status shows mission' || fail 'status shows mission'
assert_success 'valid check' "$FIXTURE/beupfree-agent" check

make_fixture
rm "$FIXTURE/.ai/DECISIONS.md"
assert_failure 'missing required file' "$FIXTURE/beupfree-agent" check

make_fixture
sed -i 's/status: PENDING/status: UNKNOWN/' "$FIXTURE/.ai/CURRENT_MISSION.md"
assert_failure 'invalid status' "$FIXTURE/beupfree-agent" check

make_fixture
sed -i 's/status: PENDING/status: COMPLETED/' "$FIXTURE/.ai/CURRENT_MISSION.md"
assert_failure 'COMPLETED mission refused' "$FIXTURE/beupfree-agent" run --dry-run

make_fixture
mock_bin="$FIXTURE/mock-bin"
mkdir "$mock_bin"
printf '#!/usr/bin/env bash\ntouch "%s/codex-called"\n' "$FIXTURE" > "$mock_bin/codex"
chmod +x "$mock_bin/codex"
if PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" run --dry-run >"$TEMP_ROOT/out" 2>"$TEMP_ROOT/err" && [ ! -e "$FIXTURE/codex-called" ]; then pass 'dry-run does not call Codex'; else fail 'dry-run does not call Codex'; fi

make_fixture
mock_bin="$FIXTURE/mock-bin"
mkdir "$mock_bin"
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$@" > "%s/codex-args"\ncat > "%s/codex-stdin"\nsed -i "s/status: PENDING/status: COMPLETED/" "%s/.ai/CURRENT_MISSION.md"\nprintf "# Report\\n\\`\\`\\`yaml\\nmission_id: TEST001\\nfinal_status: COMPLETED\\n\\`\\`\\`\\n" > "%s/.ai/CODEX_REPORT.md"\nprintf "# Next\\n\\`\\`\\`yaml\\noriginating_mission: TEST001\\nrecommended_next_mission: NONE\\n\\`\\`\\`\\n" > "%s/.ai/NEXT_ACTION.md"\n' "$FIXTURE" "$FIXTURE" "$FIXTURE" "$FIXTURE" "$FIXTURE" > "$mock_bin/codex"
chmod +x "$mock_bin/codex"
if PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" run >"$TEMP_ROOT/out" 2>"$TEMP_ROOT/err" && \
   grep -qxF 'exec' "$FIXTURE/codex-args" && \
   grep -qxF -- '--sandbox' "$FIXTURE/codex-args" && \
   grep -qxF 'workspace-write' "$FIXTURE/codex-args" && \
   grep -qxF -- '-C' "$FIXTURE/codex-args" && \
   grep -qxF "$FIXTURE" "$FIXTURE/codex-args" && \
   grep -qxF -- '-' "$FIXTURE/codex-args" && \
   ! grep -q -- '--ask-for-approval' "$FIXTURE/codex-args" && \
   grep -q 'Follow AGENTS.md and CURRENT_MISSION.md exactly' "$FIXTURE/codex-stdin" && \
   grep -q 'mission_id: TEST001' "$FIXTURE/codex-stdin"; then
  pass 'run invokes current Codex CLI interface with context on stdin'
else
  fail 'run invokes current Codex CLI interface with context on stdin'
fi

make_fixture
install_contract_mock valid
assert_success 'valid output contract' env MOCK_MODE="$MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" run
[ ! -d "$FIXTURE/.ai/locks/TEST001.lock" ] && pass 'lock released after valid output' || fail 'lock released after valid output'

make_fixture
install_contract_mock non-terminal
assert_failure 'non-terminal mission rejected after Codex success' env MOCK_MODE="$MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" run
grep -q 'CURRENT_MISSION status is not terminal' "$TEMP_ROOT/err" && pass 'non-terminal error is clear' || fail 'non-terminal error is clear'

make_fixture
install_contract_mock report-mission-mismatch
assert_failure 'report mission_id mismatch rejected' env MOCK_MODE="$MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" run

make_fixture
install_contract_mock status-mismatch
assert_failure 'report status mismatch rejected' env MOCK_MODE="$MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" run

make_fixture
install_contract_mock next-mismatch
assert_failure 'next action mission mismatch rejected' env MOCK_MODE="$MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" run

make_fixture
install_contract_mock codex-error
env MOCK_MODE="$MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" run >"$TEMP_ROOT/out" 2>"$TEMP_ROOT/err"
result=$?
if [ "$result" -eq 23 ] && ! grep -q 'output contract' "$TEMP_ROOT/err"; then pass 'Codex nonzero status propagated'; else fail 'Codex nonzero status propagated'; fi
[ ! -d "$FIXTURE/.ai/locks/TEST001.lock" ] && pass 'lock released after Codex error' || fail 'lock released after Codex error'

make_fixture
mock_bin="$FIXTURE/mock-bin"
mkdir "$mock_bin"
printf '#!/usr/bin/env bash\ncat >/dev/null\nsleep 3\n' > "$mock_bin/codex"
chmod +x "$mock_bin/codex"
PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" run >"$TEMP_ROOT/first.out" 2>"$TEMP_ROOT/first.err" &
first_pid=$!
for unused in 1 2 3 4 5 6 7 8 9 10; do [ -d "$FIXTURE/.ai/locks/TEST001.lock" ] && break; sleep 0.1; done
if PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" run >"$TEMP_ROOT/out" 2>"$TEMP_ROOT/err"; then fail 'duplicate lock refused'; else pass 'duplicate lock refused'; fi
wait "$first_pid"

make_fixture
if PATH="/usr/bin:/bin" "$FIXTURE/beupfree-agent" run >"$TEMP_ROOT/out" 2>"$TEMP_ROOT/err"; then
  fail 'missing Codex handled'
elif grep -q 'Codex CLI is not installed' "$TEMP_ROOT/err"; then
  pass 'missing Codex handled'
else
  fail 'missing Codex handled'
fi

make_fixture
printf '\nDATABASE_URL=postgres://user:secret-password@example/db\napi_token: TOP_SECRET_SENTINEL\naffiliate_url: https://example.test/private/full\n' >> "$FIXTURE/.ai/DECISIONS.md"
if "$FIXTURE/beupfree-agent" context >"$TEMP_ROOT/out" 2>"$TEMP_ROOT/err" && \
   ! grep -q 'TOP_SECRET_SENTINEL\|secret-password\|DATABASE_URL\|https://example.test/private/full' "$TEMP_ROOT/out"; then
  pass 'secrets are redacted from context'
else
  fail 'secrets are redacted from context'
fi

make_fixture
install_gh_mock valid
write_remote_mission
printf '\ntouch "%s/remote-command-ran"\n' "$FIXTURE" >> "$FIXTURE/remote-body"
assert_success 'sync accepts authorized structured mission' env GH_MOCK_MODE="$GH_MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" sync --issue 42
grep -q 'mission_id: REMOTE001' "$FIXTURE/.ai/CURRENT_MISSION.md" && [ ! -e "$FIXTURE/remote-command-ran" ] && pass 'remote content is data, never shell' || fail 'remote content is data, never shell'

make_fixture
install_gh_mock valid
printf 'malformed remote body\n' > "$FIXTURE/remote-body"
assert_failure 'malformed remote mission rejected' env GH_MOCK_MODE="$GH_MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" sync --issue 42

make_fixture
install_gh_mock valid
write_remote_mission
sed -i 's/devai001-agent-workflow/wrong-branch/' "$FIXTURE/remote-body"
assert_failure 'remote branch mismatch rejected' env GH_MOCK_MODE="$GH_MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" sync --issue 42

make_fixture
install_gh_mock unauthenticated
write_remote_mission
assert_failure 'missing GitHub authentication fails safely' env GH_MOCK_MODE="$GH_MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" sync --issue 42

make_fixture
install_gh_mock untrusted
write_remote_mission
assert_failure 'untrusted Issue author rejected' env GH_MOCK_MODE="$GH_MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" sync --issue 42

make_fixture
install_gh_mock valid
sed -i 's/status: PENDING/status: COMPLETED/' "$FIXTURE/.ai/CURRENT_MISSION.md"
printf '# Report\n```yaml\nmission_id: TEST001\nfinal_status: COMPLETED\nsummary: "safe"\napi_token: NEVER_PUBLISH_ME\n```\n' > "$FIXTURE/.ai/CODEX_REPORT.md"
printf '# Next\n```yaml\noriginating_mission: TEST001\nrecommended_next_mission: "Review"\n```\n' > "$FIXTURE/.ai/NEXT_ACTION.md"
assert_success 'publish sends sanitized terminal result' env GH_MOCK_MODE="$GH_MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" publish --issue 42
if grep -q 'BEUPFREE_AGENT:REPORT:v1 mission_id=TEST001' "$FIXTURE/published-body" && ! grep -q NEVER_PUBLISH_ME "$FIXTURE/published-body"; then pass 'published body is marked and sanitized'; else fail 'published body is marked and sanitized'; fi

make_fixture
install_gh_mock valid
sed -i 's/status: PENDING/status: COMPLETED/' "$FIXTURE/.ai/CURRENT_MISSION.md"
printf '# Report\n```yaml\nmission_id: TEST001\nfinal_status: COMPLETED\n```\n' > "$FIXTURE/.ai/CODEX_REPORT.md"
printf '# Next\n```yaml\noriginating_mission: TEST001\nrecommended_next_mission: "Review"\n```\n' > "$FIXTURE/.ai/NEXT_ACTION.md"
printf '<!-- BEUPFREE_AGENT:REPORT:v1 mission_id=TEST001 -->\n' > "$FIXTURE/existing-comment"
assert_success 'publish is idempotent for mission_id' env GH_MOCK_MODE="$GH_MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" publish --issue 42
[ ! -e "$FIXTURE/published-body" ] && pass 'idempotent publish creates no comment' || fail 'idempotent publish creates no comment'

make_fixture
install_gh_mock network-error
write_remote_mission
assert_failure 'GitHub network failure preserves local mission' env GH_MOCK_MODE="$GH_MOCK_MODE" MOCK_FIXTURE="$FIXTURE" PATH="$mock_bin:/usr/bin:/bin" "$FIXTURE/beupfree-agent" sync --issue 42
grep -q 'mission_id: TEST001' "$FIXTURE/.ai/CURRENT_MISSION.md" && pass 'network failure leaves mission unchanged' || fail 'network failure leaves mission unchanged'

printf '1..%s\n' "$((PASS + FAIL))"
printf 'passed=%s failed=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
