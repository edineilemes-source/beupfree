# UpPulse Catalog Preview

## Propósito e segurança

Superfície de desenvolvimento para inspecionar o catálogo operacional Dafiti antes da publicação. Não é uma área administrativa segura e não substitui RBAC. `UPPULSE_CATALOG_PREVIEW_ENABLED` é `false` por padrão; somente o valor literal `true` habilita a rota da API e inclui a página `/dev/catalogo-dafiti` no build. Com a flag desligada, `GET /api/catalog-preview/products` responde 404.

O preview é estritamente read-only e abre um pool separado usando exclusivamente `AWIN_CURATOR_DATABASE_URL`. Não usa `DATABASE_URL`, não grava dados e não altera publicação. Os 508 produtos públicos continuam isolados em `GET /api/products`.

## Arquitetura e contrato

O contrato compartilhado fica em `shared/catalogPreview.ts` e adapta o modelo `OperationalCatalogProduct`: produto, taxonomia, preço, variantes normalizadas, imagens ordenadas, merchant e URL afiliada literal. Reason codes, source evidence, feed bruto e dados administrativos não são expostos.

`GET /api/catalog-preview/products` aceita `page` (1), `pageSize` (24, máximo 100), `brand`, `audience`, `size`, `discountMin`, `discountMax`, `priceMin`, `priceMax`, `style`, `activity`, `merchant`, `available` e `sort`. Todos os filtros são parametrizados e combinados por interseção. A resposta contém `items`, `pagination` e diagnósticos por query.

`GET /api/catalog-preview/facets` entrega separadamente marcas, públicos, tamanhos seguros, styles, activities, merchants e as 50 cores normalizadas mais frequentes. O frontend carrega os dois endpoints em paralelo; paginação não recalcula facets. O cache é process-local, exclusivo deste catálogo Dafiti e expira em cinco minutos. Nenhuma marca ou total é hardcoded.

Ordenações: `discount-desc`, `discount-asc`, `price-asc`, `price-desc`, `name-asc` e `brand-asc`. Toda ordenação termina em Product ID para desempate estável.

## Repository final e projeção (UPCAT001.5)

O repository final de preview delega `listProducts`, `countProducts` e `getFacets` a `PgCatalogSearchProjectionRepository`, sempre limitado ao merchant externo Dafiti. Marca, público, filtros, ordenação, paginação, count e facets leem exclusivamente `catalog_search_products`. Não há `commerce_raw_feed_items`, `raw_payload`, variants ou normalizações no hot path.

A listagem faz dois round-trips paralelos e constantes: página e count. O card usa `normalized_sizes`, `normalized_colors` e `primary_image_url` já projetados. O único dado complementar é `offers.affiliate_url`, obtido por join literal com `representative_offer_id`, sem reconstrução, parâmetros adicionais ou log da URL. O nome do merchant é obtido no mesmo lote. Facets usam um round-trip e cache process-local de cinco minutos.

## Oferta, tamanhos e imagens

A oferta representativa deve ser uma promoção confirmada e em estoque. Entre candidatas, vence maior desconto, depois menor preço atual e finalmente Offer ID. A regra não pressupõe preço único. `affiliateUrl` é devolvida literalmente, sem reconstrução, parâmetros adicionais, log completo ou click tracking.

O contrato mantém `variants` vazio nesta superfície porque o card não necessita do detalhe por variante. Tamanhos seguros e cores normalizadas vêm dos arrays da projeção; raw-only e valores suspeitos são omitidos. A imagem principal usa a URL projetada e o frontend possui fallback de falha.

## Performance E2E UPCAT001.5

Servidor local recém-iniciado: products cold 4.743,7 ms (`NEEDS_OPTIMIZATION`) e facets cold 250,5 ms (`EXCELLENT`). A latência cold de products foi dominada pela abertura da conexão remota; não permaneceu bloqueante. Com conexões aquecidas, as medianas de três execuções foram: default 191,4 ms; maior desconto 194,2 ms; menor preço 200,8 ms; Nike 130,9 ms; ASICS 136,2 ms; Fila 135,7 ms; size 40 180,0 ms; RUNNING 147,4 ms; Nike + desconto mínimo 30 129,2 ms; Nike + size 40 129,5 ms; RUNNING + preço máximo 500 137,3 ms; público + size + desconto 133,7 ms; página 100 218,6 ms. Todas as medianas warm são `EXCELLENT`.

Facets frias retornaram 278 marcas, 4 públicos, 39 tamanhos, 5 styles, 12 activities, 1 merchant e 30 cores em 250,5 ms. O conjunto real retornou 11.424 produtos e 476 páginas de 24.

## Limitações e próximos passos

Uma página usa três round-trips constantes: seleção paginada, count exato e detalhes agregados somente para os Product IDs da página. Não existe query por produto/variant (sem N+1). Facets usam um round-trip separado e cache curto. O tempo de cada query e o total são devolvidos em `diagnostics`. A migration `0009_catalog_preview_performance.sql` foi aplicada de forma controlada na UPCAT001.2.

Esta superfície não é uma área administrativa segura. Não tem RBAC, publicação, ranking multidimensional, popularidade, tracking público ou atualização automática. “Maior desconto” é um sort literal; ARMYZ e Domidona no topo são resultado esperado, não relevância padrão. O cold start remoto de products (4,74 s observado, warm abaixo de 0,22 s) permanece risco operacional para monitoramento, sem bloquear o preview. Qualquer transição de publicação exige missão separada e autorização explícita.

## Diagnóstico UPCAT001.1

`EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON)` no Supabase oficial confirmou: `raw_product` 36,520 s (sequential scans em raw items e variants, sort externo de 7,4 MB); oferta representativa 13,018 s a frio (sort externo de 7,2 MB); facets de tamanho 10,016 s; activities 77,9 ms; detalhe antigo de 24 IDs 3,303 s, incluindo 146 sequential scans de `offers`. A listagem original completa foi medida em 64,181 s.

A reescrita pagina antes de agregar, consulta a versão operacional explícita em vez de materializar as views `latest_*`, agrega somente variants/imagens da página e separa facets. O detalhe não faz mais um scan de offers por variant. Facets frias ainda custaram 29,033 s no esquema atual, enquanto o cache retornou em menos de 0,1 ms.

Antes da migration, benchmarks aquecidos foram: default 2,186 s; menor preço 2,353 s; página 100 3,653 s; página 500 vazia 1,001 s; página 1000 vazia 0,989 s. Marca continuou entre 46–49 s; tamanho 40 caiu de uma execução interrompida após vários minutos para 7,050 s depois da remoção do subplano correlacionado.

Na UPCAT001.2 ambos os índices ficaram válidos/prontos. Medianas pós-índice: default 1,338 s; maior desconto 1,106 s; menor preço 1,275 s; tamanho 40 1,202 s; RUNNING 1,039 s; RUNNING + preço máximo 500 1,085 s; página 100 1,311 s. Facets cacheadas permaneceram abaixo de 0,1 ms.

Marca permaneceu bloqueante porque `brand_name` existe apenas dentro do JSON raw: Nike 31,107 s, ASICS 37,929 s, Nike + desconto 45,881 s e Nike + tamanho 48,140 s. O plano pós-índice ainda fez sequential scan de 76.482 raw items, removendo 74.175 para Nike. Facets frias ficaram em 39,533 s. Antes de validar o preview, marca/facets exigem projeção operacional própria ou índice de expressão especificamente aprovado por nova análise.
