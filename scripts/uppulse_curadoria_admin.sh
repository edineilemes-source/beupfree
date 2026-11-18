#!/usr/bin/env bash
# Configura acesso à Curadoria usando uma conta já existente no banco homologado.
# Somente SELECT no PostgreSQL; não altera produtos, ofertas, sessões nem tabelas.
set -Eeuo pipefail
container=beupfree-catalog-pg17
if [[ "$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)" != running ]];then
 echo "BLOQUEADO: PostgreSQL homologado não está ativo. Nada foi modificado."
 exit 2
fi
database=""
for candidate in uppulse_catalog postgres;do
 counts="$(docker exec "$container" sh -c 'exec psql -U "${POSTGRES_USER:-postgres}" -d "$1" -X -A -t -v ON_ERROR_STOP=1 -c "SELECT (SELECT count(*) FROM public.products), (SELECT count(*) FROM public.offers)"' sh "$candidate" 2>/dev/null || true)"
 if [[ "$counts" =~ ^([0-9]+)\|([0-9]+)$ ]] && (( ${BASH_REMATCH[1]} >= 1000 && ${BASH_REMATCH[2]} >= 1000 ));then
  if [[ -n "$database" ]];then echo "BLOQUEADO: mais de um banco homologado encontrado.";exit 2;fi
  database="$candidate"
 fi
done
if [[ -z "$database" ]];then echo "BLOQUEADO: não foi encontrado catálogo homologado.";exit 2;fi
mapfile -t accounts < <(
 docker exec "$container" sh -c 'exec psql -U "${POSTGRES_USER:-postgres}" -d "$1" -X -A -t -F "|" -v ON_ERROR_STOP=1 -c "SELECT id,email FROM public.users WHERE is_active=true ORDER BY lower(email)"' sh "$database"
)
if (( ${#accounts[@]} == 0 ));then
 echo "Não há contas ativas cadastradas no UpPulse. Cadastre a conta pelo site primeiro."
 exit 2
fi
echo "=== Contas ativas no UpPulse (escolha a sua) ==="
for i in "${!accounts[@]}";do
 IFS='|' read -r id email <<< "${accounts[i]}"
 printf '%d) %s\n' "$((i+1))" "$email"
done
echo "0) Cancelar"
choice=""
while [[ ! "$choice" =~ ^[0-9]+$ ]] || (( choice < 0 || choice > ${#accounts[@]} ));do
 if ! read -r -p "Número da sua conta: " choice </dev/tty;then
  echo "Terminal interativo indisponível; execute o instalador diretamente no terminal."
  exit 2
 fi
done
if ((choice==0));then echo "Cancelado sem alterações.";exit 0;fi
IFS='|' read -r user_id selected_email <<< "${accounts[choice-1]}"
if [[ ! "$user_id" =~ ^[a-zA-Z0-9_-]{2,128}$ ]];then
 echo "ID inválido; nenhuma autorização gravada."
 exit 2
fi
umask 077
target="$HOME/.local/share/uppulse/curator-admin-user-ids"
mkdir -p "${target%/*}"
tmp="$(mktemp "${target}.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
{ [[ ! -f "$target" ]] || cat "$target";printf '%s\n' "$user_id"; } | grep -E '^[a-zA-Z0-9_-]{2,128}$' | sort -u > "$tmp"
chmod 600 "$tmp"
mv "$tmp" "$target"
trap - EXIT
echo "ACESSO_ADMINISTRATIVO_CONFIGURADO: $selected_email"
echo "Entre nessa conta no UpPulse. Não é necessária chave técnica."
