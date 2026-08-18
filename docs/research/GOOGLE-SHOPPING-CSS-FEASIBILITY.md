# SPIKE-GOOGLE001 — Google Shopping, CSS, Merchant ecosystem e benchmark funcional

**Data da pesquisa:** 18 de agosto de 2026

**Escopo:** viabilidade do Google como fonte oficial de ofertas para BeUpFree/UpPulse e benchmark funcional do Google Shopping.

**Natureza:** pesquisa documental e auditoria local; não é parecer jurídico. Nenhuma conta, credencial, integração, coleta ou scraping foi criado.

## 1. Resumo executivo

**Decisão de aquisição: NO-GO para Google como provider de descoberta multi-merchant do MVP.**

**Classificação da consulta global proposta: D — NÃO encontrado.** Não foi localizada uma API oficial, feed ou programa público que permita ao BeUpFree consultar o catálogo global do Google Shopping por texto e filtros, como `tênis + corrida + novo + promoção + R$100–R$500`.

Os mecanismos encontrados têm direção oposta:

- **Merchant Center e Merchant API:** merchants e prestadores autorizados enviam e administram dados das próprias contas; `products.list` retorna “products in your Merchant Center account”, não produtos de terceiros sem autorização.
- **CSS e CSS API:** um Comparison Shopping Service europeu já precisa operar seu próprio comparador, representar merchants e possuir direitos sobre os dados. A API insere e lista produtos do próprio CSS Center e gerencia contas associadas. Ela não entrega ao CSS o Shopping Graph nem os resultados globais do Google.
- **Shopping Graph:** a documentação para consumidores o descreve como repositório interno que alimenta experiências Google. **NÃO foi encontrada** API pública de leitura do Shopping Graph.

No Brasil, Merchant Center e Merchant API são aplicáveis e BRL/Português são suportados. Isso permite administrar ofertas de uma empresa brasileira ou de clientes que concedam acesso, mas não descobrir todo o mercado. O programa CSS lista 21 países europeus e **não inclui o Brasil**; exige registro empresarial em país elegível e ao menos 50 domínios de merchants por país-alvo. Logo, uma empresa apenas brasileira não atende o requisito de registro, e CSS não resolve aquisição brasileira.

O Google permanece extremamente útil como **benchmark funcional**, não como fonte. Awin continua prioridade nº 1 porque oferece acesso publisher autorizado, feeds multi-advertiser, deeplinks e monetização no Brasil. A descoberta não altera o ranking da SPIKE-SOURCES001 nem a direção provider-agnostic da arquitetura; reforça a necessidade de separar `Product`, `Variant`, `Offer`, `Merchant/Seller`, proveniência e permissões por fonte.

## 2. Objetivo

Responder independentemente:

1. **Aquisição:** existe mecanismo oficial para receber ou consultar ofertas de múltiplos merchants no Google?
2. **Produto:** quais informações e interações do Google Shopping devem orientar, sem copiar visualmente, a evolução do UpPulse?

Estados de evidência:

- **CONFIRMADO:** texto ou contrato oficial atual sustenta diretamente a afirmação.
- **INFERIDO:** conclusão lógica indicada como tal, sem transformar ausência de documentação em permissão.
- **NÃO CONFIRMADO:** não foi localizada evidência oficial suficiente.

## 3. Contexto

As pesquisas anteriores concluíram que a API do Mercado Livre não sustenta descoberta global e que o caminho viável é `fonte autorizada → aquisição estruturada → normalização → inteligência → deeplink`. A [SPIKE-SOURCES001](./BEUPFREE-SOURCE-ECOSYSTEM.md) classificou Awin, Rakuten, Impact, Admitad e CJ como as cinco primeiras fontes e recomendou Awin para a primeira POC.

O Google Shopping demonstra publicamente uma experiência próxima da visão do UpPulse: busca, filtros contextuais, fichas de produto, ofertas de lojas distintas, avaliações e recursos de preço. A proximidade funcional não implica acesso ao catálogo subjacente.

## 4. Google Shopping

**CONFIRMADO.** Google Shopping é uma experiência de descoberta, não o vendedor. A ajuda oficial informa que participantes enviam feeds regularmente, que resultados podem ser orgânicos ou patrocinados, e que o consumidor segue para o site do seller. A classificação padrão considera relevância e pode ser personalizada; pagamento influencia itens marcados como patrocinados.

O [Shopping Graph](https://support.google.com/googleshopping/answer/14336735?hl=en) agrega nomes, descrições, preços, imagens e reviews enviados por marcas, varejistas e outros provedores, e alimenta Search, Ads, YouTube e experiências de IA. Isso descreve uma capacidade interna do Google, não um contrato de exportação.

**Shopping Graph como API:** **NÃO CONFIRMADO / API pública não encontrada.** O portal oficial de developers pesquisado aponta Merchant API, CSS API e integrações de partners para enviar/administrar dados. Não expõe busca de leitura do Shopping Graph para comparadores externos.

## 5. Merchant Center

**CONFIRMADO.** Merchant Center é a ferramenta pela qual uma empresa envia e administra seus produtos para aparecer em Search, Shopping, Maps, YouTube e outras superfícies. Uma fonte primária pode ser arquivo, Google Sheets, SFTP/Cloud Storage, crawl autorizado do próprio site ou API.

O Merchant Center está disponível para destinos no Brasil: a lista oficial de [países, idiomas e moedas](https://support.google.com/merchants/answer/160637?hl=en) inclui Brasil/BRL, e a sincronização de produtos lista Brasil com `pt` e `en`.

Ele é um destino de dados do merchant, não um feed de todos os merchants. Mesmo contas avançadas ou de prestadores trabalham com subcontas e relações autorizadas.

## 6. Merchant API

### 6.1 Papel e acesso

**CONFIRMADO.** A [visão geral atual](https://developers.google.com/merchant/api/guides/quickstart/overview) define a Merchant API como API para gerenciar contas Merchant Center, produtos, inventário, promoções, reviews, fontes e relatórios. Em 17/07/2026, o quickstart exigia: Merchant Center, Google Cloud project, autenticação, registro do developer e inserção do primeiro produto.

Autenticação é obrigatória:

- service account para a própria conta, adicionada como usuário no Merchant Center;
- OAuth 2.0 para uma aplicação de terceiros acessar contas de clientes após consentimento;
- API key isolada não é aceita.

O [guia de autorização](https://developers.google.com/merchant/api/guides/authorization/access-your-account) recomenda OAuth para terceiros e explicita que o cliente precisa conceder acesso. A função “API developer” recebe comunicações e não concede, por si só, acesso a produtos.

### 6.2 Pergunta fundamental

**A Merchant API permite consultar produtos de outros merchants?**

**Não, não de forma global ou sem relação autorizada.** `accounts.products.list` lista os produtos processados **da conta Merchant Center especificada** e a resposta os chama de “your processed products”. Uma agência/SaaS pode acessar várias contas somente quando os respectivos clientes concedem OAuth/acesso ou quando elas são subcontas/contas vinculadas sob uma configuração autorizada.

Portanto:

- própria conta: **SIM**;
- merchants clientes que concederam acesso: **SIM, no escopo concedido**;
- qualquer merchant do Google Shopping: **NÃO**;
- busca textual global cross-account: **NÃO encontrada**.

### 6.3 Dados documentados

Os campos abaixo existem na especificação de produto/Merchant API, mas sua disponibilidade em uma resposta depende do que o merchant submeteu, das regras do programa e da conta autorizada.

| Grupo | Campos/capacidades | Estado |
|---|---|---|
| Identidade | `id/offerId`, GTIN, MPN, brand, item group | CONFIRMADO |
| Produto | title, description, product highlights/details, category/product type | CONFIRMADO |
| Variante | item group, color, size, size system/type, gender, age group, material, pattern | CONFIRMADO |
| Imagens | image link e imagens adicionais | CONFIRMADO |
| Destino | product landing-page `link`, mobile link, canonical/checkout conforme programa | CONFIRMADO |
| Oferta | price, sale price, sale effective date, condition, availability | CONFIRMADO |
| Entrega | shipping, shipping weight/dimensions, regiões e inventário local/regional | CONFIRMADO, contextual |
| Pagamento | installment, subscription cost, unit pricing | CONFIRMADO, contextual |
| Promoções | sub-API para inserir, obter e listar promoções da conta | CONFIRMADO |
| Reviews | fontes para product/merchant reviews e programa product ratings | CONFIRMADO para gestão da conta; cobertura variável |
| Merchant/seller | conta que possui/submete o produto; subcontas autorizadas | CONFIRMADO no contexto da conta |
| Percentual de desconto | não é atributo universal; derivável de price/sale price quando comparáveis | INFERIDO |
| Histórico de preço global | não exposto como série histórica de consumidor em `products` | NÃO encontrado |

A [especificação oficial](https://support.google.com/merchants/answer/7052112?hl=en) exige preço e disponibilidade e documenta sale price, link, imagem, brand, GTIN, categoria e atributos. A [referência REST](https://developers.google.com/merchant/api/reference/rest) confirma sub-APIs de produtos, promoções, inventário e reviews.

## 7. CSS

### 7.1 O que é e o que faz

**Resposta crítica: C — combinação das funções A e B, com aquisição independente.**

Um CSS:

1. opera um site próprio no qual usuários pesquisam e comparam produtos e as condições do mesmo produto em merchants diferentes;
2. obtém/representa esses merchants por suas próprias relações e direitos;
3. pode administrar Merchant Center/Google Ads e enviar produtos ao Google em nome dos merchants;
4. pode enviar páginas próprias de comparação (“CSS product pages”) ao Google nos países/formatos habilitados.

Logo, **A é verdadeira quanto ao produto que o CSS precisa operar**, e **B é verdadeira quanto à integração com o Google**. Mas não há evidência de que o Google forneça ao CSS os dados dos múltiplos merchants. Ao contrário, os requisitos dizem que o site já deve mostrar ao menos 50 domínios e que o CSS deve enviar dados separadamente por merchant, garantindo os direitos necessários para Google acessar/indexar/cachear o conteúdo.

### 7.2 CSS Center e CSS API

CSS Center é uma plataforma gratuita para administrar participação, contas associadas, diagnósticos, usuários e portfolio de merchants. A [CSS API](https://developers.google.com/comparison-shopping-services/api/reference/rest) gerencia em escala:

- contas CSS/Merchant Center associadas;
- `cssProductInputs` inseridos, atualizados ou removidos pelo CSS;
- `cssProducts` processados **na conta CSS Center**;
- labels e quotas.

`listChildAccounts` lista contas sob o CSS; `cssProducts.list` lista os produtos processados daquela conta. Não existe método de busca do catálogo global do Google.

### 7.3 Requisitos, aprovação, contrato e custos

Segundo os [requisitos oficiais do programa CSS](https://support.google.com/css-center/answer/7524491?hl=en):

- empresa registrada em ao menos um país elegível, com endereço correspondente no site;
- site público sem login, com busca dinâmica própria, resultados relevantes e comparação;
- ordenação/filtro por preço e ao menos outra dimensão;
- ao menos **50 domínios de merchants distintos por país** que entreguem naquele país;
- comparação de preço e condições do mesmo produto entre merchants;
- destino que permita comprar;
- revisão periódica e possibilidade de suspensão.

O onboarding cria Merchant Center, registra dados comerciais/site, transforma a conta em multi-client account CSS e concede CSS Center. Há aceitação de Terms of Service para oportunidades específicas. O fluxo tem verificação de elegibilidade e suporte/manual forms; portanto **aprovação/revisão humana ou assistida é CONFIRMADA na prática do onboarding**, embora a documentação pública não publique SLA universal.

- **Certificação formal separada:** NÃO encontrada; há elegibilidade, revisão contínua e onboarding.
- **Contrato/termos:** SIM; aceite de ToS é requerido. NDA é exigido apenas para acesso completo ao Education Hub, não foi demonstrado como pré-requisito universal do programa.
- **Custo do CSS Center:** plataforma descrita como gratuita.
- **Custos totais:** NÃO são zero garantido. Operação do comparador, dados, anúncios e serviços são próprios; CSSs definem modelos CPC/comissão para merchants. Não foi encontrada taxa pública universal de adesão do Google.
- **Escala inicial:** fase técnica permite até 1 milhão de ofertas/100 subcontas; recomenda-se testar 10–15 contas. Após onboarding, há requisito publicado de ao menos 1 clique para 40 produtos em 28 dias para sustentar inventário.

## 8. Disponibilidade no Brasil

| Capacidade | Global | Brasil | EEE/Europa | Outras regiões |
|---|---|---|---|---|
| Google Shopping/Shopping surfaces | amplo, varia por recurso | SIM | SIM | varia por país |
| Merchant Center | países suportados | **SIM, BRL, pt/en** | SIM | muitos países |
| Merchant API | ligada a contas Merchant Center | **SIM para contas/merchants autorizados** | SIM | conforme Merchant Center/programa |
| Programa CSS | somente lista oficial | **NÃO** | SIM em 21 países listados, incluindo Reino Unido/Suíça/Noruega além do EEE | NÃO comprovado fora da lista |
| CSS product pages em destaque | subconjunto do CSS | **NÃO** | 15 países listados em 2026 | NÃO comprovado |
| Price tracking | recurso regional | **NÃO listado** | disponibilidade limitada | EUA, Canadá, Austrália, Japão e Índia listados |
| Price insights/histórico ao consumidor | recurso regional | **NÃO listado** | NÃO confirmado | EUA listado |

### Respostas específicas

- **CSS disponível no Brasil?** NÃO, Brasil não consta na lista oficial.
- **Merchant Center disponível no Brasil?** SIM.
- **Merchant API disponível no Brasil?** SIM para administrar contas/dados autorizados; não é search API brasileira.
- **Programa CSS aplicável ao Brasil?** NÃO encontrado.
- **Empresa brasileira pode se cadastrar como CSS?** Uma empresa somente registrada no Brasil, NÃO sob os requisitos atuais. Uma entidade do grupo registrada em país CSS elegível poderia candidatar-se para países elegíveis, sem estender o programa ao Brasil.
- **Mínimo de merchants?** 50 domínios por país-alvo.
- **Aprovação/revisão?** SIM, onboarding, elegibilidade e revisões periódicas.

## 9. Multi-merchant discovery

Consulta desejada:

```text
query = tênis
uso = corrida
condition = new
promotion = true
price = 100..500 BRL
scope = todos os merchants do Google Shopping
```

| Mecanismo | Consegue executar a consulta global? | Motivo |
|---|---|---|
| Merchant API | NÃO | lista produtos das contas autorizadas; não há search global |
| CSS API | NÃO | lista/gerencia inputs e contas do próprio CSS |
| Merchant feeds | NÃO | direção merchant/CSS → Google |
| CSS program | NÃO | habilita representação/envio e páginas do comparador, não exportação do Google |
| Shopping Graph | NÃO encontrado | sem API pública de leitura localizada |
| YouTube Shopping Affiliate | NÃO | programa para creators taguearem produtos no YouTube, não feed publisher geral |
| Google Shopping público | visualmente SIM ao consumidor | termos e ausência de API impedem tratá-lo como provider programático |

**Classificação final: D — NÃO encontrado.** A classe B só seria aplicável se o Google negociasse futuramente uma parceria privada específica, o que é **NÃO CONFIRMADO** e não pode sustentar o MVP.

## 10. Dados disponíveis

É essencial distinguir três universos:

1. **Visíveis ao consumidor:** dados que Google decide apresentar.
2. **Submetíveis/legíveis na conta:** atributos Merchant API/feed da conta autorizada.
3. **Exportáveis globalmente:** catálogo cross-merchant que o BeUpFree poderia consumir.

Os dois primeiros são ricos; o terceiro não foi encontrado. Assim, “Google tem preço, imagem e reviews” não significa “a API devolve todos esses campos para qualquer oferta”.

## 11. Termos e scraping

Esta missão não acessou resultados por robô, não fez crawling e não testou bypass.

**CONFIRMADO:** os [Termos gerais do Google](https://policies.google.com/terms?hl=en) vedam acesso automatizado que viole instruções legíveis por máquina, como `robots.txt`, e incluem Google Shopping entre os serviços abrangidos. Também permitem ação contra scraping de conteúdo alheio que cause dano ou responsabilidade.

**CONFIRMADO:** os [Google APIs Terms](https://developers.google.com/terms) exigem acesso somente pelos meios documentados e vedam contornar limites. Salvo permissão do titular ou lei aplicável, conteúdo retornado por APIs não pode ser raspado para formar bases/cópias permanentes, mantido além do cache header, redistribuído, exibido publicamente, sublicenciado ou usado com atribuição removida. Encerrado o acesso, conteúdo cacheado permitido deve ser eliminado.

**CONFIRMADO:** Merchant API incorpora os API Terms e termos próprios. Dados de merchant e conteúdo de terceiros mantêm direitos e regras próprios.

Conclusões de compliance:

- página pública não concede licença de armazenamento/redistribuição;
- ausência de bloqueio técnico não é autorização;
- API de uma conta não autoriza expor dados não públicos a terceiros sem consentimento;
- cache, comparação, derivados/score, IA e retenção precisam ser validados por fonte e contrato;
- não se deve reproduzir conteúdo ou resultados Google como base do UpPulse.

## 12. Benchmark funcional

**Princípio obrigatório: Google = benchmark funcional; Google ≠ modelo visual a copiar.**

O benchmark registra informação, funcionalidade e modelo de interação. A experiência é dinâmica por consulta, país, dispositivo, login e experimento; nem todo recurso aparece no Brasil. Evidências combinam a busca real descrita na missão e documentação oficial atual.

| Jornada | Capacidade observável/documentada | Disponibilidade |
|---|---|---|
| Busca | texto livre, autocomplete do Search, correções/sugestões e relevância | contextual |
| Refinamento | filtros dinâmicos por categoria, preço, marca, tamanho e especificações | CONFIRMADO; conjunto contextual |
| Produto | foto, título, características, variantes, ratings/reviews | CONFIRMADO |
| Oferta | preço, seller, disponibilidade, link e frete contextual | CONFIRMADO |
| Comparação | ofertas/lojas do mesmo produto e reviews em product viewer | CONFIRMADO |
| Descoberta | similares visuais, recomendações e personalização | CONFIRMADO, varia |
| Preço | sale annotations, price drops e insights/histórico | regional |
| Alertas | tracking com preço-alvo e notificações | não disponível no Brasil segundo lista atual |

## 13. Filtros

### 13.1 Encontrados/documentados

| Filtro | Evidência | Recomendação UpPulse |
|---|---|---|
| Categoria/tipo | ajuda oficial e filtros dinâmicos | obrigatório |
| Marca | ajuda oficial | obrigatório |
| Preço/faixa | ajuda oficial | obrigatório |
| Promoção/on sale | experiência pública/documentação de Shopping | obrigatório |
| Tamanho | ajuda oficial cita size | obrigatório para moda/calçados |
| Especificações técnicas | ajuda oficial | importante, por categoria |
| Seller/retailer | documentação/experiência desktop | obrigatório para ofertas |
| Proximidade/near me | recurso contextual | futuro |
| Cor | Search tools e dados de produto | importante |
| Gênero/departamento | shopping preferences e atributos | importante |
| Idade | atributo de dados; UI contextual | importante |
| Condição | atributo de produto; UI contextual | obrigatório |
| Frete/prazo | requisito/filtro recomendado de CSS; informação de compra | obrigatório/importante |
| Avaliação | ratings agregados; UI contextual | importante |
| Esporte/uso | filtro contextual observado na busca de tênis e atributo categorial | obrigatório no vertical atual |
| Disponibilidade | atributo exigido; UI contextual | obrigatório |

Não foi possível confirmar oficialmente que todos apareçam simultaneamente na interface brasileira. O contrato UpPulse deve suportar facetas contextuais, sem prometer um conjunto universal.

### 13.2 Modelo de interação

- facetas mudam conforme consulta/categoria;
- filtros ativos reduzem progressivamente a população;
- cartões permitem descoberta rápida; viewer aprofunda sem perder contexto;
- produto e oferta são apresentados em níveis distintos quando o matching é possível;
- ranking mistura relevância, personalização e itens patrocinados sinalizados.

## 14. Produto

Informações relevantes para UpPulse:

- imagens principal e adicionais;
- título canônico, marca, modelo, GTIN/MPN;
- categoria e tipo do merchant;
- descrição, highlights e detalhes técnicos;
- variantes agrupadas por `item_group_id`, com cor/tamanho/gênero/idade/material;
- rating, contagem e summary de reviews, com origem;
- produtos similares e recomendações.

O UpPulse atual possui produto separado de oferta, marca/categoria, imagens, cor, gênero, tipo de uso, rating e reviews. Porém modelo/GTIN/MPN, variantes explícitas, atributos extensíveis persistidos e proveniência por campo ainda são lacunas.

## 15. Oferta

Informações relevantes:

- preço atual, preço-base/anterior e sale price com vigência;
- percentual derivado com base comparável;
- moeda e condição;
- merchant/seller e reputação;
- disponibilidade/estoque e atualização;
- frete: custo, gratuidade, prazo e destino;
- promoção/cupom e elegibilidade;
- landing URL canônica e tracking/deeplink separados;
- outras lojas para o mesmo produto.

O schema atual tem preço, original, desconto, moeda, seller, seller rating, frete grátis, parcelas, URLs, status e timestamps. Faltam merchant de primeira classe, custo/prazo/destino do frete, promoção com vigência/regras, variante, estoque estruturado, canonical versus tracking lifecycle e price history.

## 16. Comparação

Google documenta ofertas de merchants diferentes, comparação de preços e condições, ratings/reviews e, regionalmente, price insights/histórico/alertas. O recurso de histórico ao consumidor está oficialmente restrito aos EUA e price tracking não lista Brasil.

O UpPulse tem implementação interna preservada de comparação de 2–3 produtos, Nota UpPulse V1, melhor preço, maior desconto, melhor avaliação, explicação e “Vale pagar a diferença?”. A rota e controles não estão expostos na V1 por insuficiência de cobertura/qualidade, conforme [Comparação Inteligente](../roadmap/Comparacao-Inteligente.md).

Diferencial possível: comparar primeiro **ofertas do mesmo produto normalizado**, depois produtos alternativos, explicando qual tipo de comparação está sendo feito. Hoje a implementação compara snapshots de produtos/best offer e ainda não oferece seller grid por produto.

## 17. Pontos fortes

- escala e amplitude de descoberta;
- busca livre e facetas contextuais;
- integração de imagens, especificações, avaliações e ofertas;
- agrupamento de múltiplas lojas quando há identidade de produto;
- refinamento sem exigir taxonomia prévia do usuário;
- recursos de preço, similares e personalização em regiões habilitadas;
- sinalização de patrocinado e saída direta para seller.

## 18. Limitações de UX

Somente limitações apoiadas na experiência/documentação:

- **Variabilidade regional/contextual:** alertas, histórico e alguns controles não estão disponíveis em todos os países/superfícies.
- **Freshness não instantânea:** a ajuda reconhece atraso após atualização do seller e orienta confirmar no destino.
- **Custo final fragmentado:** frete varia por destino/método/seller; o consumidor pode precisar confirmar no site da loja.
- **Ratings agregados heterogêneos:** reviews vêm de Google, merchants e terceiros; a nota pode divergir da loja.
- **Ranking de natureza mista:** orgânico, personalizado e patrocinado coexistem; entender “melhor” exige interpretar rótulos e condições.
- **Muitas opções/facetas contextuais:** potência de descoberta não equivale a justificativa explícita de custo-benefício.
- **Explicação decisória limitada:** Google ajuda a encontrar e comparar, mas a documentação pública não descreve um veredito auditável equivalente a “por que este é melhor?” ou “vale pagar mais?” para o cenário brasileiro.

Duplicação e matching incorreto são riscos naturais de dados multi-source, mas **não foram quantificados nesta pesquisa** e não são afirmados como defeito comprovado.

## 19. Google × UpPulse

| Funcionalidade | Google Shopping | UpPulse atual | UpPulse futuro | Diferencial possível | Prioridade |
|---|---|---|---|---|---|
| Busca livre | forte, autocomplete/relevância | busca local por termos em nome/marca | índice normalizado e sugestões | intenção comercial explicável | P0 |
| Filtros | dinâmicos/contextuais | 11 dimensões + preço, parte inferida do título | facetas por categoria e qualidade | filtros inteligentes com explicação | P0 |
| Preço/desconto | preço, sale/annotations | best offer, original e desconto | validade e custo total | validar oportunidade real | P0 |
| Múltiplos sellers | sim quando agrupado | múltiplas ofertas no domínio, UI usa best offer | seller grid por produto | custo total + confiança | P0 |
| Produto normalizado | Shopping Graph interno | produto separado de oferta | identidade GTIN/MPN/modelo | confiança/proveniência visível | P0 |
| Variantes | cor/tamanho etc. | tipos TS, persistência parcial | entidade Variant | comparar equivalente exato | P0 |
| Rating/reviews | agregado multi-source | rating/contagem | ReviewSummary por origem | confiabilidade da evidência | P1 |
| Características | ricas/contextuais | poucas colunas + inferência | atributos extensíveis | tradução técnica para decisão | P0 |
| Comparação | lojas/preços; produtos/contextual | código pronto, oculto na V1 | reativar com dados confiáveis | dois níveis: produto e oferta | P1 |
| Nota/score | price insights regionais; sem score equivalente documentado | Nota UpPulse V1 interna | score versionado/auditável | explicar fatores e incerteza | P1 |
| Por que este é melhor? | orientação/reviews, sem veredito equivalente comprovado | motivo genérico na comparação oculta | evidências específicas | decisão assistida | P1 |
| Vale pagar mais? | não encontrado como veredito explícito | SIM/NÃO/DEPENDE interno | critérios por categoria/pessoa | proposta distintiva | P1 |
| Favoritos | salvos/coleções | local + conta persistente | sinais consentidos | lista de oportunidades | P1 |
| Personalização | atividade/preferências/brands/style | não relevante além de favoritos | preferências explícitas | controle e transparência | P2 |
| Histórico de preço | EUA | ausente | série própria licenciada | Brasil + confiança/freshness | P2 |
| Alertas | 5 países listados, não Brasil | ausente | preço-alvo/oportunidade | alerta brasileiro explicável | P2 |
| Similaridade | visual/recomendações | ausente | substitutos normalizados | similar por necessidade/custo | P2 |

## 20. Modelo de dados

Modelo recomendado, sem implementação:

```text
Provider / Source / LicensePolicy
  ├── Merchant / Seller / Advertiser
  ├── Product ── Variant ── AttributeValue
  │      ├── Brand / Category
  │      ├── MediaAsset
  │      └── Rating / ReviewSummary
  └── Offer
         ├── Price / Promotion / PriceHistory
         ├── Availability
         ├── ShippingOption
         └── DestinationLink / AffiliateLink
```

Necessidades:

- `Product`: identidade canônica, sem preço/seller;
- `Variant`: combinação comprável específica;
- `Offer`: merchant + variante + condição comercial no tempo;
- `Merchant` diferente de `Seller` e de `Provider`;
- `Attribute`: extensível por categoria, com unidade, proveniência, confiança e timestamp;
- `Promotion`: regra, vigência, cupom/elegibilidade, sem confundir com desconto derivado;
- `PriceHistory`: somente quando licença/fonte permitir, com moeda e captura;
- `Rating/ReviewSummary`: sujeito, fonte, escala, contagem e atualização;
- `ShippingOption`: destino, modalidade, preço e prazo;
- `AffiliateLink`: separado de landing URL, programa e expiração;
- `SourceEvidence/UsagePolicy`: direitos, cache, redistribuição e IA por campo/origem.

O documento [UPPULSE-COMMERCE-DATA-REQUIREMENTS.md](./UPPULSE-COMMERCE-DATA-REQUIREMENTS.md) detalha o contrato ideal.

## 21. Google × Awin

| Critério | Awin Product Feed | Google ecosystem |
|---|---|---|
| Acesso do UpPulse | publisher aprovado + advertisers | próprias contas/clientes autorizados; sem catálogo global |
| Multi-merchant discovery | SIM, entre advertisers aprovados | NÃO como API de leitura global |
| Brasil | SIM | Merchant SIM; CSS NÃO |
| Feed/API | JSONL/XML/CSV/API | feed/API de entrada e gestão de conta |
| Price/sale/attributes/images | SIM, conforme advertiser | SIM na conta autorizada |
| Deeplink/affiliate | SIM, finalidade central | landing links; YouTube affiliate não serve ao comparador geral |
| Comparador | explicitamente suportado | CSS exige comparador pré-existente na Europa; Merchant API não o licencia globalmente |
| Escala MVP | adequada a bulk feeds | apenas população autorizada merchant a merchant |
| Monetização | CPS/CPA | não há programa publisher geral encontrado |
| Principal risco | aprovação/completude/cache/IA | ausência da capacidade de aquisição pretendida |

**Escolha para o MVP: A — Awin Product Feed.** Uma combinação futura é válida somente como `Awin + feeds/APIs diretos de merchants autorizados + reviews licenciados`; Google Merchant API pode ser um conector para merchants que explicitamente contratem/concedam acesso, não enriquecimento global.

## 22. Papel estratégico do Google

### 22.1 Matriz de provider

| Campo | Google |
|---|---|
| Provider type | MERCHANT_PLATFORM / AD & DISCOVERY SURFACE / CSS PLATFORM |
| API | SIM, account-scoped |
| Product feed | SIM, entrada para Google; não export global |
| Multi-merchant discovery | NÃO |
| Brasil | Merchant SIM; CSS NÃO |
| Price | SIM, autorizado |
| Sale price | SIM, autorizado |
| Attributes | SIM, ricos |
| Images | SIM, autorizado |
| Deeplink | landing/redirect; afiliado geral NÃO encontrado |
| Affiliate | YouTube Shopping Affiliate, não aplicável ao UpPulse geral |
| Comparison | consumidor SIM; CSS europeu; API global NÃO |
| Cache | condicionado aos API Terms/cache headers e direitos do merchant |
| AI use | NÃO autorizado genericamente; validar por contrato/fonte |
| Scale | alta para contas geridas; inútil para descoberta não autorizada |
| Compliance | alto risco se resultados públicos forem coletados/reproduzidos |
| BeUpFree Score | **34/100, classe D como provider; BLOCKER** |

Score comparável à SPIKE-SOURCES001: autorização para o caso de uso 0/20; dados 12/15; feed/API útil ao caso 5/15; preço/desconto 6/10; monetização 0/10; Brasil 5/10; escala adquirível 1/10; diversidade 3/5; integração 2/5 = **34/100**. Blocker prevalece sobre o número.

### 22.2 Benchmark

Como benchmark funcional: **95/100**, sem entrar no ranking de providers. A pontuação representa amplitude de informação/interação, não permissão de uso nem recomendação visual.

## 23. Riscos

- confundir API rica de seller com discovery API;
- assumir que “CSS” concede catálogo de terceiros;
- aplicar programa europeu ao Brasil;
- inferir licença de dados a partir da interface pública;
- combinar conteúdo de fontes com licenças incompatíveis;
- usar price/review/image além de cache/retenção permitidos;
- misturar variantes e criar comparação falsa;
- score sobre dados desatualizados/incompletos;
- dependência de recursos Google regionais que não existem no Brasil;
- alteração de políticas, programas, quotas e superfícies.

## 24. Decisão

1. **Resultados globais oficiais do Google Shopping?** NÃO encontrado — D.
2. **No Brasil?** NÃO; Merchant API brasileira não muda o escopo por conta.
3. **CSS resolve?** NÃO. Requer comparador/dados/merchants prévios e não existe no Brasil.
4. **Merchant API resolve?** NÃO para discovery; SIM apenas para contas autorizadas.
5. **Outro programa Google resolve?** NÃO encontrado. Shopping Graph não tem API pública; YouTube affiliate não é feed geral.
6. **Google como provider?** NÃO para MVP/global; possível conector account-scoped futuro mediante contrato de merchant.
7. **Google como benchmark?** SIM, recomendado.
8. **Campos necessários?** identidade, variante, oferta, merchant, preço/promo, disponibilidade, frete, atributos, imagens, ratings, links, proveniência e freshness.
9. **Filtros necessários?** categoria, marca, preço, promoção, condição, seller, frete, disponibilidade, rating e atributos contextuais como cor/tamanho/gênero/idade/esporte/uso.
10. **Onde superar?** explicação auditável, custo-benefício, “vale pagar mais?”, normalização/proveniência e oportunidade real no Brasil.
11. **Awin continua nº 1?** SIM.
12. **Impacto em WEB-PUBLIC001?** Não altera escopo da V1 nem autoriza comparação pública imediata; enriquece requisitos e critérios de reativação.
13. **Impacto arquitetural?** Não muda a direção; confirma e detalha o modelo multi-provider, multi-source e capability/policy-aware.

## 25. Próximos passos

1. executar a POC Awin já recomendada, com 2–3 advertisers brasileiros;
2. medir completude do contrato ideal em 100 ofertas reais;
3. obter por escrito regras de comparação, cache, imagens, preço, reviews, IA/derivados e retenção;
4. modelar identidade `Product → Variant → Offer` e merchant/provider sem implementar antes da amostra;
5. validar feeds diretos de merchants como enriquecimento autorizado;
6. reativar comparação pública somente após cobertura, equivalência e freshness suficientes;
7. manter Google no radar exclusivamente para parceria privada ou merchant autorizado, sem depender disso;
8. revisar documentação Google periodicamente, pois recursos regionais e APIs mudam.

### Hipótese de fonte composta

Estratégia recomendada:

```text
Awin/affiliate network ── oferta + preço + deeplink
Merchant autorizado ───── ficha técnica + variante
Fonte licenciada ───────── reviews
BeUpFree ───────────────── identidade + normalização + score + explicação
```

Cada registro deve carregar fonte, licença/purpose, direitos de exibição, cache, timestamp e regras de exclusão. **Não presumir** que autorização para enviar conteúdo ao Google autoriza entregá-lo ao BeUpFree, nem que dois datasets possam ser combinados.

## 26. Fontes oficiais

### Google Shopping e experiência

- [How Google Shopping works](https://support.google.com/googleshopping/answer/9128904?hl=en)
- [Sources of shopping info / Shopping Graph](https://support.google.com/googleshopping/answer/14336735?hl=en)
- [About price tracking](https://support.google.com/googleshopping/answer/13971184?hl=en)
- [Get price insights](https://support.google.com/faqs/answer/10675605?hl=en)
- [Manage shopping preferences](https://support.google.com/websearch/answer/13005558?hl=en)
- [How autocomplete works](https://support.google.com/websearch/answer/7368877?hl=en)

### Merchant Center e Merchant API

- [Merchant API overview](https://developers.google.com/merchant/api/overview)
- [Merchant API quickstart overview — atualizado em 17/07/2026](https://developers.google.com/merchant/api/guides/quickstart/overview)
- [Authorization](https://developers.google.com/merchant/api/guides/authorization/access-your-account)
- [Products list](https://developers.google.com/merchant/api/reference/rest/products_v1/accounts.products/list)
- [Merchant API REST reference](https://developers.google.com/merchant/api/reference/rest)
- [Merchant API terms](https://developers.google.com/merchant/api/guides/terms)
- [Product data specification](https://support.google.com/merchants/answer/7052112?hl=en)
- [Supported countries/currencies](https://support.google.com/merchants/answer/160637?hl=en)
- [Create a product data source](https://support.google.com/merchants/answer/14990942?hl=en)

### CSS

- [CSS program requirements](https://support.google.com/css-center/answer/7524491?hl=en)
- [How to get started as a CSS](https://support.google.com/css-center/answer/14233609?hl=en)
- [Show products on behalf of merchants](https://support.google.com/css-center/answer/13995647?hl=en)
- [About CSS Center](https://support.google.com/css-center/answer/9773265?hl=en)
- [CSS API reference — atualizado em 13/05/2025](https://developers.google.com/comparison-shopping-services/api/reference/rest)
- [CSS products resource](https://developers.google.com/comparison-shopping-services/api/reference/rest/v1/accounts.cssProducts)
- [Working with CSS](https://support.google.com/merchants/answer/12652686?hl=en)

### Termos

- [Google Terms of Service](https://policies.google.com/terms?hl=en)
- [Google APIs Terms of Service](https://developers.google.com/terms)

### Limitações da pesquisa

Não foram criadas contas nem aceitos termos restritos. A documentação pública não informa preço universal, SLA de aprovação CSS ou eventual parceria privada de dados. A experiência pública varia por contexto e não foi automatizada. “Não encontrado” significa ausência de mecanismo oficial público localizado em 18/08/2026, não prova de inexistência de contratos privados.
