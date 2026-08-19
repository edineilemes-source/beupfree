#!/usr/bin/env bash
set -Eeuo pipefail

readonly EXPECTED_BRANCH="codespace-working"
readonly PORT="5000"
readonly LISTEN_TIMEOUT_SECONDS="30"
readonly HTTP_TIMEOUT_SECONDS="15"
readonly DATABASE_TIMEOUT_MILLISECONDS="10000"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR"

current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "$EXPECTED_BRANCH" ]]; then
  echo "❌ Branch atual: ${current_branch:-desconhecida}. Esperada: $EXPECTED_BRANCH." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "❌ Arquivo .env ausente em $SCRIPT_DIR." >&2
  exit 1
fi

# Use o mesmo parser nativo do Node empregado para iniciar a aplicação. Assim o
# .env não é executado como código shell e valores já exportados têm precedência.
set +e
node --env-file=.env -e '
  const value = process.env.DATABASE_URL;
  if (!value) process.exit(2);
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      process.exit(3);
    }
  } catch {
    process.exit(3);
  }
' >/dev/null 2>&1
database_url_status=$?
set -e

case "$database_url_status" in
  0) ;;
  2)
    echo "❌ DATABASE_URL ausente. Configure-a no .env." >&2
    exit 1
    ;;
  3)
    echo "❌ DATABASE_URL incompatível. O UpPulse requer PostgreSQL." >&2
    exit 1
    ;;
  *)
    echo "❌ Não foi possível carregar o arquivo .env com o Node.js." >&2
    exit 1
    ;;
esac

echo "🔎 Verificando conectividade com o PostgreSQL remoto..."
if ! DATABASE_CONNECTION_TIMEOUT_MS="$DATABASE_TIMEOUT_MILLISECONDS" \
  node --env-file=.env --input-type=module -e '
    import pg from "pg";
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS),
      max: 1,
    });
    try {
      await pool.query("SELECT 1");
    } finally {
      await pool.end();
    }
  ' >/dev/null 2>&1; then
  echo "❌ PostgreSQL remoto inacessível. Verifique DATABASE_URL, rede e disponibilidade do provedor." >&2
  exit 1
fi

port_listener() {
  ss -ltnp 2>/dev/null | grep -E "(^|[[:space:]])(0\.0\.0\.0|\*):${PORT}([[:space:]]|$)" || true
}

any_port_listener() {
  ss -ltnp 2>/dev/null | grep -E "[.:]${PORT}([[:space:]]|$)" || true
}

port_is_listening() {
  [[ -n "$(any_port_listener)" ]]
}

public_port_is_listening() {
  [[ -n "$(port_listener)" ]]
}

http_status() {
  curl --silent --show-error --head --output /dev/null \
    --write-out '%{http_code}' --max-time 3 "http://localhost:${PORT}" 2>/dev/null || true
}

print_ready() {
  echo
  echo "✅ UpPulse pronto para uso"
  echo
  echo "📦 PostgreSQL remoto: OK"
  echo "🌐 Porta 0.0.0.0:${PORT}: LISTEN"
  echo "❤️ HTTP: 200 OK"
  echo
  echo "Preview:"
  echo "PORTS → ${PORT} → Open in Browser"
}

if port_is_listening; then
  echo "ℹ️ Processo encontrado na porta ${PORT}:"
  any_port_listener
  if public_port_is_listening && [[ "$(http_status)" == "200" ]]; then
    echo "ℹ️ UpPulse já está rodando na porta ${PORT}."
    print_ready
    exit 0
  fi

  echo "❌ Porta ${PORT} ocupada, mas o processo não respondeu com HTTP 200." >&2
  echo "   Resolva o conflito sem encerrar processos automaticamente." >&2
  exit 1
fi

app_pid=""
cleanup() {
  local exit_status=$?
  trap - EXIT INT TERM
  if [[ -n "$app_pid" ]] && kill -0 "$app_pid" 2>/dev/null; then
    kill "$app_pid" 2>/dev/null || true
    wait "$app_pid" 2>/dev/null || true
  fi
  exit "$exit_status"
}
trap cleanup EXIT INT TERM

echo "🌐 Subindo UpPulse na porta ${PORT}..."
node --env-file=.env ./node_modules/.bin/tsx server/index-dev.ts &
app_pid=$!

listen_deadline=$((SECONDS + LISTEN_TIMEOUT_SECONDS))
while ! port_is_listening; do
  if ! kill -0 "$app_pid" 2>/dev/null; then
    wait "$app_pid" || true
    echo "❌ UpPulse encerrou antes de abrir a porta ${PORT}." >&2
    exit 1
  fi
  if (( SECONDS >= listen_deadline )); then
    echo "❌ UpPulse não abriu a porta ${PORT}." >&2
    exit 1
  fi
  sleep 1
done

if ! public_port_is_listening; then
  echo "❌ UpPulse abriu a porta ${PORT}, mas não está ouvindo em 0.0.0.0:${PORT}." >&2
  exit 1
fi

http_deadline=$((SECONDS + HTTP_TIMEOUT_SECONDS))
while [[ "$(http_status)" != "200" ]]; do
  if ! kill -0 "$app_pid" 2>/dev/null; then
    wait "$app_pid" || true
    echo "❌ Porta ${PORT} abriu, mas o UpPulse encerrou antes de responder." >&2
    exit 1
  fi
  if (( SECONDS >= http_deadline )); then
    echo "❌ Porta ${PORT} está aberta, mas o UpPulse não respondeu corretamente." >&2
    exit 1
  fi
  sleep 1
done

print_ready
echo
echo "Mantenha este terminal aberto. Pressione Ctrl+C para encerrar o UpPulse."

wait "$app_pid"
