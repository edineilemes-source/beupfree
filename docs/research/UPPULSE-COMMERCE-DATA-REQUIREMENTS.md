# Contrato ideal de dados comerciais do UpPulse

**Origem:** SPIKE-GOOGLE001, SPIKE-SOURCES001 e SPIKE-ML001

**Data:** 18 de agosto de 2026

**Estado:** requisitos conceituais; nenhuma alteração de schema ou integração autorizada.

## 1. Objetivo

Definir o menor contrato capaz de sustentar descoberta, facetas, normalização, múltiplas ofertas, comparação e inteligência sem depender do formato de um marketplace. O contrato deve aceitar composição de fontes autorizadas, preservar proveniência e recusar conclusões quando os dados não forem comparáveis.

Prioridades:

- **OBRIGATÓRIO:** necessário para publicar uma oferta confiável no MVP.
- **IMPORTANTE:** necessário para facetas e comparação de boa qualidade; ausência deve reduzir capacidade/score, não ser inventada.
- **DESEJÁVEL:** melhora decisão e diferenciação, mas não bloqueia o primeiro feed.
- **FUTURO:** requer maturidade, histórico, personalização ou fontes adicionais.

## 2. Princípios do contrato

1. `Product` identifica o bem; `Variant` identifica uma configuração; `Offer` registra uma condição comercial de um merchant no tempo.
2. `Provider`, `Network`, `Merchant/Advertiser`, `Marketplace` e `Seller` não são sinônimos.
3. URL canônica e `AffiliateLink` são recursos distintos.
4. Todo campo externo relevante carrega fonte, captura, confiança e regras de uso.
5. Valor desconhecido é `null`/ausente, nunca zero, `false` ou texto inferido sem marcação.
6. Desconto só é calculado de preços comparáveis, mesma moeda, condição e variante.
7. Rating deve identificar sujeito, escala, fonte e contagem.
8. Frete depende de destino, modalidade e tempo; `freeShipping` isolado é insuficiente.
9. Facetas derivadas de título podem existir como fallback, com proveniência/confiança, mas não equivalem a atributo oficial.
10. Combinar fontes exige direitos compatíveis; “público” não significa reutilizável.

## 3. Entidades mínimas

```text
Provider ─ Source ─ SourcePolicy
   ├── Merchant/Advertiser ─ Seller
   └── Product ─ Variant ─ Offer
          │          │        ├── Promotion
          │          │        ├── ShippingOption
          │          │        ├── AvailabilitySnapshot
          │          │        ├── PriceHistory
          │          │        └── DestinationLink/AffiliateLink
          │          ├── AttributeValue
          │          └── MediaAsset
          ├── Brand/Category
          └── Rating/ReviewSummary
```

`NormalizedProduct` corresponde conceitualmente a `Product` mais identidade/atributos canônicos. `NormalizedOffer` corresponde a `Offer` mais vínculo explícito com variante, merchant/seller e evidências temporais.

## 4. OBRIGATÓRIO

| Campo | Entidade | Tipo conceitual | Finalidade | Filtros | Comparação | Scoring | Fonte potencial |
|---|---|---|---|---|---|---|---|
| `id` | Product | UUID/string estável | identidade interna | — | agrupar | — | BeUpFree |
| `canonicalTitle` | Product | string | busca/exibição | texto | reconhecer produto | qualidade indireta | Awin; merchant autorizado |
| `brandId/name` | Product/Brand | ref + string | identidade e faceta | marca | equivalência | preferência futura | feed; merchant |
| `categoryId/path` | Product/Category | ref + lista | taxonomia contextual | categoria | comparar pares adequados | pesos por categoria | feed + mapeamento BeUpFree |
| `primaryImage` | MediaAsset | URL + metadata | reconhecimento visual | — | exibição | — | feed/merchant, sob licença |
| `externalIdentifiers` | Product/Variant | mapa `GTIN/MPN/SKU/model` | matching/deduplicação | modelo | igualdade/confiança | confiança do matching | Awin; merchant; fabricante |
| `variantId` | Variant | UUID/string | unidade comprável | tamanho/cor etc. | equivalência exata | — | BeUpFree + feed |
| `variantAttributes` | Variant | mapa tipado | distinguir configurações | atributos contextuais | impedir comparação falsa | adequação futura | feed/merchant |
| `offerId` | Offer | UUID/string | identidade comercial | — | oferta | — | BeUpFree |
| `externalOfferId` | Offer | string | idempotência/freshness | — | rastrear mesma oferta | confiança | provider/feed |
| `productId/variantId` | Offer | refs | vínculo comercial correto | — | produto/variante | — | normalização BeUpFree |
| `merchantId` | Offer/Merchant | ref | dono comercial | loja | comparar sellers | confiança futura | network/feed |
| `sellerId/name` | Offer/Seller | ref/string anulável | seller real em marketplace | seller | seller grid | reputação futura | marketplace/feed |
| `currentPrice` | Offer | decimal | preço vigente | preço | custo | preço relativo | Awin/feed/merchant |
| `currency` | Offer | ISO 4217 | significado do preço | moeda | conversão/compatibilidade | obrigatório para preço | provider |
| `condition` | Offer | enum | novo/usado/recondicionado | condição | comparabilidade | penalidade/regra futura | feed/merchant |
| `availability` | Offer | enum | comprabilidade | disponibilidade | eliminar indisponível | elegibilidade | feed/API |
| `status` | Offer | enum | ciclo interno | ativo | elegibilidade | elegibilidade | BeUpFree |
| `canonicalUrl` | DestinationLink | URL | destino auditável | — | ação | — | merchant/feed |
| `affiliateUrl` | AffiliateLink | URL anulável | monetização autorizada | — | ação | não usar como qualidade | Awin/network |
| `capturedAt` | Offer/Evidence | timestamp | freshness | recentes | validade | confiança/freshness | collector |
| `lastVerifiedAt` | Offer/Evidence | timestamp | confirmar vigência | recentes | validade | confiança/freshness | collector/API |
| `sourceId` | Evidence | ref | auditoria | fonte | explicar divergência | confiança | BeUpFree |
| `usagePolicyId` | SourcePolicy | ref | licença/cache/exibição | — | permitir uso | permitir derivados | contrato/provider |

### Regras de publicação obrigatórias

- Não publicar oferta sem preço positivo, moeda, disponibilidade, merchant, destino e timestamp.
- Não agrupar por similaridade textual como equivalência certa. Sem identificador forte, guardar `matchConfidence` e método.
- Não promover affiliate URL a URL canônica.
- Produto sem variante explícita pode usar variante padrão somente com `variantCompleteness=unknown`.
- Oferta vencida/desatualizada deve sair do ranking mesmo que permaneça para auditoria.

## 5. IMPORTANTE

| Campo | Entidade | Tipo conceitual | Finalidade | Filtros | Comparação | Scoring | Fonte potencial |
|---|---|---|---|---|---|---|---|
| `description` | Product | texto | entendimento | texto futuro | contexto | — | merchant/fabricante |
| `highlights` | Product | lista de strings | leitura rápida | atributo | diferenças | explicação | merchant/fabricante |
| `attributes` | Product/Variant | valores tipados + unidade | ficha flexível | cor, tamanho, gênero, idade, esporte, uso, material etc. | lado a lado | adequação/cobertura | merchant/feed |
| `attributeProvenance` | AttributeValue | enum + source + confidence | transparência | qualidade futura | confiabilidade | confiança | BeUpFree/provider |
| `additionalImages` | MediaAsset | lista URL | avaliar variante/produto | — | visual | — | feed/merchant |
| `originalPrice` | Offer | decimal anulável | base de promoção | promoção | economia | desconto | feed/merchant |
| `discountPercent` | Offer | decimal + source | oportunidade | desconto | economia | desconto | informado ou derivado |
| `saleEffectivePeriod` | Offer/Promotion | intervalo | validade da promoção | promoção ativa | preço no tempo | confiança | feed/merchant |
| `promotionId/type` | Promotion | ref + enum | distinguir sale/cupom/cashback | promoção | condição | valor futuro | Awin; merchant |
| `promotionTerms` | Promotion | estrutura/texto | elegibilidade | tipo | custo real | cautela | merchant/network |
| `stockState/quantity` | AvailabilitySnapshot | enum/número anulável | disponibilidade real | estoque | desempate | urgência cautelosa | merchant/API |
| `shippingDestination` | ShippingOption | país/região/CEP scope | contextualizar entrega | entrega | custo total | logística | merchant/API |
| `shippingCost` | ShippingOption | decimal/moeda | custo total | frete | custo total | preço efetivo | merchant/API |
| `shippingMin/MaxDays` | ShippingOption | inteiro | prazo | prazo | condição | logística | merchant/API |
| `freeShipping` | ShippingOption | boolean calculado/expresso | faceta | frete grátis | custo | frete | derivado com destino |
| `installment` | Offer | parcelas/taxa/total | condição BR | parcela | custo financeiro | futuro | feed/merchant |
| `merchantName/domain` | Merchant | string/domain | transparência | loja | seller grid | — | network/merchant |
| `merchantRating` | Rating | valor/escala/contagem | confiança da loja | avaliação seller | risco | confiança futura | fonte licenciada |
| `productRating` | Rating | valor/escala | qualidade | avaliação | produto | rating | feed/reviews licenciados |
| `reviewCount` | ReviewSummary | inteiro | robustez do rating | avaliação | evidência | reviews | fonte licenciada |
| `ratingSubject/source` | Rating | enum/ref | não misturar loja/produto | — | coerência | confiança | fonte licenciada |
| `matchConfidence/method` | ProductMatch | decimal + enum | deduplicação auditável | qualidade | habilitar/bloquear | confiança | BeUpFree |
| `dataCompleteness` | Evidence | mapa/percentual | controlar UX/score | qualidade | estados ausentes | cobertura | BeUpFree |

### Vocabulário de atributos do vertical inicial

O contrato não deve criar colunas universais para tênis, mas o vocabulário de calçados deve prever:

- `color`, `size`, `sizeSystem`, `gender`, `ageGroup`;
- `sport`, `usageType`, `terrain`, `support`, `cushioning`;
- `material`, `technology`, `closure`, `heelDrop`, `weight` quando disponíveis;
- valores normalizados, label original, unidade, locale, fonte e confiança.

## 6. DESEJÁVEL

| Campo | Entidade | Tipo conceitual | Finalidade | Filtros | Comparação | Scoring | Fonte potencial |
|---|---|---|---|---|---|---|---|
| `reviewDistribution` | ReviewSummary | buckets 1–5 | interpretar rating | rating | robustez | confiança | reviews licenciados |
| `reviewSummary` | ReviewSummary | texto + provenance | síntese | temas | prós/contras | explicação, não nota cega | fonte/licença de IA |
| `warranty` | Offer/Product | duração/termos | risco | garantia | valor | custo-benefício | merchant/fabricante |
| `returnPolicy` | Merchant/Offer | prazo/condições | risco | devolução | condições | confiança | merchant |
| `sellerBadges` | Seller | lista + emissor | confiança | seller | desempate | cauteloso | marketplace |
| `couponCode` | Promotion | string protegida | economia | cupom | preço efetivo | valor | affiliate network |
| `cashback` | Promotion | decimal/termos | economia indireta | cashback | separar de preço | futuro | partner/network |
| `unitPrice` | Offer | decimal/unidade | comparar embalagens | faixa | custo unitário | preço | merchant/feed |
| `localAvailability` | Offer | loja/local | descoberta local | perto de mim | conveniência | futuro | merchant autorizado |
| `similarityEdges` | Product | refs + motivo | alternativas | necessidade | substitutos | recomendação | BeUpFree |
| `categorySpecificScoreInputs` | AttributeValue | mapa | adequação | uso | custo-benefício | score por intenção | produto + regras UpPulse |
| `sourceFreshnessSla` | SourcePolicy | duração | saúde | — | confiança | freshness | contrato/provider |
| `cacheExpiresAt` | Evidence | timestamp | conformidade | — | disponibilidade | elegibilidade | headers/contrato |
| `deletionRequiredAt` | Evidence | timestamp | término/revogação | — | — | elegibilidade | contrato |

## 7. FUTURO

| Campo | Entidade | Tipo conceitual | Finalidade | Filtros | Comparação | Scoring | Fonte potencial |
|---|---|---|---|---|---|---|---|
| `priceHistory` | PriceHistory | série temporal | tendência/oportunidade | menor em N dias | preço típico | oportunidade | capturas permitidas/feed histórico |
| `typicalPriceBand` | PriceInsight | min/mediana/max + janela | contextualizar sale | oportunidade | preço normal | UpPulse Score | derivado autorizado |
| `targetPrice` | UserAlert | decimal/moeda | alerta | — | — | personalização | usuário |
| `alertRules` | UserAlert | expressão/versionamento | alertas inteligentes | filtros salvos | — | oportunidade | usuário + BeUpFree |
| `userPreferences` | UserProfile | valores consentidos | personalização | marcas/uso/fit | adequação | score pessoal | usuário |
| `interactionSignals` | Event | eventos consentidos | relevância | — | — | aprendizado | BeUpFree |
| `totalCostOfOwnership` | DecisionInsight | decimal/componentes | longo prazo | custo | custo-benefício | score | fontes por vertical |
| `sustainability/identity` | Merchant/Product | claims + certificação | preferência | atributos | valor | opcional | fonte certificadora |
| `forecast` | PriceInsight | faixa/confiança | timing | — | oportunidade | nunca como certeza | modelo próprio licenciado |
| `explanationArtifact` | DecisionResult | texto + evidências + versão | “por que?” | — | auditabilidade | saída do engine | BeUpFree |
| `worthPayingMore` | DecisionResult | YES/NO/DEPENDS + razões | decisão | — | diferencial | saída versionada | BeUpFree |

Histórico próprio só pode ser construído se o contrato da fonte permitir armazenamento temporal e derivados. Se não permitir, o campo permanece ausente mesmo que o preço atual seja exibível.

## 8. Filtros mínimos por estágio

### MVP

- texto livre;
- categoria/tipo;
- marca;
- preço mínimo/máximo;
- promoção/desconto;
- condição;
- disponibilidade;
- merchant/seller;
- frete grátis quando contextualizado;
- atributos prioritários do vertical: cor, tamanho, gênero, idade, esporte/uso;
- avaliação apenas quando sujeito/fonte forem coerentes.

### Evolução

- prazo e custo de frete por destino;
- garantia/devolução;
- modelo/especificações técnicas por categoria;
- local availability;
- histórico e oportunidade;
- preferências pessoais explícitas.

Facetas devem ser calculadas sobre a população filtrada, manter valores selecionados removíveis e indicar contagem. Campos inferidos do título devem ser sinalizados e não misturados silenciosamente com atributos oficiais.

## 9. Comparação e scoring

### 9.1 Dois níveis obrigatórios

1. **Comparação de ofertas:** mesma variante, merchants distintos; compara preço total, entrega, disponibilidade, promoção, reputação e destino.
2. **Comparação de produtos:** produtos alternativos; compara atributos técnicos, adequação ao uso, rating e melhor oferta elegível.

O UI/engine deve informar qual nível está em uso. Misturar tamanho, condição, kit ou variante diferentes invalida uma comparação de preço simples.

### 9.2 Regras para Nota UpPulse

- versionar pesos e algoritmo;
- registrar conjunto de candidatos e dados usados;
- excluir critério incompleto de forma simétrica ou declarar imputação;
- não tratar publicidade/comissão como qualidade do produto;
- mostrar timestamp e cobertura;
- fornecer razões específicas, vantagens, desvantagens e incerteza;
- resultado `DEPENDE` quando equivalência, preço total ou evidência forem insuficientes;
- separar `OpportunityScore`, `ProductFitScore`, `OfferTrustScore` antes de uma nota composta futura.

A Nota V1 existente usa preço, desconto, rating, contagem e frete grátis e já exclui critérios ausentes simetricamente. Ela deve ser preservada como versão histórica, mas só reativada publicamente após dados multi-source coerentes.

## 10. Contrato de proveniência e direitos

Cada valor material deve poder apontar para:

```ts
type FieldEvidence = {
  sourceId: string;
  providerRecordId?: string;
  observedAt: string;
  validFrom?: string;
  validUntil?: string;
  provenance: "provider" | "merchant" | "manufacturer" | "licensed_reviews" | "derived" | "inferred";
  confidence?: number;
  usagePolicyId: string;
  derivationRuleVersion?: string;
};
```

`SourcePolicy` precisa responder, no mínimo:

- pode exibir publicamente?
- pode comparar com concorrentes?
- pode armazenar e por quanto tempo?
- pode criar histórico/estatística/score?
- pode usar para recomendação automatizada ou IA?
- pode redistribuir via API?
- exige atribuição, link ou branding?
- deve apagar ao encerrar relação?
- quais territórios, superfícies e audiências são permitidos?

Ausência de resposta deve ser `UNKNOWN/NOT_AUTHORIZED`, não `true`.

## 11. Fontes compostas

| Necessidade | Fonte preferencial | Alternativa | Regra |
|---|---|---|---|
| oferta/preço/deeplink | Awin e redes aprovadas | merchant direto | contrato de publisher/comparador |
| identidade/atributos | merchant/fabricante autorizado | feed network | manter proveniência por campo |
| disponibilidade/frete | merchant/feed atualizado | API autorizada | timestamp/destino obrigatórios |
| ratings/reviews | fonte licenciada | merchant autorizado | não copiar Google Shopping |
| normalização/matching | BeUpFree | IDs fortes do provider | confiança e revisão |
| score/explicação | BeUpFree | — | derivados permitidos e versionados |
| histórico | capturas autorizadas | dataset licenciado | respeitar retenção/cache |

Uma relação de merchant com Google não autoriza automaticamente o BeUpFree. Um feed Awin não autoriza automaticamente treino de IA. Uma review pública não autoriza cópia. A política efetiva de um produto composto deve ser pelo menos tão restritiva quanto a de cada campo utilizado.

## 12. Lacunas do modelo atual

### Já existe

- `products` separado de `offers`;
- brand, category, imagens, cores, gênero, uso, rating e contagem;
- offer com preço, original, desconto, moeda, seller, seller rating, frete grátis, parcelas, URLs, status e timestamps;
- filtros por marca, cor, desconto, frete, tamanho, gênero, idade, modalidade, tipo, avaliação e preço;
- favoritos persistentes;
- comparação/Nota UpPulse/“Vale pagar?” preservados no código, mas fora da V1 pública;
- tipos de atributos com proveniência e confidence no cliente.

### Lacunas P0/P1

- `Provider/Network/Merchant/Seller` como entidades distintas;
- `Variant` e matching por GTIN/MPN/modelo;
- atributos extensíveis persistidos em vez de inferência de título;
- múltiplas ofertas apresentadas por produto;
- promoção e vigência estruturadas;
- frete por destino/custo/prazo;
- disponibilidade/estoque estruturados;
- proveniência/licença/freshness por campo;
- landing URL e tracking link com lifecycle separados;
- ratings/reviews por sujeito e origem;
- quality gates para comparação.

### Lacunas P2

- price history/typical price;
- alertas e preço-alvo;
- personalização explícita;
- similares por necessidade;
- políticas de garantia/devolução;
- analytics de explicações e decisões.

## 13. Critérios de aceitação para uma fonte

Antes de integrar qualquer provider, obter uma amostra autorizada e medir:

1. ≥95% com offer ID, merchant, preço, moeda, disponibilidade, URL e timestamps;
2. cobertura de GTIN/MPN/modelo e variante;
3. preço original/sale e vigência sem falso desconto;
4. frequência real de atualização e comportamento de remoções;
5. imagens e atributos sob direito de exibição;
6. regras de cache, comparação, histórico, derivados/score e IA;
7. deeplink/SubID e expiração;
8. estratégia idempotente full/delta;
9. território Brasil e moeda BRL;
10. capacidade de apagar/reprocessar por source/merchant.

Os percentuais finais devem ser ajustados após a primeira amostra Awin; não devem virar schema rígido antes dela.

## 14. Prioridade de implementação futura

Esta pesquisa não autoriza implementação. Quando houver uma missão própria:

1. validar amostra e contrato Awin;
2. formalizar DTO provider-agnostic em boundary de ingestão;
3. criar entidades Provider/Merchant/Variant/Evidence sem quebrar compatibilidade;
4. ingerir ofertas idempotentes e freshness;
5. expor seller grid e filtros apenas com dados reais;
6. reativar comparação com quality gate;
7. acrescentar histórico/alertas somente com autorização.

## 15. Fontes de referência

- [Google Shopping/CSS feasibility](./GOOGLE-SHOPPING-CSS-FEASIBILITY.md)
- [BeUpFree source ecosystem](./BEUPFREE-SOURCE-ECOSYSTEM.md)
- [BeUpFree provider matrix](./BEUPFREE-PROVIDER-MATRIX.md)
- [Mercado Livre official API feasibility](./ML-OFFICIAL-API-FEASIBILITY.md)
- [Configurable sources architecture](../architecture/CONFIGURABLE-SOURCES.md)
- [Comparação Inteligente roadmap](../roadmap/Comparacao-Inteligente.md)
