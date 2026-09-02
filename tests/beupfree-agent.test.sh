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
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$@" > "%s/codex-args"\ncat > "%s/codex-stdin"\n' "$FIXTURE" "$FIXTURE" > "$mock_bin/codex"
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

printf '1..%s\n' "$((PASS + FAIL))"
printf 'passed=%s failed=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
