# Catalog Search Projection

## Problema

O catálogo operacional permanece a fonte da verdade, mas marca e público estão no JSON do feed. O preview mediu 31–48 s para filtros de marca e 39,5 s para facets frias. A seleção global de Offer também custa até 14,7 s a frio. Esses trabalhos não pertencem ao caminho de cada request.

## Alternativas

| Opção | Leitura | Atualização/incremental | Multi-merchant e auditoria | Ranking futuro |
|---|---|---|---|---|
| Tabela reconstruível | Índices simples, baixa latência | Full rebuild e upsert por chave natural | Explícitos por provider/merchant/versões | Pode receber atributos com fonte futura |
| Materialized view | Boa após refresh | Refresh global; concorrência e incremental mais difíceis | Definição auditável, estado do refresh menos explícito | Possível, mas acopla cálculo ao SQL da view |
| Índices sobre JSON | Resolve predicados pontuais | Automático, com custo em ingestão | Não consolida Offer, sizes, cores ou snapshot | Insuficiente como camada de busca |

A escolha é uma tabela reconstruível. Ela consolida o trabalho comprovadamente caro, suporta atualização incremental e não transforma o raw feed em API de busca. A tabela pode ser apagada e recriada a partir das fontes; não constitui publicação.

## Granularidade e schema

`catalog_search_products` tem uma linha por Product operacional elegível + merchant. A chave natural é `(product_id, merchant_id)`. Provider e merchant tornam a estrutura genérica para Awin, Mercado Livre, Lauri e futuros parceiros.

Persistimos campos necessários à seleção: nome, marca raw/normalizada, público raw/normalizado, taxonomia, preço representativo, disponibilidade, arrays de tamanhos/cores seguros, imagem primária e versões. A identidade da Offer é persistida, mas a affiliate URL não: a leitura faz lookup por PK em `offers`, preservando o literal e evitando URL stale duplicada. Imagens adicionais e valores raw de variants permanecem nas fontes.

`brand_normalized` usa apenas NFKC, whitespace e lowercase; `brand_raw` é preservada. Público reutiliza `classifyAudience`. Tamanhos e cores reutilizam exclusivamente a normalização persistida vigente. Apenas `CATALOG_ELIGIBLE` entra na projeção; isso continua distinto de `PUBLISHED`.

## Oferta representativa

Entre Offers com promoção confirmada, estoque e preço válido: maior desconto, depois menor preço atual e Offer ID. A regra aceita múltiplos preços futuros e registra `representative_offer_id` para auditoria e affiliate lookup.

## Índices

B-tree cobre merchant+brand, audience, style, price, discount, name e available, sempre com Product ID como desempate. GIN é usado somente nos arrays efetivamente filtrados/facetados: activities, normalized sizes e normalized colors. A cardinalidade atual é 11.424 linhas para Dafiti; estimativa inicial, incluindo índices, é dezenas de MB, não centenas.

## Rebuild, incremental e versões

Full rebuild futuro: construir em staging lógico, validar fechamento, fazer upsert por `(product_id, merchant_id)` e remover da projeção somente chaves ausentes dentro do provider/merchant explicitamente reconstruído. Incremental futuro usa a mesma chave e reage a produto, preço, desconto, estoque, marca, público, variant/tamanho/cor, taxonomia, promoção encerrada ou remoção.

`projection_version`, `classifier_version`, `normalizer_version`, `source_snapshot`, `source_updated_at` e `projected_at` permitem detectar staleness. O builder atual é dry-run e não escreve.

## Facets, filtros e ordenação

Facets operam somente sobre 11.424 linhas e arrays compactos: brand, audience, size, style, activity, merchant e colors. A meta de plano é menos de 1 s e o limite é 2 s após a migration ser aplicada em uma missão separada.

O repository protótipo oferece `listProducts`, `countProducts` e `getFacets`, com parâmetros SQL, sem JSON raw. Ele suporta Nike, ASICS, tamanho 40, RUNNING, descontos/faixas de preço e suas interseções; ordena preço, desconto, nome e marca com Product ID estável.

Campos futuros como `popularity_score`, `brand_score`, `offer_score` e `relevance_score` só poderão ser adicionados quando houver fonte e definição. Nenhum score é criado nesta missão.

## DAFITI007

Fluxo futuro: feed → staging → reconcile → promoção → catálogo operacional → taxonomia → normalização → search projection → publicação/pausa. Atualizar a projeção não publica o produto. O job deverá validar fechamento e versões antes de trocar o snapshot pesquisável.
## UPCAT001.4 — persistência controlada

A migration `0010_catalog_search_projection.sql` foi aplicada de forma aditiva. A tabela é genérica (produto + merchant), reconstruível e não altera estados de publicação. O acesso de `awin_curator` é somente `SELECT`; a escrita exige `CATALOG_SEARCH_PROJECTION_ADMIN_DATABASE_URL`, `--confirm-persist`, merchant e versões/snapshot explícitos.

O primeiro rebuild real da Dafiti leu 72.196 rows e persistiu 11.424 linhas, sem rejeições ou conflitos. A segunda execução manteve 11.424 linhas e não duplicou registros (a classificação local de unchanged/updated é conservadora; o upsert é idempotente por `(product_id, merchant_id)`).

Consultas quentes usam exclusivamente a projeção: marca, público, tamanhos, taxonomia, preço e facets não acessam `commerce_raw_feed_items`. Em benchmark direto, filtro Nike levou 0,913 ms e facets de marca 4,495 ms (EXPLAIN ANALYZE, após aquecimento), contra dezenas de segundos no caminho raw. O tamanho total observado foi 24 MB.

O builder suporta full rebuild determinístico; atualização incremental futura deve localizar produtos afetados por mudanças de preço, promoção, estoque, identidade, normalização ou classificação e reconstruir somente suas linhas. A projeção continua distinta de `PUBLISHED`: sua presença nunca publica Dafiti.
