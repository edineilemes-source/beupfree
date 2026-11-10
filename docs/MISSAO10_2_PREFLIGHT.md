# Missão 10.2 — Preflight seguro do PostgreSQL consolidado
Data: 2026-11-10. Ambiente de homologação; **não é autorização para executar migração**.

## Objetivo
Comprovar que o backup do banco operacional existe e é legível e que a chave `products.id` comporta a FK do cache de IA. Não modificar catálogo, ofertas ou estrutura. Não executar APIs pagas.

## Evidências já confirmadas
- Contêiner `beupfree-catalog-pg17`, banco `uppulse_catalog`, PostgreSQL 17, host 5435.
- `products`: 32707; `offers`: 96851; `catalog_search_products`: 16945.
- `product_intelligence_cache` ainda ausente na última verificação.
- Migração candidata: `migrations/mission10_product_intelligence_cache.sql`.
- A migração define `master_id varchar(36) REFERENCES products(id)`. É necessário confirmar que `products.id` tem PK/unique apropriada e que os IDs reais cabem no limite. **Não executar migração antes disso.**

## Comando único para preflight (copiar/colar no Codespaces)
O comando abaixo cria um backup local somente se ainda não existir um arquivo com esse nome; **não sobrescreve**. Depois verifica se o arquivo pode ser listado por `pg_restore`. Usa conexão local do próprio contêiner, sem exibir senha.

```bash
set -e
CONTAINER=beupfree-catalog-pg17
BACKUP_DIR=/workspaces/backups
BACKUP="$BACKUP_DIR/uppulse_catalog_pre_missao10.dump"
mkdir -p "$BACKUP_DIR"
docker exec "$CONTAINER" pg_isready -U postgres
df -h "$BACKUP_DIR"
if [ ! -e "$BACKUP" ]; then
  TMP="$BACKUP.partial"
  if [ -e "$TMP" ]; then echo "Backup parcial anterior detectado: $TMP. Verifique antes de continuar."; exit 1; fi
  trap 'echo "Backup interrompido; arquivo parcial mantido para análise."' ERR
  docker exec "$CONTAINER" sh -c 'pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -Fc' > "$TMP"
  test -s "$TMP"
  pg_restore -l "$TMP" >/dev/null 2>&1 || docker exec -i "$CONTAINER" pg_restore -l < "$TMP" >/dev/null
  mv "$TMP" "$BACKUP"
fi
ls -lh "$BACKUP"
if command -v pg_restore >/dev/null 2>&1; then pg_restore -l "$BACKUP" | tail -3; else docker exec -i "$CONTAINER" pg_restore -l < "$BACKUP" | tail -3; fi
docker exec -i "$CONTAINER" sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -X -v ON_ERROR_STOP=1' <<'SQL'
SET statement_timeout = '90s';
SET default_transaction_read_only = on;
SELECT current_database() AS banco, version();
SELECT 'products' AS tabela, COUNT(*) FROM products
UNION ALL SELECT 'offers', COUNT(*) FROM offers
UNION ALL SELECT 'catalog_search_products', COUNT(*) FROM catalog_search_products;
SELECT to_regclass('public.product_intelligence_cache') AS cache_existente;
SELECT max(length(id)) AS maior_id, min(length(id)) AS menor_id, count(*) FILTER (WHERE length(id)>36) AS ids_acima_36 FROM products;
SELECT conname, contype, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint WHERE conrelid='public.products'::regclass AND contype IN ('p','u');
SQL
```

## Critérios de aprovação
- Arquivo de backup legível e armazenado fora do Git, sem sobrescrita.
- Contagens coerentes com a base consolidada.
- `products.id` tem PK/unique compatível e todos os IDs cabem em `varchar(36)`.
- Nenhuma migração aplicada, nenhum dado modificado.
- O relatório de preflight deverá ser publicado em `docs/relatorios/` via GitHub; nunca versionar o dump nem credenciais.

## Limites
Este comando **não testa restauração completa** do backup; apenas sua legibilidade/índice. Backup de volume e teste de restauração isolada podem ser necessários antes de uma migração real. Se faltar espaço, o dump falhar ou houver incompatibilidade, interromper sem modificar o banco.
