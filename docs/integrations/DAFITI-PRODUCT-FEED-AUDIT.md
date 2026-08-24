# DAFITI001 — Product Feed real da Dafiti na Awin

Auditoria read-only do arquivo real `tmp/datafeed_3047653.csv.gz`, executada em
24 de agosto de 2026 na branch `codespace-working`. O relatório técnico completo,
incluindo os 92 campos, as 75 categorias, as 284 marcas candidatas e as métricas
detalhadas, está em [AWIN-DAFITI-FEED-AUDIT.md](./AWIN-DAFITI-FEED-AUDIT.md).
O JSON sanitizado original está em `tmp/dafiti001-audit.json`; URLs de tracking
completas não são expostas.

## Origem e estrutura

- Merchant: `17697 / Dafiti BR`.
- `data_feed_id` observados nas linhas: `53075`, `53089` e `53091`.
- Seleção/download Awin materializada: `datafeed_3047653.csv.gz`.
- Região/idioma observáveis: Brasil, `pt_BR`; moeda única `BRL`.
- Snapshot: 689.382 registros, todos válidos; 92 colunas; gzip/UTF-8/CSV.
- Universo geral: 174.419 Products por URL canônica, 689.382 Variants e
  689.382 Offers. Há 1.354 marcas no feed completo.
- A data de última atualização do feed e a URL secreta de download não estão
  comprovadas pelos artefatos locais e, portanto, não são inventadas.

## Taxonomia e universo de tênis

A taxonomia estruturada contém 75 valores de `merchant_category`. Para tênis,
os sinais determinantes são `tênis` (77.596 linhas) e `tênis performance`
(35.555). A classificação também inspeciona category path, segunda/terceira
categoria, `category_name`, `product_type` e `Fashion:category`; descrição não é
usada como prova estruturada.

Foram confirmadas 113.151 linhas de tênis, representando 17.815 Products e
113.151 Variants/Offers. Outras 1.861 linhas ficaram incertas e não foram
silenciosamente incluídas. Usos entre os confirmados: outros (54.907),
performance (23.442), casual (20.673), corrida (4.591), futebol (4.113), futsal
(3.539), treino/academia (922), caminhada (764) e skate (200). Esses rótulos são
auditivos, não recomendações técnicas. Nenhuma marca foi excluída.

## Promoção, preço e estoque

Os campos promocionais existentes incluem `search_price`, `store_price`,
`display_price`, `rrp_price`, `base_price`, `base_price_amount`,
`base_price_text`, `product_price_old`, `saving`, `savings_percent` e
`promotional_text`. Neste snapshot, a evidência confiável é
`product_price_old > search_price > 0`; nenhum texto comercial é usado.

No universo confirmado de tênis: 74.968 Offers são `PROMOTION_CONFIRMED`, zero
são `PROMOTION_UNCERTAIN` e 38.183 são `NOT_PROMOTIONAL`. O recorte promocional
forma 11.854 Products e 74.968 Variants/Offers, todos em estoque e com preço,
marca, imagem e affiliate link. Por Product, o preço atual vai de R$ 38,90 a
R$ 3.799,99 (média R$ 348,86; mediana R$ 279,99). O desconto vai de 1,65% a
76,75% (média 26,32%; mediana 24,97%). Não foram encontrados preços zero ou
negativos, preço anterior menor que o atual, desconto acima de 100% ou moeda
inesperada. Não houve correção silenciosa.

Distribuição promocional por Product/Variant: 0–9% 1.372/7.961; 10–19%
2.730/16.492; 20–29% 3.174/20.003; 30–39% 2.604/16.921; 40–49%
1.173/7.705; 50–59% 632/4.499; 60–69% 128/1.030; 70%+ 41/357.

## Product, Variant, Offer, imagens e links

`parent_product_id` e EAN/GTIN estão 100% vazios. Product depende da URL
merchant canônica sanitizada; Variant usa o `merchant_product_id`, completo e
único; Offer usa a identidade Awin dentro do merchant. Não houve colisão de
Product com múltiplas URLs, Variant ou Offer. O risco principal é a falta de
portabilidade GTIN e a estabilidade ainda não longitudinal da URL.

Todos os registros têm descrição, imagem, `aw_deep_link` e
`merchant_deep_link`. Candidatos promocionais têm entre 3 e 7 imagens por
Product (média 4,79); hosts observados: `static.dafiti.com.br` e
`images2.productserve.com`. Affiliate links usam `www.awin1.com` e são tratados
literalmente; links merchant usam `www.dafiti.com.br`. Nenhuma imagem foi
baixada e nenhum deeplink foi reconstruído.

## Qualidade, riscos e recomendação

No recorte promocional: zero sem preço, imagem, descrição, marca, categoria,
tamanho, estoque ou affiliate link; todos os 74.968 itens estão sem GTIN
confiável. Descrições são longas/repetidas, cores têm ruído, há três feeds
lógicos no arquivo e descontos extremos/kits requerem curadoria posterior.
Estoque é apenas um snapshot. A auditoria não autoriza publicação.

Recomendação da DAFITI001: **READY_FOR_STAGING**, condicionado a staging
inativo, preservação de proveniência e comparação de identidades entre
snapshots. Nesta auditoria não houve persistência, collector, scheduler,
migration, deploy, alteração de `PUBLIC_DEMO_MODE`, download de imagens,
publicação ou ativação de Offer.
