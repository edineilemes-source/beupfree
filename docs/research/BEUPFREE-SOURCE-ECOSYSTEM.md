# Ecossistema estratégico de fontes comerciais do BeUpFree

**Missão:** SPIKE-SOURCES001  
**Data da pesquisa:** 17 de agosto de 2026  
**Natureza:** pesquisa técnica e comercial; não é parecer jurídico

## 1. Resumo executivo

O BeUpFree continua viável sem scraping, mas a unidade estratégica correta não é “marketplace coletável”: é **fonte autorizada de ofertas**. Redes de afiliados com product feeds são o melhor ponto de entrada porque combinam autorização, dados estruturados, muitos merchants e monetização. Awin é a primeira integração recomendada; Rakuten Advertising, a segunda.

Foram pesquisados dez providers. Cinco têm product feed comprovado para publishers (Awin, Rakuten, Impact, Admitad e CJ), seis têm API útil ao publisher confirmada (Awin, Amazon, Impact, Admitad, CJ e Booking.com), sete têm compatibilidade Brasil confirmada, e quatro reconhecem explicitamente comparação em documentação oficial (Awin, Rakuten, Impact e Booking.com, esta última sob modalidade contratual/API específica).

A hipótese foi apenas parcialmente confirmada: fontes oficiais suficientes existem, porém acesso não é “público”. Quase sempre depende de aprovação da rede e de cada advertiser, contrato, credenciais e regras de atualização. Também estava errada a premissa de que Amazon PA-API continuava sendo a API atual: ela foi descontinuada em 15/05/2026 e substituída pela Creators API.

## 2. Contexto e problema Mercado Livre

A investigação anterior, [ML-OFFICIAL-API-FEASIBILITY.md](./ML-OFFICIAL-API-FEASIBILITY.md), demonstrou que URLs públicas válidas podem redirecionar clientes Node para verificação de conta. Não se deve contornar essa proteção. A API oficial encontrada atende contextos autorizados, principalmente sellers, mas não comprovou descoberta global equivalente às páginas públicas. Mercado Livre deve permanecer candidato a parceria futura, não fundação do catálogo.

## 3. Mudança de paradigma e metodologia

O pipeline desejável é `fonte autorizada → aquisição → normalização → inteligência → redirecionamento monetizado`. Foram priorizadas documentação de desenvolvedor, ajuda, termos e páginas oficiais de publisher. Os estados usados são **CONFIRMADO**, **INFERIDO** e **NÃO CONFIRMADO**; ausência de proibição não foi tratada como permissão.

Auditoria local: branch `codespace-working`; worktree inicialmente limpo. O código atual representa `curation_sources` ligado a `marketplaces`, resolve por `collectorResolver`, executa em `executeSource` e possui `mercadoLivreCollector`. `Product`/ofertas e nomenclatura ainda são orientados a varejo/venda. [CONFIGURABLE-SOURCES.md](../architecture/CONFIGURABLE-SOURCES.md) já prevê generalizar provider, canal e modalidade. Implicação: preservar o executor, mas separar Network, Marketplace, Merchant, Seller, Source e AcquisitionStrategy antes de adicionar novos formatos.

## 4. Providers pesquisados

### 4.1 Awin — PRIORIDADE A (92)

**CONFIRMADO.** É uma affiliate network. O [guia de product feed](https://help.awin.com/developers/docs/product-feed-publisher-guide-intro) afirma que comparadores são usuários principais e oferece milhões de produtos, preço, descontos, frete, imagens e deeplink. A página de [price comparison sites](https://help.awin.com/docs/price-comparison-sites) reconhece explicitamente esse modelo. A [Enhanced Product Feed API](https://help.awin.com/apidocs/retail-publisher-productapidocumentation-1) usa Bearer token e JSONL por advertiser/vertical/locale; lista Brasil e campos como disponibilidade, preço, `sale_price`, vigência, GTIN, marca, condição, idade, gênero e frete. Feeds tradicionais suportam [XML/CSV e HTTP/SFTP/FTP](https://developer.awin.com/docs/hosting-feeds).

- Brasil: **SIM** (locale/mercado e documentação pt-BR); PF/CNPJ, pagamento e prazo: **NÃO CONFIRMADO** nesta pesquisa.
- Oportunidades: **EXCELENTE**; preço atual nativo, promocional e período nativos quando o advertiser envia; desconto derivável.
- Monetização: CPS/CPA e, em alguns programas, CPC; deeplink/tracking por publisher.
- Escala: bulk feed por advertiser e API; qualidade/frequência dependem do merchant.
- Cache/IA: prazo geral de cache e uso para treino **NÃO ENCONTRADOS** nas páginas públicas consultadas; contrato deve ser validado.
- Riscos: técnico baixo; comercial médio (aprovações); dependência médio; compliance médio.

### 4.2 Rakuten Advertising — PRIORIDADE A (87)

**CONFIRMADO.** Affiliate network com Brasil. O [Product Catalog](https://pubhelp.rakutenadvertising.com/hc/en-us/articles/4412243602189-Product-Catalog-Overview) é explicitamente destinado a shopping/price comparison e search engines, via SFTP, XML ou pipe-delimited, com feeds completos, delta, categoria e globais. As [diretrizes](https://pubhelp.rakutenadvertising.com/hc/en-us/articles/11258487715981-Product-Catalog-Data-Feed-Implementation-Guidelines) documentam SKU, categoria, URL afiliada, preço e campos verticais; atualização costuma acompanhar envio diário do advertiser. Há aprovação técnica e do advertiser.

- Brasil: **SIM**; os [termos brasileiros](https://rakutenadvertising.com/pt-br/legal-notices/publisher-membership-agreement/) admitem pessoa física maior de 18 anos ou empresa, e [pagamentos](https://pubhelp.rakutenadvertising.com/hc/en-us/articles/360059980311-Payment-Options) incluem depósito local no Brasil.
- Oportunidades: **EXCELENTE**; preço/desconto conforme feed, promoções por conteúdo do advertiser.
- Escala: excelente para bulk/full/delta; menos conveniente que API de busca moderna.
- IA/cache: política pública consultada menciona conteúdo gerado por IA em endorsements, não autorização ampla para treinamento; **RESTRITO/NÃO CLARO**.
- Riscos: técnico baixo; comercial médio; dependência médio; compliance médio.

### 4.3 Impact.com — PRIORIDADE B (82)

**CONFIRMADO** para produto; Brasil **PARCIAL**. Partners podem baixar catálogos pela interface, [FTP ou API](https://help.impact.com/partner/); arquivos grandes são destinados a FTP/API e feeds podem ser CSV/TSV/XML. A documentação de catálogo afirma utilidade para comparison engine/storefront; catálogos só ficam pesquisáveis após relação aprovada com a marca. A [API de itens](https://integrations.impact.com/impact-publisher/reference/list-all-items-for-a-catalog) pagina normalmente em 100; [rate limits](https://integrations.impact.com/impact-publisher/reference/rate-limits) publicam 3.000 chamadas/h para Product Search e 1.000/h para outras APIs. Promoções podem ser publicadas nos feeds/API.

- Brasil: interface pt-BR e operação global são evidências, mas elegibilidade/pagamento de publisher brasileiro: **NÃO CONFIRMADO**.
- Oportunidades: **EXCELENTE/BOA**, condicionada à completude do catálogo da marca.
- Comparador: **EXPLICITAMENTE SUPORTADO**.
- IA/cache/custos: **NÃO CLARO/NÃO CONFIRMADO**; validar contrato e programa.
- Riscos: técnico baixo; comercial médio; dependência médio; compliance médio.

### 4.4 Admitad — PRIORIDADE B (79)

**CONFIRMADO.** Affiliate network com operação brasileira. A [página para afiliados](https://www.admitad.com/pt-br/affiliates/) documenta XML Feed, deeplink, shortlink, cinco SubIDs, preços/estoque e automação em escala. Os [termos para entidades brasileiras](https://www.admitad.com/terms-for-publishers-brazil-entities/) abrangem pessoas físicas e jurídicas, tráfego brasileiro, BRL e catálogos XML fornecidos pelos advertisers. O [portal para content publishers](https://www.admitad.com/pt/content-publishers/) menciona API, links e cupons.

- Brasil: **SIM**; aprovação e condições variam por programa.
- Oportunidades: **BOA**; preço/estoque e cupons nativos quando enviados; preço original/desconto não são garantidos globalmente.
- Comparador: **APARENTEMENTE COMPATÍVEL**, não explicitamente comprovado.
- Cache/IA/rate limit público: **NÃO CONFIRMADO**.
- Riscos: técnico médio; comercial médio; dependência médio; compliance médio.

### 4.5 CJ — PRIORIDADE B (76)

**CONFIRMADO** para feed/API; Brasil **NÃO CONFIRMADO**. O [Developer Portal](https://developers.cj.com/docs/tracking-integration/overview) oferece Product Feed GraphQL para pesquisar por preço, moeda, país, área atendida e UPC, além de APIs de advertisers, links e ofertas financeiras. A documentação oficial descreve feeds de shopping, travel e finance e [Product Search API](https://junction.cj.com/article/product-discovery-improved-cjs-new-product-search-api). Feeds incluem imagem, preço, desconto, descrição e exportação/FTP.

- Oportunidades: **EXCELENTE/BOA**.
- Comparação: feeds permitem encontrar vários retailers para um produto, mas permissão explícita para “price comparison publisher” não foi localizada: **APARENTEMENTE COMPATÍVEL**.
- Brasil, pagamentos, cache, IA e preço ao publisher: **NÃO CONFIRMADO**.
- Riscos: técnico baixo; comercial alto para Brasil ainda não validado; dependência médio; compliance médio.

### 4.6 Booking.com — PRIORIDADE B (74)

**CONFIRMADO** para viagens, mediante contrato. A [Demand API 3.2](https://developers.booking.com/demand/docs/open-api/3.2/demand-api) dá a Affiliate Partners busca, disponibilidade/preço em tempo real, detalhes, fotos, reviews, acomodações, carros e voos, em JSON; URLs retornadas carregam o affiliate ID. Os [pré-requisitos](https://developers.booking.com/demand/docs/getting-started/prerequisites) exigem Managed Affiliate Partner, contrato, account manager, token e Affiliate ID. Termos atuais distinguem modalidade de API que pode oferecer comparação de preços.

- Brasil: inventário/consumidor suportado; aceitação e pagamento de publisher brasileiro: **NÃO CONFIRMADO**.
- Oportunidades: **BOA** para disponibilidade contextual, não “desconto de MSRP”.
- Escala: API paginada e endpoint incremental de alterações; até cerca de 5.000 IDs por chamada de mudanças.
- Blocker comercial: acesso managed/contratual.
- Riscos: técnico médio; comercial alto; dependência alto; compliance alto.

### 4.7 Amazon Associates / Creators API — PRIORIDADE B (72), BLOCKER

**CONFIRMADO.** A antiga Product Advertising API foi descontinuada em 15/05/2026. A [Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction) é a sucessora para publishers e oferece SearchItems, GetItems, GetVariations e BrowseNodes. O [SearchItems](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/operations/search-items) aceita keywords, marca, nó, condição, preço, reviews e `minSavingPercent`, retorna OffersV2, preço, deal, seller e URL afiliada. O [locale Brasil](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/locale-reference/brazil) usa Amazon.com.br/BRL, mas tem conjunto publicado de índices menor que outros mercados.

- Brasil: **SIM**.
- Blocker: conta definitivamente aceita e pelo menos dez vendas qualificadas nos 30 dias anteriores para acesso.
- Oportunidades: **EXCELENTE** por consulta; preço/deals/desconto disponíveis conforme recursos solicitados.
- Escala: **LIMITADA** para catálogo massivo: SearchItems retorna no máximo 10 itens; cotas TPS dependem da receita. Não há bulk feed publisher comprovado.
- Cache: [boas práticas](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/concepts/best-programming-practices) limitam offers/BrowseNodeInfo a 1h e outros dados/imagens a 1 dia; links não devem ser alterados.
- IA: **NÃO CLARO**; termos/licença precisam de revisão jurídica específica.
- Riscos: técnico médio; comercial alto; dependência alto; compliance alto.

### 4.8 Shopee — NÃO PRIORIZAR (47), BLOCKER

**CONFIRMADO** no Brasil como marketplace e programa de afiliados, com PF/PJ, links personalizados e comissões. **NÃO CONFIRMADO:** documentação pública oficial de Affiliate API, product feed, catálogo bulk, preço programático ou deeplink API. A Open Platform não deve ser presumida como publisher API. Sem isso, a integração automatizada autorizada não está demonstrada.

- Oportunidades: potencialmente boa no site, **INADEQUADA** como fonte técnica hoje.
- Comparador/cache/IA: **NÃO CONFIRMADO**.
- Riscos: técnico crítico; comercial médio; dependência alto; compliance alto.

### 4.9 Magalu — NÃO PRIORIZAR (43), BLOCKER

**CONFIRMADO** no Brasil. O [portal Magalu Devs](https://developers.magalu.com/docs/) documenta OAuth2, produtos, estoque, preço e webhooks, mas os escopos e consentimento são explicitamente de seller. A [API de Portfólio](https://developers.magalu.com/docs/apis/products/overview/index.html) gerencia SKUs do seller; não é descoberta global nem publisher feed. Programa de afiliado não foi acompanhado de documentação pública de API/feed para publisher.

- Oportunidades publisher: **INADEQUADA/NÃO CONFIRMADA**.
- Comparador, feed, link programático, cache e IA: **NÃO CONFIRMADO**.
- Riscos: técnico crítico; comercial médio; dependência alto; compliance alto.

### 4.10 Mercado Livre — NÃO PRIORIZAR AGORA (39), BLOCKER

**CONFIRMADO** no Brasil e com APIs oficiais para sellers/catálogos autorizados. Conforme a spike anterior, não foi comprovada busca global oficial equivalente às páginas públicas, product feed para publishers ou API tecnológica pública do programa de afiliados. HTML é bloqueável e seus termos vedam interferência/contorno de medidas técnicas. Deve permanecer no roadmap para parceria/feed oficial ou sellers autorizados.

- Oportunidades: **LIMITADA** aos recursos autorizados do seller; inadequada para descoberta global atual.
- Riscos: técnico crítico; comercial alto; dependência alto; compliance crítico se baseado em scraping.

## 5. Product feeds, APIs e campos

Legenda: **N** nativo, **D** derivável, **E** endpoint adicional, **—** não disponível, **?** não confirmado. Valores representam capacidade documentada, não garantia de preenchimento por todo advertiser.

| Provider | ID/SKU/GTIN | Título/categoria | Marca/atributos | Preço atual | Original/promo/% | Estoque/condição | Frete | Imagens | URL/deeplink | Seller/merchant | Rating/reviews | Atualização |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Awin | N | N | N | N | N/N/D | N/N | N | N | N | N | ? | N |
| Rakuten | N | N | N | N | N/D/D | N/? | N | N | N | N | ? | N |
| Impact | N | N | N | N | N/N/D | N/N | N | N | N | N | ? | N |
| Admitad | N | N | N/? | N | ?/?/D | N/? | ? | N | N | N | ? | N |
| CJ | N | N | N | N | N/N/D | N/N | N | N | N | N | ? | N |
| Booking | N | N | N | N | —/D/D | N/N | — | N | N | N | N | N/E |
| Amazon | N | N | N/E | N | N/N/N | N/N | E | N | N | N | E | E |
| Shopee | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| Magalu publisher | — | — | — | — | — | — | — | — | — | — | — | — |
| Mercado Livre global | — | — | — | — | — | — | — | — | — | — | — | — |

Feeds comprovados: Awin (JSONL e XML/CSV), Rakuten (XML/pipe, full/delta), Impact (CSV/TSV/XML/API/FTP), Admitad (XML) e CJ (shopping/travel/finance + GraphQL). Download incremental é claramente documentado pela Rakuten; nos demais, atualização e estratégia variam por catálogo/merchant.

## 6. Preço, desconto e monetização

| Provider | Atual | Anterior | Promo | % desconto | Validade | Cupom/cashback | Frete | Capacidade |
|---|---|---|---|---|---|---|---|---|
| Awin | N | conforme feed | N | D | N | programa | N | EXCELENTE |
| Rakuten | N | conforme feed | N | D | conforme feed | promoções | N | EXCELENTE |
| Impact | N | conforme feed | N | D | N | promoções | N | EXCELENTE |
| Admitad | N | ? | programa | D se preços | ? | N | ? | BOA |
| CJ | N | N | N | D | conforme feed | N | N | EXCELENTE |
| Booking | N contextual | — | deals | D | datas da estadia | ? | — | BOA |
| Amazon | N | N | N/deal | N/D | deal | cupons variáveis | E | EXCELENTE, baixa escala |
| Shopee | ? | ? | ? | ? | ? | programa | ? | INADEQUADA tecnicamente |
| Magalu | seller apenas | seller | seller | D | seller | ? | seller | INADEQUADA publisher |
| Mercado Livre | seller apenas | ? | endpoints autorizados | D | ? | programa separado | E | LIMITADA |

O modelo principal é CPS/CPA; Admitad também cobre CPL, Booking remunera reservas e redes podem ter CPC/programas especiais. Percentual de comissão não deve ser normalizado como atributo do produto: pertence à relação `AffiliateProgram/CommissionRule` e pode variar por advertiser, categoria e tempo.

## 7. Comparadores, IA, cache e compliance

| Provider | Comparador/content commerce | Cache/armazenamento | IA/derived data |
|---|---|---|---|
| Awin | EXPLICITAMENTE SUPORTADO | contrato/programa; prazo público não localizado | NÃO ENCONTRADO |
| Rakuten | EXPLICITAMENTE SUPORTADO | feed deve acompanhar atualizações; prazo não localizado | RESTRITO/NÃO CLARO |
| Impact | EXPLICITAMENTE SUPORTADO | catálogo da marca; regras contratuais | NÃO ENCONTRADO |
| Admitad | APARENTEMENTE COMPATÍVEL | NÃO CONFIRMADO | NÃO ENCONTRADO |
| CJ | APARENTEMENTE COMPATÍVEL | NÃO CONFIRMADO | NÃO ENCONTRADO |
| Booking | SUPORTADO em modalidade contratual | sincronização exigida conforme contrato/API | NÃO CLARO |
| Amazon | APARENTEMENTE COMPATÍVEL | 1h offers; 1 dia demais dados/imagens | NÃO CLARO |
| Shopee | NÃO CONFIRMADO | NÃO CONFIRMADO | NÃO ENCONTRADO |
| Magalu | NÃO CONFIRMADO | seller API não autoriza catálogo publisher | NÃO ENCONTRADO |
| Mercado Livre | NÃO CONFIRMADO | APIs/termos por contexto autorizado | NÃO CLARO |

Antes de produção, cada contrato deve validar: armazenamento de preço/imagem/descrição, expiração, atribuição, uso de SubID, modificação de links, exibição comparativa, recomendações automatizadas, uso de conteúdo em modelos e exclusão após término. “Não encontrado” não significa permitido.

## 8. Brasil, custo e escala

| Provider | Brasil | PF | Aprovação | Pagamento/moeda | Custo inicial | Escala conceitual |
|---|---|---|---|---|---|---|
| Awin | SIM | ? | rede + advertiser | ? | baixo/não confirmado | 1M via feeds |
| Rakuten | SIM | SIM | técnica + advertiser | depósito/moeda local | gratuito/não confirmado | 1M via full/delta |
| Impact | PARCIAL | ? | plataforma + marca | ? | não confirmado | 1M via feeds/API |
| Admitad | SIM | SIM | rede + programa | BRL | gratuito/não confirmado | 1M via XML, validar SLA |
| CJ | NÃO CONFIRMADO | ? | rede + advertiser | ? | não confirmado | 1M via feeds/API |
| Booking | PARCIAL | ? | contrato managed | contrato | negociado | 100k+, API/incremental |
| Amazon | SIM | SIM (programa) | final + 10 vendas/30d | programa BR | gratuito | ruim para varredura de 1M |
| Shopee | SIM | SIM/PJ | manual, prazo oficial até 7 dias úteis | programa BR | gratuito | blocker sem API/feed |
| Magalu | SIM | programa | manual | programa BR | gratuito | blocker sem publisher API |
| Mercado Livre | SIM | programa | programa | programa BR | gratuito | blocker sem descoberta oficial |

Para 10/100 fontes, APIs e feeds são adequados. Para 1.000 fontes ou 100 mil/1 milhão de ofertas, bulk feeds completos/delta devem ser a base; APIs item a item são enriquecimento. Amazon deve ser consulta seletiva e cache obediente, não varredura. Rate limits não publicados devem ser obtidos no onboarding e tratados como quota configurável.

## 9. Matriz estratégica e score BeUpFree

Pesos mantidos conforme proposta: autorização 20; dados 15; feed/API 15; preço/desconto 10; monetização 10; Brasil 10; escala 10; diversidade 5; integração 5. O score é priorização heurística; blockers prevalecem.

| # | Provider | Tipo | Feed | API publisher | Brasil | Comparador | Custo | Riscos T/C/D/Comp | Score | Classe | Blocker |
|---:|---|---|---|---|---|---|---|---|---:|---|---|
| 1 | Awin | AFFILIATE_NETWORK | SIM | SIM | SIM | explícito | baixo/? | B/M/M/M | 92 | A | contrato/cache a validar |
| 2 | Rakuten | AFFILIATE_NETWORK | SIM | feed/SFTP | SIM | explícito | gratuito/? | B/M/M/M | 87 | A | aprovação por advertiser |
| 3 | Impact | PARTNER_PLATFORM | SIM | SIM | PARCIAL | explícito | ? | B/M/M/M | 82 | B | Brasil/pagamento a validar |
| 4 | Admitad | AFFILIATE_NETWORK | SIM | SIM | SIM | aparente | gratuito/? | M/M/M/M | 79 | B | comparador/cache a validar |
| 5 | CJ | AFFILIATE_NETWORK | SIM | SIM | ? | aparente | ? | B/A/M/M | 76 | B | operação Brasil não confirmada |
| 6 | Booking.com | MARKETPLACE/PARTNER | não | SIM | PARCIAL | contratual | negociado | M/A/A/A | 74 | B | managed contract |
| 7 | Amazon | MARKETPLACE/AFFILIATE | não | SIM | SIM | aparente | gratuito | M/A/A/A | 72 | B | 10 vendas/30d + cache/quota |
| 8 | Shopee | MARKETPLACE/AFFILIATE | ? | ? | SIM | ? | gratuito | C/M/A/A | 47 | não priorizar | API/feed publisher não comprovado |
| 9 | Magalu | MARKETPLACE/AFFILIATE | não comprovado | seller somente | SIM | ? | gratuito | C/M/A/A | 43 | não priorizar | publisher API/feed ausente |
| 10 | Mercado Livre | MARKETPLACE/AFFILIATE | não comprovado | seller somente | SIM | ? | gratuito | C/A/A/C | 39 | não priorizar | descoberta global/feed ausente |

## 10. Top 5 e estratégia de entrada

1. **Awin:** melhor combinação de comparação explicitamente suportada, feed rico, Brasil e deeplink. Primeiro teste: obter conta publisher, aderir a 2–3 advertisers brasileiros e validar JSONL, freshness e tracking.
2. **Rakuten:** full/delta feed maduro, comparação explícita e Brasil/PF/pagamento confirmados. Teste: aprovação técnica + um catálogo brasileiro via SFTP.
3. **Impact:** API/feed moderno e promoções, boa escala. Teste: confirmar onboarding/pagamento Brasil e exportar catálogo de uma marca.
4. **Admitad:** Brasil, XML/API, cupons e ampla diversidade. Teste: verificar programas com feed, esquema real e autorização para comparação/IA.
5. **CJ:** feed/API ricos e múltiplas verticais. Teste anterior à integração: confirmar publisher brasileiro, pagamento e advertisers locais; se falhar, Booking assume o quinto experimento, focado em viagens.

Sequência recomendada: (1) POC Awin; (2) POC Rakuten; (3) modelo normalizado e ingestão idempotente orientados a feed; (4) Impact/Admitad; (5) APIs verticais seletivas Amazon/Booking; (6) parcerias oficiais futuras Shopee/Magalu/Mercado Livre. Uma network reduz conectores, mas não elimina aprovação/qualidade por merchant nem dependência da rede.

## 11. Arquitetura conceitual recomendada

```text
Provider (entidade técnica/contratual)
 ├─ ProviderAccount / credentials / quotas
 ├─ Network ─ Advertiser/Merchant
 ├─ Marketplace ─ Seller
 └─ Source
      └─ SourceDefinition (escopo declarativo)
           └─ AcquisitionStrategy (feed | API | authorized export)
                └─ Collector/Connector
                     ├─ NormalizedProduct (identidade do bem/serviço)
                     └─ NormalizedOffer (condição comercial contextual)
                          └─ AffiliateProgram + TrackingLink
```

Separações obrigatórias:

- `Provider` não é sinônimo de marketplace; Awin é network e Booking é marketplace/partner platform.
- `Merchant/Advertiser` contrata a rede; `Seller` publica uma oferta em marketplace.
- `Product/Asset` descreve o bem, acomodação, veículo ou serviço; `Offer` descreve preço, disponibilidade, modalidade (sale/rent/booking/subscription), vendedor e vigência.
- `Source` guarda origem/auditoria; `Feed` é uma aquisição versionada; `SourceDefinition` é configuração estruturada independente da credencial.
- `NormalizedOffer.destinationUrl` deve guardar destino canônico e `TrackingLink` separado, renovável e associado ao programa/SubID.
- Conectores entregam capacidades declaradas (`bulk`, `incremental`, `pricing`, `deeplink`, `reviews`); a inteligência só lê modelos normalizados.

## 12. Riscos e decisão

Maiores riscos: aprovação comercial, qualidade desigual de merchants, políticas de cache/IA, mudança de quotas, dependência de redes, atribuição e expiração de links, cobertura Brasil ainda não confirmada em Impact/CJ/Booking, e identidade cross-merchant sem GTIN confiável. Comparação por título aproximado deve ser marcada probabilística.

**Decisão: GO COM RESTRIÇÕES.** O modelo é viável e monetizável sem scraping, sobretudo por affiliate networks. Não continuar CURA003 se ela aprofundar o collector HTML ou o modelo `marketplace` atual. Primeiro executar uma POC isolada de **novo tipo de provider/feed Awin**, sem produção, validando contrato e amostra real; depois ajustar a proposta de CURA003 ao modelo genérico comprovado.

Próximos passos:

1. validação jurídica/comercial dos termos Awin e Rakuten: comparador, IA, cache, imagem, preço, retenção e deeplink;
2. onboarding publisher e seleção de 2–3 merchants brasileiros em cada rede;
3. POC fora do banco principal: download, checksum, esquema, freshness, 100 ofertas e tracking/SubID;
4. medir completude de GTIN, preço original, promo, disponibilidade, categoria e imagem;
5. definir contrato `NormalizedProduct/NormalizedOffer` somente após comparar feeds reais;
6. manter Mercado Livre no roadmap de parceria autorizada.

## 13. Fontes oficiais principais

- Awin: [Product Feed guide](https://help.awin.com/developers/docs/product-feed-publisher-guide-intro), [price comparison](https://help.awin.com/docs/price-comparison-sites), [Enhanced Feed API](https://help.awin.com/apidocs/retail-publisher-productapidocumentation-1), [feed hosting](https://developer.awin.com/docs/hosting-feeds).
- Amazon: [Creators API](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction), [SearchItems](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/api-reference/operations/search-items), [Brasil](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/locale-reference/brazil), [cache/quota](https://affiliate-program.amazon.com/creatorsapi/docs/en-us/concepts/best-programming-practices).
- Impact: [Publisher API](https://integrations.impact.com/impact-publisher/reference/), [catalog items](https://integrations.impact.com/impact-publisher/reference/list-all-items-for-a-catalog), [rate limits](https://integrations.impact.com/impact-publisher/reference/rate-limits).
- Rakuten: [Product Catalog](https://pubhelp.rakutenadvertising.com/hc/en-us/articles/4412243602189-Product-Catalog-Overview), [implementation](https://pubhelp.rakutenadvertising.com/hc/en-us/articles/11258487715981-Product-Catalog-Data-Feed-Implementation-Guidelines), [Brazil agreement](https://rakutenadvertising.com/pt-br/legal-notices/publisher-membership-agreement/).
- Admitad: [Affiliates Brazil](https://www.admitad.com/pt-br/affiliates/), [Brazil terms](https://www.admitad.com/terms-for-publishers-brazil-entities/), [content publishers](https://www.admitad.com/pt/content-publishers/).
- CJ: [Developer Portal](https://developers.cj.com/docs/tracking-integration/overview), [Product Search](https://junction.cj.com/article/product-discovery-improved-cjs-new-product-search-api).
- Booking.com: [Demand API 3.2](https://developers.booking.com/demand/docs/open-api/3.2/demand-api), [prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites), [authentication](https://developers.booking.com/demand/docs/development-guide/authentication).
- Magalu: [Magalu Devs](https://developers.magalu.com/docs/), [Portfolio API](https://developers.magalu.com/docs/apis/products/overview/index.html), [seller OAuth](https://developers.magalu.com/docs/first-steps/create-an-application/authentication-authorization/index.html).
- Mercado Livre: referências e termos oficiais consolidados em [ML-OFFICIAL-API-FEASIBILITY.md](./ML-OFFICIAL-API-FEASIBILITY.md).

## 14. Limitações da pesquisa

Não foram criadas contas nem aceitos contratos; portanto não foi possível inspecionar catálogos restritos, comissões reais ou schemas específicos de advertisers. Valores ausentes permanecem “não confirmado”. Scores não substituem due diligence jurídica/comercial nem amostra operacional.
