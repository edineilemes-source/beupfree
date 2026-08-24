# DAFITI001 — auditoria do feed real Dafiti para o UpPulse

> Estado posterior: DAFITI002 importou exclusivamente as 74.968 linhas elegíveis para staging inativo em 24 de agosto de 2026. A auditoria original abaixo permanece como evidência pré-import; veja `DAFITI-STAGING-IMPORT.md` para a execução e o estado atual.

## Escopo e resultado

Auditoria local, determinística e read-only de `tmp/datafeed_3047653.csv.gz`, concluída em 24 de agosto de 2026 na branch `codespace-working`. Nenhum banco, Supabase, collector legado, migration, publicação, download de imagens ou reconstrução de link foi executado.

Resultado: **READY_FOR_DAFITI_STAGING**. O feed tem evidência promocional direta e cobertura completa dos mínimos. A ausência total de `parent_product_id` e GTIN exige manter a identidade conservadora já prevista: Product pela página canônica Dafiti e Variant pelo `merchant_product_id`. Staging futuro deve permanecer inativo e ser reauditado entre snapshots antes de qualquer publicação.

O relatório completo, sanitizado e sem URLs completas está em `tmp/dafiti001-audit.json`. Ele contém o ranking integral das 284 marcas candidatas, as 50 oportunidades comerciais de exemplo, todos os 92 campos, categorias e distribuições completas.

## Arquivo e estrutura

- Arquivo compactado: 139.211.543 bytes; gzip íntegro, CRC validado por `gzip -t`.
- Conteúdo descompactado informado pelo gzip: aproximadamente 1,82 GB.
- UTF-8, zero caracteres de substituição observados; delimitador vírgula; parser RFC 4180.
- 689.383 linhas físicas/lógicas contabilizadas, incluindo header; 689.382 registros; 92 colunas.
- 689.382 linhas válidas e zero inválidas pela normalização Awin.
- Merchant único: `merchant_id=17697`, `merchant_name=Dafiti BR`.
- O arquivo agrega três `data_feed_id`: 53075, 53089 e 53091. Não se deve tratá-lo como um único data-feed lógico sem preservar esse campo na proveniência.
- Entidades gerais: 174.419 Products conceituais por URL, 689.382 Variants e 689.382 Offers.

Todos os campos estão listados no JSON. Os mais preenchidos (100%) incluem IDs Awin/merchant, nome, categoria merchant, preços, moeda, marca, cor, descrição, imagens, links, disponibilidade, MPN e tamanho. Campos criticamente vazios: `ean` e `parent_product_id` em 100%; `stock_status` vazio em 23,73%, compensado por `in_stock` preenchido.

## Classificação de tênis

A regra não lê descrição e não usa IA. `FOOTWEAR_SNEAKER_CONFIRMED` exige o token delimitado `tênis`, `tenis` ou `sneaker` em um campo estruturado: `merchant_category`, path, segunda/terceira categoria, `category_name`, `product_type` ou `Fashion:category`. Na prática, a evidência dominante é `merchant_category=tênis` (77.596 linhas) ou `merchant_category=tênis performance` (35.555). `FOOTWEAR_SNEAKER_UNCERTAIN` cobre apenas sinal no nome ou nome compatível sob categoria genérica de calçados. O restante é `NOT_SNEAKER`.

- Confirmados: 113.151 registros, 17.815 Products, 113.151 Variants e 113.151 Offers.
- Incertos: 1.861 registros; excluídos dos candidatos.
- Não tênis: 574.370 registros.
- Usos determinísticos entre confirmados: outros 54.907; performance 23.442; casual 20.673; corrida 4.591; futebol 4.113; futsal 3.539; academia/treino 922; caminhada 764; skate 200.

Os usos são rótulos auditivos derivados de categoria/nome, não alegações técnicas sobre adequação esportiva.

## Promoção e funil UpPulse

`product_price_old` usa formato como `109.9 BRL`; o parser Dafiti aceita moeda em prefixo/sufixo sem modificar o normalizador Awin genérico. A regra é:

- `old > search > 0`: `PROMOTION_CONFIRMED`, com `(old-search)/old*100`;
- `old == search > 0`: `NOT_PROMOTIONAL`;
- ausente, inválido, zero, negativo ou `old < search`: `PROMOTION_UNCERTAIN`.

No feed inteiro há 519.749 linhas confirmadas, 169.633 não promocionais e zero incertas. Não houve zero, negativo, `old < current`, desconto acima de 100% ou preço acima de R$ 100 mil. Pix, `display_price` e benefícios de pagamento não participam do cálculo.

Funil principal:

```text
Feed total                                      689.382
→ FOOTWEAR_SNEAKER_CONFIRMED                    113.151
→ PROMOTION_CONFIRMED                            74.968
→ em estoque                                     74.968
→ affiliateUrl HTTP(S) válida                    74.968
→ imagem HTTP(S) válida                          74.968
→ marca                                           74.968
→ identidade/preços/merchantUrl mínimos válidos  74.968 linhas
→ Products únicos                                11.854
→ Variants                                        74.968
→ Offers                                          74.968
```

Não houve perda após promoção no snapshot. Isso não substitui política de freshness ou expiração em uma integração futura.

## Product, Variant e Offer

`parent_product_id` não existe na prática. Todas as 689.382 linhas têm página merchant válida; URL canônica sem query/fragmento é a identidade Product observável. Isso agrupou corretamente tamanhos e não apresentou Product associado a múltiplas URLs canônicas. Nomes iguais não são mesclados.

EAN/GTIN está ausente em 100% do feed. Variant usa `merchant_product_id`, presente e único em todas as linhas; `aw_product_id` define a identidade comercial da Offer dentro do merchant. Entre candidatos não há Variant nem Offer repetida. A regra Awin genérica já suporta esses fallbacks e não deve ser alterada.

Qualidade Product: boa/conservadora, mas dependente da estabilidade da URL Dafiti. Qualidade Variant: aceitável para staging, sem portabilidade GTIN. Recomenda-se comparar estabilidade de URL e merchant ID em pelo menos dois snapshots antes de publicação.

## Métricas comerciais por Product

Desconto dos 11.854 Products candidatos: mínimo 1,65%; médio 26,32%; mediano 24,97%; máximo 76,75%. Preço promocional: mínimo R$ 38,90; médio R$ 348,86; mediano R$ 279,99; máximo R$ 3.799,99.

| Faixa de desconto | Products | Variants |
|---|---:|---:|
| 0–9% | 1.372 | 7.961 |
| 10–19% | 2.730 | 16.492 |
| 20–29% | 3.174 | 20.003 |
| 30–39% | 2.604 | 16.921 |
| 40–49% | 1.173 | 7.705 |
| 50–59% | 632 | 4.499 |
| 60–69% | 128 | 1.030 |
| 70%+ | 41 | 357 |

| Preço promocional | Products | Variants |
|---|---:|---:|
| até R$199 | 4.184 | 29.209 |
| R$200–299 | 2.311 | 14.585 |
| R$300–399 | 1.844 | 10.831 |
| R$400–499 | 1.284 | 7.383 |
| R$500–699 | 1.171 | 6.966 |
| R$700–999 | 728 | 4.210 |
| R$1.000+ | 332 | 1.784 |

## Marcas

Há 284 marcas entre os Products candidatos. O ranking completo está no JSON. Destaques solicitados e líderes encontrados:

| Marca | Products | Variants/Offers | desconto médio | máximo | preço mín.–máx. |
|---|---:|---:|---:|---:|---:|
| Fila | 873 | 5.335 | 21,86% | 57,78% | R$ 88,90–1.575,73 |
| ASICS | 665 | 3.497 | 20,46% | 51,85% | R$ 199,99–1.904,29 |
| New Balance | 588 | 3.376 | 18,58% | 56,01% | R$ 199,40–2.310,90 |
| Umbro | 452 | 3.158 | 22,43% | 58,64% | R$ 99,90–939,99 |
| Olympikus | 428 | 2.790 | 14,85% | 47,66% | R$ 54,90–710,90 |
| Puma | 408 | 2.181 | 22,74% | 63,23% | R$ 174,90–1.029,90 |
| Mizuno | 393 | 2.232 | 21,80% | 54,00% | R$ 199,99–2.099,99 |
| Nike | 353 | 2.235 | 27,04% | 58,75% | R$ 209,99–1.199,99 |
| Skechers | 320 | 1.762 | 16,19% | 45,46% | R$ 169,90–1.449,90 |
| adidas Originals | 224 | 1.504 | 23,06% | 46,67% | R$ 244,99–1.169,98 |
| Under Armour | 92 | 528 | 14,73% | 40,43% | R$ 139,90–1.149,90 |
| Adidas | 76 | 522 | 27,63% | 30,00% | R$ 209,99–1.049,99 |
| Converse | 35 | 232 | 33,44% | 46,45% | R$ 109,90–269,90 |
| Vans | 24 | 185 | 25,67% | 50,00% | R$ 169,99–629,99 |

`promotions` é igual a Products nesta tabela porque o recorte já exige promoção confirmada. Marcas Dafiti distintas, como `Adidas` e `adidas Originals`, não foram fundidas.

## Tamanhos, cores, imagens e descrições

Os candidatos têm 79 strings de tamanho; 11.634 Products têm múltiplos tamanhos e 220 têm uma única Variant. Tamanhos líderes: 39 (8.306 Variants), 38 (7.555), 40 (6.655), 41 (5.838), 37 (5.464), 42 (5.414), 36 (4.752), 43 (4.744), 35 (4.667) e 34 (4.332). Como cada Variant candidata passou por `in_stock`, o UpPulse pode exibir “Tamanhos disponíveis” para este snapshot, sem inferir tamanhos ausentes e sujeito a freshness.

Há 412 strings de cor entre candidatos. As principais são preto (19.397), branco (9.991), bege (4.928), cinza (4.778), marrom (4.216), azul (3.799), azul-marinho (2.934), `incolor` (2.912), rosa (2.634) e verde (2.477). Valores híbridos como `off-white white` mostram necessidade futura de normalização de apresentação, sem alterar raw nem identidade.

Imagem está preenchida em 689.382 linhas; candidatos sem imagem: zero. Há 793.191 URLs distintas e 619.450 valores de URL repetidos entre linhas. Hosts: `static.dafiti.com.br` e `images2.productserve.com`. Por Product candidato: mínimo 3, média 4,79, mediana 3 e máximo 7 imagens. Reuso entre Variants explica grande parte das repetições; nenhum arquivo foi baixado.

Descrição está preenchida em 100%, sem HTML detectado, média de 929,24 caracteres. Há 118.126 textos distintos e 95.592 valores repetidos; 11.634 Products multivariante compartilham descrição entre Variants. O conteúdo é longo e concatenado em muitos casos, útil como raw mas requer decisão editorial futura; nenhum texto foi modificado.

## Links e duplicatas

`aw_deep_link` e `merchant_deep_link` estão preenchidos em 100%. Hosts únicos: `www.awin1.com` e `www.dafiti.com.br`, respectivamente. O affiliate URL é preservado exatamente e nunca reconstruído; o relatório expõe somente host e presença.

Candidatos a revisão, sem merge: 119.307 nomes normalizados repetidos e 95.592 descrições repetidas no feed geral. Não foram encontrados Product com múltiplas URLs canônicas, GTIN cruzando Products (não há GTIN), Variant repetida ou Offer repetida. Nomes ligeiramente diferentes permanecem Products separados; entity resolution não faz parte desta missão.

## Performance e operação recomendada

Segunda passagem: 225.106 ms (3m45s), 3.062 linhas/s e 0,59 MB/s compactado. Normalização acumulada: 107.064 ms. RSS máximo aproximado informado pelo processo: 1.232.744.448 bytes; heap final 780.718.176 bytes.

A leitura já é streaming e single-pass, sem retenção de raw rows. A memória ainda é alta porque duplicidade exata de ~793 mil URLs, descrições, nomes e identidades exige agregados globais. Para produção, usar streaming/chunking e agregação em storage temporário/hash particionado; não montar múltiplas cópias do feed nem usar o limite padrão atual de 250 MB descompactados do `openGzipFile` para este feed de ~1,82 GB.

## Dafiti × Lauri

- Evidência promocional: Dafiti é melhor e direta no feed; `search_price` e `product_price_old` são completos e coerentes. Lauri exigiu evidência complementar de Outlet/HTML.
- Product identity: Dafiti tem escala e URL estável observável, mas não `parent_product_id`; qualidade semelhante ao fallback conservador Lauri, dependente de estabilidade entre snapshots.
- Variant identity: pior semanticamente por não ter GTIN, embora `merchant_product_id` seja completo e único; Lauri/Awin tinha GTIN observável em parte do fluxo.
- Categorias: melhores; `tênis` e `tênis performance` são estruturados e cobrem o recorte sem descrição.
- Imagens e descrições: cobertura melhor (100%) e várias imagens; descrições são longas/concatenadas e repetidas, portanto cobertura não equivale a qualidade editorial.
- Escala: muito maior — 689.382 linhas, 17.815 Products de tênis e 11.854 Products candidatos.
- Adaptações genéricas: parser monetário que aceite ISO junto ao valor; limite de tamanho descompactado configurável; agregação chunked; preservação dos três `data_feed_id`; monitoramento de estabilidade URL/merchant ID. Não alterar a regra genérica de identidade antes dessa validação longitudinal.

## Top 50 e limitações

As 50 oportunidades estão em `top50CommercialOpportunities` no JSON, ordenadas somente por maior desconto, menor preço, disponibilidade e nome. Cada entrada traz marca, nome, preço anterior/atual, desconto, Variants, tamanhos e flags de imagem/link, sem affiliate URL. É uma amostra comercial determinística, não uma afirmação de “melhores tênis”. Os primeiros resultados concentram marcas/marketplace sellers com descontos muito altos e kits; isso pede curadoria comercial posterior, não mudança da regra desta auditoria.

Riscos remanescentes: ausência de GTIN/parent ID, dependência de URL como Product, três feeds agregados, nenhum histórico de estabilidade, `in_stock` como snapshot, taxonomia de uso aproximada, cores ruidosas, descrições concatenadas, descontos extremos comercialmente plausíveis porém ainda sem confirmação externa e custo de memória dos agregados completos.

Na DAFITI001 nenhum dado foi persistido. A recomendação `READY_FOR_DAFITI_STAGING` foi consumida pela missão posterior DAFITI002, sem publicação.
