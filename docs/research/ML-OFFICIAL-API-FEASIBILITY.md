# SPIKE-ML001 — Viabilidade da API oficial do Mercado Livre

Data da pesquisa: 17/08/2026  
Escopo: aquisição de oportunidades comerciais do Mercado Livre para o UpPulse.  
Natureza: pesquisa e prova de conceito isolada; nenhuma alteração de produção.

## 1. Conclusão executiva

**Decisão: NO-GO para substituir agora o scraping HTML por uma API oficial como mecanismo principal de descoberta global.**

**Classificação da reprodução da URL: D — não é possível com as APIs públicas/oficiais encontradas.**

A API oficial continua tecnicamente útil, mas a documentação atual posiciona a busca de itens no contexto de um vendedor e requer OAuth. O recurso global historicamente usado como `/sites/MLB/search?q=...` retornou HTTP 403 sem token e a documentação atualizada em 07/04/2025 descreve apenas buscas por `seller_id`/`nickname`, recomendando `/users/{user_id}/items/search`. Não foi encontrada uma API oficial documentada que enumere as ofertas globais correspondentes a uma página de navegação arbitrária do marketplace.

Para itens de vendedores que autorizem o aplicativo, a API pode fornecer ou compor grande parte dos dados necessários: item, atributos, imagens, frete, catálogo, reviews e preço vigente. Preço promocional exige o recurso específico de preços; promoções são orientadas aos itens/campanhas do seller. Isso não equivale a descobrir ofertas de todos os vendedores.

## 2. Problema de origem

A URL de listagem fornecida pelo usuário funciona no navegador, mas o acesso HTTP do ambiente Node recebe `302` para `/gz/account-verification`. CURA002.1 passou a classificar corretamente esse caso como falha operacional. Este spike não tenta contornar o mecanismo: os [Termos do Programa de Desenvolvedores](https://developers.mercadolivre.com.br/pt_br/termos-e-condicoes) proíbem scraping e a evasão de limitações técnicas.

URL auditada:

```text
https://lista.mercadolivre.com.br/calcados-roupas-bolsas/calcados/tenis/running/novo/tenis_Discount_40-100_AGE*GROUP_6725189_NoIndex_True#applied_filter_id%3Ddiscount%26applied_filter_name%3DDescontos%26applied_filter_order%3D14%26applied_value_id%3D40-100%26applied_value_name%3DMais+de+40%25+OFF%26applied_value_order%3D3%26applied_value_results%3D1455%26is_custom%3Dfalse
```

## 3. Fontes oficiais consultadas

- [Busca de itens — atualização 07/04/2025](https://developers.mercadolivre.com.br/pt_br/convivencia-me1-me2/itens-e-buscas)
- [Itens e buscas](https://developers.mercadolivre.com.br/pt_br/itens-e-buscas)
- [Publicação e detalhe de itens](https://developers.mercadolivre.com.br/pt_br/pt_br/publicacao-de-produtos)
- [Domínios e categorias — atualização 30/12/2025](https://developers.mercadolivre.com.br/pt_br/identificadores-de-produtos/categorias-e-publicacoes)
- [Categorização — atualização 29/12/2025](https://developers.mercadolivre.com.br/pt_br/categorizacao-de-produtos)
- [Atributos](https://developers.mercadolivre.com.br/pt_br/api-docs-pt-br/atributos)
- [Buscador de produtos de catálogo — atualização 29/12/2025](https://developers.mercadolivre.com.br/pt_br/buscador-de-produtos)
- [Preços de produtos — atualização 26/02/2026](https://developers.mercadolivre.com.br/devcenter/api-de-precos)
- [Gerenciar promoções — atualização 09/06/2026](https://developers.mercadolivre.com.br/pt_br/produto-consulta-de-usuarios/gerenciar-ofertas)
- [Opiniões de produtos](https://developers.mercadolivre.com.br/pt_br/lojas-oficiais/opinioes-sobre-um-produto)
- [Configuração e requisitos de aplicação — atualização 09/11/2025](https://developers.mercadolivre.com.br/pt_br/lojas-oficiais/configuracao-ou-requisitos-previos)
- [Permissões funcionais](https://developers.mercadolivre.com.br/pt_br/permissoes-funcionais/)
- [Termos e Condições do Programa de Desenvolvedores](https://developers.mercadolivre.com.br/pt_br/termos-e-condicoes)
- [Programa de Afiliados — geração de links](https://www.mercadolivre.com.br/l/afiliados-gere-seus-links)
- [Programa de Afiliados — páginas não permitidas](https://www.mercadolivre.com.br/l/afiliados-paginas-nao-permitidas)
- [Programa de Afiliados — locais permitidos](https://www.mercadolivre.com.br/l/afiliados-onde-compartilhar-links)

As datas acima são as exibidas pela documentação quando disponíveis. A pesquisa foi refeita em 17/08/2026; não se assumiu compatibilidade histórica.

## 4. Recursos oficiais encontrados

| Recurso | Endpoint principal | Autenticação/escopo | Cobertura e limitação relevante |
|---|---|---|---|
| Busca de itens do seller | `GET /users/{user_id}/items/search` | Bearer; conta do seller/autorização apropriada | Lista IDs do vendedor, filtra status/SKU e suporta `scan`. Não é busca global. |
| Busca pública por seller | `GET /sites/{site_id}/search?seller_id=...` | A documentação atual mostra Bearer | Itens ativos de um seller; a própria documentação orienta migrar para `/users/{id}/items/search`. |
| Multiget de itens | `GET /items?ids=...` | Bearer nas chamadas documentadas | Até 20 itens na documentação atual de busca; campos selecionáveis. Exige IDs previamente descobertos. |
| Item/oferta | `GET /items/{item_id}` | Bearer | Listing: título, seller, categoria, condição, atributos, imagens, variações, permalink, shipping, catálogo. Quantidades públicas podem ser aproximadas e alguns campos são apenas do proprietário. |
| Preço vigente | `GET /items/{item_id}/sale_price` | Bearer | `amount`, `regular_amount`, moeda e contexto. Metadata da promoção pode ser omitida se o token não for do seller. |
| Todos os preços | `GET /items/{item_id}/prices` | Bearer | Preços standard/promocionais e contextos; orientado à sincronização do seller. |
| Promoções | `/seller-promotions/...` | Bearer do seller/permissão | DEAL, DOD, LIGHTNING, PRICE_DISCOUNT etc.; consulta e gestão das campanhas/itens do seller. Não é feed global de deals. |
| Catálogo | `GET /products/search` e produto por ID | Bearer | Descobre `catalog_product` para publicação/associação; produto não é oferta. |
| Categorias | `/sites`, `/sites/{site}/categories`, `/categories/{id}` | Política variável | Árvore, configurações e domínio. Nesta POC, detalhe por ID foi público; site/árvore retornaram 403. |
| Atributos | `GET /categories/{category_id}/attributes` | A documentação mostra Bearer; POC respondeu sem token | Vocabulário por categoria: marca, gênero, idade, esporte, cor, tamanho etc. |
| Preditor de domínio/categoria | `GET /sites/{site}/domain_discovery/search?q=...` | A documentação mostra Bearer; POC respondeu sem token | Sugere domínio/categorias para um título. Não retorna ofertas nem traduz fielmente uma URL de navegação. |
| Reviews | `GET /reviews/item/{item_id}` | Bearer documentado | `rating_average`, níveis e reviews. Quantidade pode ser derivada dos níveis/paging quando presente. |

## 5. Autenticação e acesso no projeto

Auditoria realizada sem imprimir valores e sem modificar `.env`:

| Item | Estado | Observação |
|---|---|---|
| `ML_CLIENT_ID` | AUSENTE | Código lê a variável, ambiente não a possui. |
| `ML_CLIENT_SECRET` | AUSENTE | Código lê a variável, ambiente não a possui. |
| Access token (`ML_ACCESS_TOKEN`/`ACCESS_TOKEN`) | AUSENTE | O serviço aceita token somente em memória após callback. |
| Refresh token (`ML_REFRESH_TOKEN`/`REFRESH_TOKEN`) | AUSENTE | Não há persistência/renovação implementada. |
| Credenciais de aplicativo | INCOMPLETO | Fluxo existe, mas aplicação/credenciais apropriadas não foram comprovadas neste ambiente. |
| Código OAuth | PRESENTE | `/api/ml/auth`, callback e troca de `code`; depende também de `REPLIT_DEV_DOMAIN`, ausente. |
| Integração oficial | INCOMPLETO | Serviço de busca/detalhe/enriquecimento existe, porém assume capacidades antigas e não dispõe de credenciais. |
| Configuração de afiliado | AUSENTE | `ML_AFFILIATE_ID` não está configurado; código usa valores/parâmetros próprios sem comprovação oficial neste spike. |

O fluxo atual também não persiste token ou refresh token e não demonstra associação do token a sellers autorizados. Para uma POC autenticada seriam necessários: aplicativo cadastrado, Client ID/Secret, redirect URI válido, permissões funcionais de leitura, autorização OAuth de uma conta apropriada, armazenamento seguro e renovação por refresh token.

## 6. POC pública realizada

Chamadas GET reais, sem credenciais e sem persistência:

| Chamada | HTTP | Resultado |
|---|---:|---|
| `/sites/MLB` | 403 | Policy unauthorized. |
| `/sites/MLB/categories` | 403 | Policy unauthorized. |
| `/categories/MLB3900` | 200 | Categoria “Tênis”, domínio `MLB-SNEAKERS`, 46.696 itens informativos na categoria. |
| `/categories/MLB3900/attributes` | 200 | 97 atributos. |
| `/sites/MLB/domain_discovery/search?q=tenis running` | 200 | Cinco sugestões do domínio `MLB-SNEAKERS`. |
| `/sites/MLB/search?q=tenis running&limit=10` | 403 | `forbidden`; nenhuma oferta. |
| `/products/search?...` | 403 | Policy unauthorized. |
| `/items/MLB1828680414` | 403 | Policy unauthorized. |

O `site_id` do Brasil é **MLB**. A POC não utilizou endpoint não documentado nem tentou contornar políticas.

## 7. Reprodução da intenção da URL

Os IDs foram descobertos pela API de categoria, não inferidos apenas do texto visual:

| Intenção | Representação oficial encontrada | Evidência/limitação |
|---|---|---|
| Categoria tênis | `MLB3900`, domínio `MLB-SNEAKERS` | `/categories/MLB3900`; existe também `mirror_category=MLB23332`. |
| Corrida/running | atributo `SPORT`, valor `65132265` (“Corrida”) | Atributo marcado `hidden`/`read_only`; não foi possível provar sua aceitação como filtro de uma busca global. |
| Novo | condição `new`; atributo `ITEM_CONDITION=2230284` | Categoria aceita `new`, `used`, `not_specified`. |
| Adultos | `AGE_GROUP=6725189` | Confirma o ID presente na URL; atributo `hidden`, `read_only`, `grid_filter`. |
| Desconto 40–100% | nenhum atributo de categoria equivalente | É estado de navegação/SEO. Sem busca global e sem `available_filters`, não foi possível mapear para filtro oficial. |
| Fragmento | estado de UI | Fragmentos não são enviados por HTTP; `applied_value_results=1455` é metadado da página, não contrato de API. |

Não foi possível obter `available_filters` ou `available_sorts` para essa população: o search global respondeu 403, e a API documentada fornece esses blocos no contexto da busca de um seller (com `include_filters=true` quando aplicável). Logo não há evidência oficial de que `SPORT`, `AGE_GROUP` e desconto possam ser combinados para reproduzir a listagem global.

**Resposta principal:** a API consegue interpretar parte da semântica da fonte, mas as APIs oficiais encontradas não conseguem enumerar aproximadamente o mesmo conjunto global de ofertas. Classificação **D**.

## 8. Busca global versus busca por vendedor

Este é o bloqueador principal.

- A [documentação atual de busca](https://developers.mercadolivre.com.br/pt_br/convivencia-me1-me2/itens-e-buscas), atualizada em 07/04/2025, lista `/sites/{site}/search` somente com `nickname` ou `seller_id` e indica `/users/{user_id}/items/search` como substituto para buscas por seller.
- `/users/{user_id}/items/search` lista itens da conta do vendedor e requer Bearer.
- `search_type=scan` permite atravessar mais de 1.000 itens, mas sempre de um usuário/seller.
- A chamada histórica `/sites/MLB/search?q=...` foi testada em 17/08/2026 e retornou HTTP 403.
- Não foi encontrado endpoint oficial documentado de busca global do marketplace para aplicativos agregadores.

Conclusão: **busca global não está disponível ao projeto com o acesso e a documentação oficial atuais**. Um token pode habilitar recursos, mas não constitui evidência de autorização para enumerar sellers não vinculados; isso precisa ser validado formalmente com o Mercado Livre antes de uma POC autenticada.

## 9. Desconto e preço

Desconto não está resolvido pelo simples campo `price`.

1. A documentação de preços informa que `price`, `base_price` e `original_price` de `/items` serão descontinuados como fonte de consulta.
2. O recurso recomendado é `GET /items/{item_id}/sale_price`, que retorna:
   - `amount`: preço de venda vigente;
   - `regular_amount`: preço original quando há promoção;
   - `currency_id`;
   - contexto e, em alguns casos, metadata da promoção.
3. O percentual pode ser calculado como `(regular_amount - amount) / regular_amount`, quando ambos forem válidos. A API não garante um campo percentual universal.
4. `/seller-promotions/items/{item_id}` e `/seller-promotions/promotions/{id}/items` retornam preço e `original_price` para campanhas, mas requerem autorização e são recursos do seller.
5. Cupons aplicados no checkout podem retornar preço promocional zero e porcentagem/valor próprio; não devem ser confundidos com preço visível universal.
6. A própria [FAQ de promoções/precificação](https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao/promocoes-precificacao) alerta que o frontend pode aplicar decorações e recálculos diferentes da API.

Classificação do desconto: **B/C no universo autorizado de itens conhecidos** — exige `/sale_price`, eventual promoção e cálculo; **indisponível para descoberta global geral**.

## 10. Produto de catálogo versus oferta

```text
Catalog Product (modelo/ficha técnica)
    └── catalog_product_id / product id

Item / Listing / Offer (publicação comercial de um seller)
    ├── item_id
    ├── seller_id
    ├── preço e disponibilidade
    ├── condição, frete e permalink
    └── opcionalmente catalog_product_id
```

`/products/search` ajuda um seller a localizar a ficha de catálogo correta para publicar. Ele não substitui a busca de listings. O UpPulse precisa prioritariamente de **items/ofertas**; catálogo é enriquecimento e agrupamento. Para sellers autorizados, uma composição provável é Items + Sale Price + Reviews + Catalog Product. Sem descoberta de item IDs globais, essa composição não cria um feed de marketplace.

## 11. Cobertura dos campos de uma oferta

Não foi possível produzir amostra de dez ofertas: não há token e endpoints de search/item retornaram 403. A tabela registra a capacidade documentada, não dados inventados.

| Campo | Disponível | Endpoint | Observação |
|---|---|---|---|
| `item_id` | Sim, condicionado | seller search / item | É necessário descobrir o item no escopo autorizado. |
| catalog/product ID | Parcial | `/items/{id}`, `/products/search` | Nem todo listing possui vínculo de catálogo. |
| título | Sim | `/items/{id}` | Listing. |
| preço atual | Sim | `/items/{id}/sale_price` | Endpoint recomendado; Bearer. |
| preço anterior/original | Parcial | `/sale_price` (`regular_amount`) | Nulo sem promoção; strikeout pode ter fontes distintas. |
| percentual de desconto | Derivado/parcial | `/sale_price`, promoções | Calcular quando valores comparáveis; cupons/contextos exigem tratamento próprio. |
| moeda | Sim | `/sale_price`/item | `BRL` no site MLB. |
| imagem | Sim | `/items/{id}` | `pictures`/thumbnail. |
| permalink | Sim | `/items/{id}` | Link comum, não necessariamente afiliado. |
| seller | Sim/parcial | item + users | `seller_id`; detalhes dependem de endpoint/permissão. |
| categoria | Sim | item + `/categories/{id}` | Hierarquia e domínio enriquecem. |
| condição | Sim | item | `new`, `used` etc. |
| disponibilidade | Parcial | item | Quantidade pública pode ser representativa, não exata; status é relevante. |
| frete grátis | Sim | item | `shipping.free_shipping`; custo/contexto logístico pode demandar recursos adicionais. |
| atributos/marca/gênero/idade | Sim quando preenchido | item + category attributes | Qualidade varia por listing/categoria. |
| avaliações | Sim, condicionado | `/reviews/item/{id}` | Rating e distribuição; catálogo pode concentrar reviews. |
| quantidade de avaliações | Parcial | reviews | Pode ser derivada da distribuição/paging quando retornada. |
| variações | Sim | item | Estrutura e atributos de variação. |

## 12. Paginação, escala e limites

- Busca comum de itens de seller: padrão 50, máximo documentado 100 por página.
- Sem `scan`, há limite prático de 1.000 resultados mencionado na documentação.
- `search_type=scan` permite mais de 1.000 itens do seller; o `scroll_id` expira em cinco minutos.
- Multiget: a documentação atual de itens e buscas declara máximo de 20 IDs por chamada.
- Sellers acima de 200.000 itens podem não receber agregações/filtros; há endpoint de `restrictions`.
- Não foi encontrada quota numérica universal publicada. Os termos permitem ao Mercado Livre definir limites discricionariamente, cobrar excedente ou interromper acesso. APIs documentam respostas 429 quando a quota é excedida.

Estimativa operacional: dezenas/centenas de fontes são plausíveis **se cada fonte corresponder a sellers autorizados**, com notificações, cache compatível com os termos, backoff e consultas incrementais. Não é possível estimar uma operação global por categoria porque a capacidade de descoberta global não está disponível. A aprovação/quota da aplicação precisa ser obtida antes de dimensionamento.

## 13. Programa de Afiliados e Criadores

Não foi encontrada API oficial de Developers para gerar links de afiliado programaticamente.

A documentação oficial do programa orienta gerar links ou IDs pela Barra de Afiliados, Central/Portal e Gerador de Links. O permalink da Developer API é um link normal; não há evidência de que acrescentar parâmetros manualmente o converta em link afiliado válido.

Restrições relevantes:

- links devem ser gerados pelas ferramentas do programa;
- páginas de categoria, ofertas do dia, vendedores, imóveis, veículos e serviços estão entre páginas não permitidas para geração; produtos individuais da página de ofertas podem ser compartilhados;
- divulgação é permitida em sites/blogs próprios e canais públicos indicados, mas há restrições específicas a buscadores e canais não declarados;
- Developer API e Affiliate Program são contratos/capacidades separados.

O `generateAffiliateLink()` atual e parâmetros `matt_*` não foram validados por documentação oficial nesta pesquisa. Antes de produção, o UpPulse deve obter confirmação escrita ou documentação tecnológica oficial do programa.

## 14. Termos e riscos de conformidade

Resumo factual, sem parecer jurídico:

- a API e o conteúdo só podem ser usados para facilitar/melhorar o uso do site e serviços do Mercado Livre;
- há restrições a produtos/serviços concorrentes e divulgação de informações a terceiros fora do escopo permitido;
- o Mercado Livre pode restringir conteúdo, exigir chaves/certificação e revogar acesso;
- limites de chamadas são discricionários e uso excessivo é proibido;
- é proibido contornar limitações técnicas ou mecanismos de segurança;
- scraping, spiders, harvesters e tecnologias equivalentes para acessar site/conteúdo são expressamente proibidos;
- comercializar, distribuir, copiar, reproduzir ou armazenar conteúdo para finalidades não permitidas/concorrenciais é proibido;
- após revogação, cópias intermediárias do conteúdo e informações pessoais devem ser destruídas;
- há obrigações de confidencialidade, segurança e proteção de dados.

Risco central: um agregador/curador de oportunidades precisa confirmar formalmente que sua exibição, comparação, armazenamento, cache, monetização e audiência se enquadram no uso permitido. Essa validação deve envolver o Mercado Livre e revisão jurídica própria antes de produção.

## 15. URL como entrada do usuário

É viável manter a URL original como evidência e extrair uma **hipótese** de definição estruturada, mas não tratá-la como contrato estável.

Fluxo recomendado para uma POC futura:

```text
URL original
  → validação de domínio/provider
  → tokens estruturais candidatos (categoria, condição, atributos)
  → confirmação por APIs de categoria/domínio/atributos
  → SourceDefinition com confiança e evidências
  → verificação das capacidades da estratégia disponível
```

Exemplo de hipótese obtida nesta POC:

```json
{
  "provider": "mercadolivre",
  "siteId": "MLB",
  "domainId": "MLB-SNEAKERS",
  "categoryCandidates": ["MLB3900", "MLB23332"],
  "condition": "new",
  "attributes": [
    { "id": "SPORT", "valueId": "65132265" },
    { "id": "AGE_GROUP", "valueId": "6725189" }
  ],
  "discount": { "minimumPercent": 40, "support": "unverified" },
  "sourceUrl": "<URL original preservada>",
  "acquisitionCapability": "unsupported_global_search"
}
```

O parser de URL não deve decidir sozinho: IDs devem ser confirmados por API e cada campo precisa de nível de confiança. Mesmo corretamente interpretada, a definição não é executável enquanto não existir estratégia autorizada de aquisição global.

## 16. Arquitetura recomendada (não implementada)

```text
Curation Source
  → Source Interpreter
  → Source Definition + evidências/confiança
  → Collector Resolver
  → Provider Strategy
      ├── Official API (escopo autorizado)
      ├── Feed autorizado
      └── mecanismo permitido pelo provider
  → Normalized Offer
  → Product/Asset resolution
  → Pipeline UpPulse
```

Conceitos devem ser provider-agnostic:

- `Provider`: sistema externo e suas políticas/capacidades;
- `Source`: entrada e intenção original auditável;
- `SourceDefinition`: categoria, atributos, geografia, transação, filtros e confiança;
- `AcquisitionStrategy`: API, feed ou outro canal autorizado;
- `Collector`: executa uma definição dentro das capacidades declaradas;
- `NormalizedOffer`: oportunidade comercial (seller, preço, disponibilidade, URL);
- `Product/Asset`: entidade comparável agrupando ofertas;
- `Capability`: busca global, seller-only, desconto, reviews, paginação etc.

O resolver deve rejeitar definições não suportadas explicitamente; nunca degradar silenciosamente uma fonte global para um seller ou categoria diferente.

## 17. Matriz de viabilidade

| Requisito | API oficial | HTML | Outra opção | Risco |
|---|---|---|---|---|
| Busca geral | Não encontrada/disponível | Bloqueada e termos proíbem scraping | Feed/parceria oficial | Crítico |
| Busca por seller | Sim, autorizado | Não recomendado | Feed do seller | Médio |
| Categoria/domínio | Sim | Presente na URL | Taxonomia interna mapeada | Baixo/médio |
| Marca e atributos | Sim, se preenchidos | Parcial | Enriquecimento próprio/licenciado | Médio |
| Condição | Sim | Sim | — | Baixo |
| Preço atual | Sim, `/sale_price` | Sim | Feed autorizado | Médio |
| Preço original/desconto | Parcial/composto | Visualmente disponível | Feed do seller | Alto |
| Promoções/deals | Sim para seller/campanha | Algumas páginas funcionam | Parceria/feed de campanhas | Alto |
| Frete | Parcial/sim no item | Sim | APIs logísticas autorizadas | Médio |
| Avaliação | Endpoint próprio | Sim | Dados licenciados | Médio |
| Paginação global | Não | Instável/bloqueada | Feed | Crítico |
| Paginação seller | Sim, offset/scan | — | Notificações | Baixo/médio |
| Permalink | Sim para item conhecido | Sim | — | Baixo |
| Imagem | Sim para item conhecido | Sim | Feed/CDN autorizado | Médio (uso/armazenamento) |
| Seller | ID no item | Sim | Seller feed | Médio |
| Catálogo/produto | Sim | Parcial | GTIN/MPN/normalização | Médio |
| Afiliado | Nenhuma API encontrada | Ferramentas manuais oficiais | Acordo/integração específica | Alto |

## 18. Decisão e próximos passos

### Curto prazo

**NO-GO** para substituir scraping por API oficial como principal aquisição global. Manter o collector atual apenas como legado controlado, sem tentar evadir bloqueios, e não representar falhas como zero legítimo.

### Médio prazo

**POC ADICIONAL NECESSÁRIA** para sellers autorizados:

1. contatar Mercado Livre Developers com descrição explícita do UpPulse e obter confirmação do uso permitido;
2. perguntar formalmente por busca/discovery global, feed de ofertas e quotas;
3. cadastrar aplicação e habilitar somente permissões necessárias;
4. implementar OAuth seguro com refresh token em ambiente isolado;
5. autorizar um seller de teste/participante;
6. testar seller search → multiget items → sale price → reviews → catálogo;
7. medir cobertura real de dez ou mais ofertas, latência, quota e divergência do frontend;
8. validar retenção/cache/exibição e afiliados com documentação ou autorização escrita.

### Longo prazo

**GO COM RESTRIÇÕES** para uma arquitetura multi-provider baseada em estratégias autorizadas e capability negotiation. Priorizar feeds e APIs de parceiros que ofereçam descoberta de ofertas de forma contratualmente compatível. Mercado Livre pode participar como estratégia seller-authorized ou feed/parceria, não como premissa global até que o bloqueador seja removido oficialmente.

### Critérios para mudar a decisão

A decisão poderá mudar se o Mercado Livre fornecer pelo menos um destes caminhos:

- endpoint/API oficialmente autorizado de busca global de listings;
- feed de ofertas/deals para afiliados ou parceiros;
- autorização escrita para o caso de uso e quotas suficientes;
- integração tecnológica oficial de afiliados para produtos individuais.

Sem isso, API de catálogo e APIs do seller enriquecem ofertas já conhecidas, mas não substituem o mecanismo de descoberta que o UpPulse necessita.
