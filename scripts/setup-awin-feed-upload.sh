#!/usr/bin/env bash
# Configuração única da chave administrativa para upload de feeds no Codespaces.
# Nunca grava segredos no GitHub, em commits ou no banco de produtos.
set -euo pipefail
umask 077
target="$HOME/.local/share/uppulse/admin-upload.token"
mkdir -p -- "$(dirname "$target")"
if [ ! -f "$target" ]; then
  command -v openssl >/dev/null 2>&1 || { echo "OPENSSL_REQUIRED"; exit 1; }
  openssl rand -hex 24 > "$target"
fi
chmod 600 "$target"
echo "Chave administrativa de upload (copie para a tela da Curadoria):"
cat "$target"
echo
echo "Configuração concluída. Atualize a página Curadoria > Feeds de parceiros."
