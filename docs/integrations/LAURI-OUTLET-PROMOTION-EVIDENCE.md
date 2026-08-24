# Lauri Outlet como evidência promocional

## Escopo e papéis

Esta camada é exclusivamente de análise/curadoria. O feed Awin continua sendo a fonte comercial de Products, Variants e Offers. A página oficial `https://www.lauriesporte.com.br/outlet?sort_by=lowest_price` é uma fonte complementar, read-only, de evidência de preço. Estar em uma categoria chamada Outlet não confirma promoção.

Nenhum dado desta auditoria é persistido. A rotina não altera identidade, `publication_state`, Product, Variant, Offer, itens raw, o catálogo demo ou `PUBLIC_DEMO_MODE`; também não chama publicação ou scheduler.

## Observação de 22 de agosto de 2026

A página respondeu HTTP 200, sem redirects, como `text/html; charset=UTF-8`. O HTML server-rendered tinha 14 produtos únicos e nenhuma paginação visível. Os objetos de produto aparecem repetidos em até três componentes, por isso a extração deduplica por ID/URL. Havia JSON-LD de WebPage/WebSite, mas não Product JSON-LD útil. A configuração incorporada expunha o endpoint público de busca usado pela plataforma (`api.dooki.com.br/v2/lauri-esporte/public/search`); ele não foi chamado, pois o HTML já continha a listagem completa observável.

Os cards continham JSON HTML-escaped em atributo `:product`: ID de produto, SKUs, nome, marca, URL, imagem, `blocked_sale`, `prices.data.price_sale`, `price`/`price_discount`, moeda e `pix.price`. A disponibilidade registrada é apenas a negação de `blocked_sale`; não equivale a estoque confirmado por variante.

## Representação intermediária

`LauriOutletItem` contém URL original e canônica, nome, marca, ID/SKUs/GTINs quando observáveis, preço anterior, atual e Pix separados, moeda, imagem, disponibilidade, evidência, status e timestamp da observação. A URL canônica remove query, fragmento, `www`, barras duplicadas e tracking. HTML completo não é armazenado pelo projeto.

## Regra promocional

- `oldPrice > currentPrice > 0`: `PROMOTION_CONFIRMED`; percentual = `(oldPrice - currentPrice) / oldPrice * 100`.
- Ambos presentes e `oldPrice <= currentPrice`: `NOT_PROMOTIONAL`.
- Qualquer preço necessário ausente ou inválido: `PROMOTION_UNCERTAIN`.

`price_sale` é interpretado como preço anterior e `price_discount` (com fallback para `price`) como atual, pois o próprio JSON estruturado da loja também fornece `has_promotion`/`percent_discount` coerentes. O percentual é recalculado. `pix.price` é benefício adicional de pagamento e nunca entra no percentual promocional principal.

## Matching Awin

A prioridade é: (1) URL canônica exata; (2) ID/SKU de merchant; (3) GTIN exato; (4) nome normalizado e marca apenas como `MATCH_REVIEW_REQUIRED`; (5) `NO_MATCH`. Ambiguidade nunca vira match final. A rotina não altera Product identity.

A consulta usa apenas `AWIN_CURATOR_DATABASE_URL`, nunca `DATABASE_URL` implicitamente, limita a conexão a uma e executa `BEGIN READ ONLY`. O recorte é provider `awin` e merchant externo `118977`. URLs afiliadas não são selecionadas nem exibidas.

## Divergência Awin × Outlet

A comparação usa o preço atual não-Pix. Tolerância: diferença absoluta até R$ 0,05 **ou** relativa até 0,10% é `PRICE_DIFFERENCE_MINOR`; zero é `PRICE_MATCH`; acima disso é `PRICE_DIFFERENCE_MATERIAL`; preço ausente/inválido é `PRICE_NOT_COMPARABLE`. São registrados diferença absoluta, percentual e timestamps das duas fontes. Divergência jamais causa update nesta missão.

## Multivariante

O Outlet mostra preço no nível Product; a Awin mantém Offer por Variant. A evidência do Product só pode ser projetada para uma Variant se sua Offer for comparável e estiver dentro da tolerância do preço atual do Outlet. Se as Variants tiverem preços diferentes, cada Offer deve ser avaliada separadamente; as divergentes permanecem inelegíveis ou em revisão. Não se deve ativar todas as Variants por herança.

## Freshness e fim da promoção

Uma execução futura deve salvar apenas snapshots/evidências derivados (fora desta missão), com `sourceObservedAt`, cobertura de páginas, HTTP e hash da listagem. A promoção pode terminar quando o produto sai do Outlet, o preço anterior desaparece, o preço atual volta ao regular, o item fica indisponível ou a Awin diverge materialmente.

Ausência só deve causar expiração após uma coleta completa e saudável, idealmente duas observações consecutivas. HTTP não-2xx, CAPTCHA/bloqueio, timeout, mudança estrutural, queda anormal da contagem ou paginação incompleta congelam o estado anterior e abrem alerta; não despublicam. Produto ainda no feed Awin mas fora do Outlet perde apenas a evidência Outlet depois dessa janela de confirmação.

## CLI e operação

```sh
npm run awin:outlet-audit -- --html-file=/caminho/captura.html --outlet-only --json
AWIN_CURATOR_DATABASE_URL='postgresql://...' npm run awin:outlet-audit -- --html-file=/caminho/captura.html --json
```

A captura deve ser obtida separadamente por uma requisição legítima, sem contornar CAPTCHA, autenticação, rate limit ou anti-bot. A CLI não faz crawling implícito. `--outlet-only` valida a extração sem banco. Fixtures sanitizadas tornam a suíte independente da rede.

## Riscos e política futura

Os principais riscos são mudança de markup/semântica da plataforma, listagem parcial, preço de Product não aplicável a todas as Variants, IDs de plataformas diferentes, atraso entre fontes e indicação de disponibilidade pouco granular. A publicação futura deve exigir match final de alta confiança, promoção confirmada, Offer comparável/fresca, estoque e política de expiração; candidatos por nome exigem revisão humana. Até esses critérios serem implementados e auditados, o resultado permanece staging.
