# Missão 14 — Olympikus: homologação de preço regular até o catálogo de testes

**Mandato:** integrar o feed AWIN Olympikus BR (17698/51837) apenas em homologação, com preço regular e desconto zero, preservando catálogo e snapshots anteriores. Sem Hostinger ou publicação comercial.

## Material de entrada
- Feed fornecido: `17698-51837-pt_BR-Default.csv.gz` (745 KiB compactado), SHA256 e métricas no relatório da auditoria da conversa.
- **Arquivo anexado ao ChatGPT não fica acessível no Codespaces automaticamente.** Colocar em `data/awin/inbox/17698-51837-pt_BR-Default.csv.gz` sem versionar. Não copiar tokens nem credenciais para GitHub/Issue/logs.
- 7.140 linhas, 5.224 candidatas a tênis por regra exploratória, 814 grupos de páginas de tênis, 7.042 GTIN válidos, todos os preços anteriores ausentes.

## Código implementado
- `server/integrations/awin/regularPriceEvidence.ts`: mantém preço anterior bruto nulo e gera valor de compatibilidade, com estado explícito.
- `server/integrations/awin/catalogCandidate.ts`: avaliação comercial e taxonomia compartilhadas.
- `scripts/awin-commercial-audit.ts`: análise totalmente sem banco.
- `scripts/awin-regular-catalog-stage.ts`: auditoria no banco em transação read-only por padrão; escrita apenas com `--confirm-staging`, conferência de IDs, hashes, contagens, destino de banco, status das ofertas e constraints.
- `migrations/0014_regular_price_offer_evidence.sql`: mudança aditiva das constraints para aceitar `REGULAR_PRICE` sem comprometer `PROMOTION_CONFIRMED`. Não foi aplicada.
- `scripts/catalog-search-projection-persist.ts`: transmite `promotion_status` para busca e seleção; builder/UI/filtro `Sem desconto` já preparados.
- `server/productIdentity/shadow.ts`: análise de identidades sem afetar catálogo comercial.

## Fluxo efetivo seguro
1. Manter porta 5013 e versão atual intactas. Confirmar SHA do branch e git limpo; não fazer reset/checkout destrutivo. Verificar o arquivo em inbox com SHA256 e contagem 7.140; não versionar.
2. Rodar `npm run check`, `npm run test:unit`, `npm run test:public-catalog` e `npm run build` somente se último release gate não cobrir novo SHA. Não iniciar pesquisas pagas.
3. Gerar credenciais DB **somente no terminal do Codespaces** pela configuração atual do container `beupfree-catalog-pg17`; confirmar nome `uppulse_catalog` e porta real, sem imprimir senhas. Conferir backup existente, volume `beupfree-catalog-pg17-data`, sucesso de restauração de teste e baseline 32.707/96.851/16.945 antes de escrever.
4. Auditor offline, sem banco:
   `node --import tsx scripts/awin-commercial-audit.ts --file data/awin/inbox/17698-51837-pt_BR-Default.csv.gz --merchant 17698 --feed-id 51837`
   Guardar relatório sanitizado com estados `REGULAR_PRICE`, revisão, universo e motivos.
5. Antes da primeira gravação, planejar rollback, capturar snapshots e validar schema. A migração 0014 tem que ser aplicada em **banco de homologação restaurável**, nunca automaticamente por script. Conferir que a migração não invalida promoções já existentes e que não altera linhas, somente constraints e coluna.
6. Importar **somente Olympikus** via pipeline AWIN existente, configurando `AWIN_STAGING_DATABASE_URL` para a instância de homologação correta, e passando parâmetros explícitos:
   `npm run awin:import -- --file data/awin/inbox/17698-51837-pt_BR-Default.csv.gz --mode=staging --confirm-staging --feed-id=51837 --merchant=17698 --expected-count=7140 --chunk-size=1000`
   A operação mantém produtos em draft, ofertas pausadas e identidade staging. Se qualquer contagem divergir, abortar.
7. Verificar leitura da etapa comercial no banco com **dry-run** (`AWIN_CATALOG_ADMIN_DATABASE_URL`, `AWIN_CATALOG_EXPECTED_DATABASE=uppulse_catalog`, `AWIN_CATALOG_EXPECTED_HOST` configurados separadamente, sem expor senha):
   `node --import tsx scripts/awin-regular-catalog-stage.ts --merchant=17698 --feed-id=51837 --expected-raw-count=7140`
   O relatório deve trazer 0 ativações e 0 mudanças. Em qualquer `AMBIGUOUS_JOIN`, `INCOMPLETE_JOIN`, `SOURCE_IDENTITY_HASH_MISMATCH` ou diferença comercial, **parar para corrigir código**; jamais dispensar verificação para prosseguir.
8. Persistência de evidências de preço regular/classificações em homologação exclusivamente após dry-run, backup e constraints aprovados:
   `node --import tsx scripts/awin-regular-catalog-stage.ts --merchant=17698 --feed-id=51837 --expected-raw-count=7140 --confirm-staging`
   A função exige que nenhuma oferta já esteja ativa, que todo SKU tenha identidade coerente e que a migração esteja aplicada; operação é transacional e restrita a merchant 17698.
9. Construção da projeção de busca **somente para Olympikus**, usando mecanismo existente com `--merchant=17698`, `--expected-count=<número confirmado no dry-run>`, versão exata e snapshot, em ambiente de homologação. A rotina atual exige conexão administrativa DB `postgres` e conferência de identidade; reconciliar esse pré-requisito com o destino real `uppulse_catalog` de forma explícita e testada, **não contornar o guard**.
10. Rodar testes de comparação de ofertas reais em modo sombra com lotes de no máximo 2.000 identidades por execução: apenas relatórios `AUTO_MATCH`, `REVIEW`, `NO_MATCH`; não fundir automaticamente. Verificar GTIN e modelo, variantes, numeração, loja, estoque, links, ordenação menor preço/maior desconto e filtro `Sem desconto`.
11. Novo preview somente em porta diferente da 5013, vinculado ao SHA aprovado; teste de regressão real da interface com Olympikus e baseline; proteger rollback. Publicar Hostinger apenas em etapa posterior e com autorização separada.

## Gates de conclusão
- Staging Olympikus importado sem contaminar demonstrativos e sem afetar Dafiti/FutFanatics.
- Evidência `REGULAR_PRICE` mantém preço original ausente, compatibilidade de `previousPrice` apenas internamente, desconto zero, sem selo promocional.
- Classificação de tênis separa roupas e chinelos; motivos de quarentena auditáveis.
- Produto Mestre mostra equivalência correta com variantes, sem falsas fusões.
- Contagens antes/depois, testes, hashes e relatório final, explicando claramente o que foi gravado.
- **Nunca executar deploy ou pesquisa IA paga por este runbook.**
