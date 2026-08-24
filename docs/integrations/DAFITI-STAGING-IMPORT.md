# DAFITI002 — importação controlada para staging

## Resultado

Executada em 24 de agosto de 2026, branch `codespace-working`, com `PUBLIC_DEMO_MODE=true`. Recomendação: **READY_FOR_DAFITI_CURATION**. Isso não autoriza publicação, scheduler ou exposição pública.

Baseline oficial pré-import: 992 Products (508 published, 484 draft), 2.022 Offers totais, 1.514 Variants, um Provider, um Merchant, um Feed, três users e seis favorites. Lauri tinha 484 Products, 1.514 Variants e 1.514 Offers, todos em staging seguro.

## Gate e elegibilidade

O arquivo `tmp/datafeed_3047653.csv.gz` foi validado por gzip e lido duas vezes na primeira execução: preflight completo e import. O gate exigiu exatamente 74.968 elegíveis entre 689.382 linhas. Filtro:

```text
merchant_category ∈ {tênis, tênis performance}
AND product_price_old > search_price > 0
AND in_stock=true
AND affiliateUrl/merchantUrl/imagem HTTP(S)
AND marca/data_feed_id presentes
AND Product por parent confiável ou URL merchant
AND Variant por GTIN válido ou merchant_product_id
```

Resultado do preflight: 74.968 elegíveis, zero inválidas, 614.414 ignoradas; 576.231 não pertenciam às duas categorias e 38.183 eram tênis não promocionais. Descrição nunca inclui item. Raw decision: persistir somente elegíveis.

## Persistência e proveniência

Provider Awin foi reutilizado. Merchant `17697 / Dafiti BR` e feeds 53075, 53089 e 53091 vieram das linhas. Products usam URL canônica porque `parent_product_id` inexiste; Variants usam `merchant_product_id` porque GTIN inexiste. Feed ID, IDs externos, raw/content hashes, payload sanitizado e timestamps são preservados. `Fashion:size` é mantido como tamanho e categoria/feed também entram nos atributos da Variant.

Estado final Dafiti: 11.854 Products draft/staging/inativos, 74.968 Variants inativas, 74.968 Offers paused/inativas, 74.968 raws, 74.968 evidências e 56.779 URLs de imagem deduplicadas por Product+URL. Feeds: 53075=20.577 raws; 53089=32.765; 53091=21.626.

Migration 0007 criou `offer_promotion_evidence` de modo aditivo. Todas as linhas têm `PROMOTION_CONFIRMED`, `OLD_PRICE_GT_CURRENT_PRICE`, `AWIN_DAFITI_FEED`, old/current/percentual/feed/timestamp e checks monetários. Pix não é consultado nem persistido como preço promocional.

## Batches, performance e idempotência

Primeiro import: 300 batches de 250, 3.009 round-trips estimados, 69,631s de preflight, 698,293s de persistência e 752.836 KiB de RSS máximo; 74.968 created e zero updated/unchanged. O parser não retém o feed; memória máxima inclui runtime, buffers e batches/raw JSON.

Segundo import idêntico: zero created, zero updated, 74.968 unchanged, 300 batches, 609 round-trips e 232,771s de import. Um teste real controlado alterou preço atual, oldPrice e representação de estoque em três linhas: mesmos Product/Variant/Offer keys, exatamente três updated; reimport imediato dos três raws originais restaurou exatamente três. A passagem global posterior confirmou novamente 74.968 unchanged.

Freshness futuro deve exigir snapshot completo saudável. Ausência não apaga/desativa automaticamente e promoção terminada não deve ser publicada sem política explícita.

## Segurança pública e coexistência

Após import: 12.846 Products totais, 508 published e 12.338 draft; 76.990 Offers totais; 76.482 Variants; dois merchants e quatro feeds. Lauri permaneceu exatamente em 484/1.514/1.514. Chaves incluem provider+merchant e não colidiram.

No servidor real com demo mode: `/api/products?limit=5000` retornou total/lista 508 e nenhum ID Dafiti; Product Dafiti direto retornou 404; `/api/click/:offerId` Dafiti retornou 404. Zero identity Dafiti não-staging/ativa, zero Variant ativa, zero Offer ativa/não-paused e zero mínimos ausentes.

Nenhuma chave proibida foi encontrada nos raws e nenhum segredo/URL apareceu nos metadados de Feed. Relatórios não selecionam URLs completas. O gzip permanece ignorado; `tmp/` contém artefatos locais não destinados a versionamento.

## Distribuição e curadoria

Há 284 marcas, 79 tamanhos e 412 cores. Products por categoria estruturada: 8.066 `tênis` e 3.788 `tênis performance`. Variants por Product: mínimo 1, média 6,32, mediana 6, máximo 20; 220 Products têm uma Variant e 11.634 têm múltiplas.

O relatório sanitizado completo está em `tmp/dafiti002-staging-report.json`, incluindo ranking integral de marcas, preço/desconto, categorias, tamanhos, cores e amostra de 50 Products reais. Cada amostra mostra marca/nome/categoria, Variants, tamanhos, cores, preços, desconto, imagens, flags de links, promoção e estado; nenhuma URL é exibida.

Riscos para curadoria: Product depende da estabilidade de URL; Variant não tem GTIN; cores são ruidosas; três feeds compõem o snapshot; descontos altos e kits precisam de curadoria; memória e round-trips devem ser otimizados antes de agendamento. DAFITI002 não implementa publicação, IA, score, entity resolution, scheduler ou UI.
