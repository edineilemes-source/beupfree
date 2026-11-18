#!/usr/bin/env bash
# Provisiona o acesso da conta administrativa ao upload de feeds usando ID estável.
# Não cria contas, não altera o PostgreSQL e não coloca credenciais no Git.
set -Eeuo pipefail
if ! command -v docker >/dev/null 2>&1;then echo "Docker indisponível";exit 2;fi
read -r -p "E-mail da conta já cadastrada no UpPulse: " email </dev/tty
email="${email,,}"
if [[ ! "$email" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$ ]];then
 echo "E-mail inválido. Nenhuma autorização gravada.";exit 2
fi
ids=()
for database in uppulse_catalog postgres;do
 if ! docker inspect -f '{{.State.Status}}' beupfree-catalog-pg17 2>/dev/null | grep -qx running;then
  echo "PostgreSQL homologado não está ativo. Nenhuma autorização gravada.";exit 2
 fi
 user_id="$(docker exec -i beupfree-catalog-pg17 sh -c 'exec psql -U "${POSTGRES_USER:-postgres}" -d "$1" -X -A -t -v ON_ERROR_STOP=1' sh "$database" 2>/dev/null <<SQL || true
SELECT id FROM public.users WHERE lower(email)=lower('$email') AND is_active=true;
SQL
)"
 if [[ "$user_id" =~ ^[a-zA-Z0-9_-]{2,128}$ ]];then
  ids+=("$user_id")
 fi
done
if (( ${#ids[@]} != 1 ));then
 echo "Conta ativa não identificada de forma única no banco homologado. Cadastre-se ou entre no UpPulse primeiro."
 echo "Nenhuma autorização gravada."
 exit 2
fi
umask 077
target="$HOME/.local/share/uppulse/curator-admin-user-ids"
mkdir -p "${target%/*}"
tmp="$(mktemp "${target}.XXXXXX")"
trap 'rm -f "$tmp"' EXIT
{ [[ ! -f "$target" ]] || cat "$target";printf '%s\n' "${ids[0]}"; } | sort -u > "$tmp"
chmod 600 "$tmp"
mv "$tmp" "$target"
trap - EXIT
echo "Acesso à Curadoria autorizado para a conta selecionada, sem chave administrativa adicional."
echo "Faça login no UpPulse e abra /admin/curadoria/feeds"
