# Mercado Livre Affiliate Lists — auditoria ML001

Data da observação: 2026-08-21. Escopo: investigação e POC local somente leitura. Nenhum collector, banco, migration, publicação, deploy ou geração artificial de link foi executado.

## Resultado observado

A URL oficial fornecida foi `https://meli.la/16CfhYV`. Uma requisição HTTPS simples, sem cookies ou autenticação, recebeu `HTTP 403`, `Content-Type: text/html`, servidor CloudFront, zero redirects e permaneceu no host `meli.la`. O corpo era uma página de bloqueio (2.586 bytes), não a lista. Não houve retry, troca de identidade, browser automation, CAPTCHA ou tentativa de contorno.

Consequentemente, deste ambiente não foi possível verificar a URL final, a estrutura da lista, a quantidade real, os IDs ou campos dos sete itens esperados. Esses dados são **não observados**, não zero. A POC não hardcoda sete.

O material oficial público confirma que uma Lista de Afiliados é criada na Central, marcada pública e compartilhada por um único link; produtos são adicionados a ela pela página individual. A documentação também afirma que links individuais oficiais podem ser gerados pela Barra de Afiliados ou pela Central, usando “Compartilhar”. Não foi encontrada API pública documentada para ler Listas de Afiliados nem para gerar seus links individuais programaticamente.

## Código Mercado Livre preexistente

O pipeline legado inclui:

- `server/services/mlCollectionsCollector.ts`: scraping HTML de páginas de ofertas, múltiplos User-Agents, retries/backoff, paginação, filtro mínimo de desconto e construção manual de parâmetros `matt_*`;
- `server/jobs/collectCollections.ts`: acessa banco, cria raw/processed/Product/Offer, reconstrói link afiliado, pode publicar automaticamente por padrão e desativa memberships ausentes;
- `server/services/mercadolivre.ts`: cliente de Items/Search API e OAuth em memória, mas também contém geração manual de link afiliado;
- `server/jobs/collect.ts`, `server/jobs/scheduler.ts`, `server/curationSources/mercadoLivreCollector.ts` e registro em `server/routes.ts`: execução manual/agendada e adaptador para o pipeline legado;
- `server/services/mlScraper.ts`, rotas de seções e scripts de backfill: consumidores auxiliares acoplados ao Mercado Livre.

Reutilizável: tipos de itens/variações da API, extração de atributos oficiais, conceitos de sanitização e o modelo commerce Provider/Merchant/Feed/Raw/Identity/Product/Variant/Offer/Image. Legado/perigoso para ML001: qualquer collector/job/scheduler, scraping com evasão, escrita no banco, publicação/desativação e toda função que acrescente `matt_*`. Tudo deve permanecer desligado. A integração AWIN é independente e não foi alterada.

## POC read-only

`server/integrations/mercadolivre/affiliateList.ts` é uma normalização pura de JSON-LD já obtido legitimamente. Ela não faz rede, não executa scripts, não lê ambiente, não conecta ao banco e não publica. Extrai Product/ItemList, IDs MLB/MLBU, título, marca, imagem, URL normal, preço, preço anterior, moeda e disponibilidade quando presentes. Deduplica por `identityHash` e produz `contentHash` determinístico.

A URL encontrada no JSON-LD é sempre `merchantUrl`. `affiliateUrl` permanece `null`: somente um valor copiado literalmente de `AFFILIATE_TOOL` poderá preenchê-la em uma fase futura. A POC jamais acrescenta ou reconstrói parâmetros.

### Evidência e classificação

Cada campo extraído recebe origem `STRUCTURED_DATA`; cálculos recebem `DERIVED`. O desenho admite ainda `LIST_PAGE`, `PRODUCT_PAGE`, `OFFICIAL_API` e `AFFILIATE_TOOL`.

- `PROMOTION_CONFIRMED`: `oldPrice > currentPrice`, ou percentual estruturado positivo.
- `NOT_PROMOTIONAL`: evidência estruturada explícita de ausência, inclusive preços anterior/atual iguais ou invertidos.
- `PROMOTION_UNCERTAIN`: há somente preço atual ou faltam evidências confiáveis.

Quando ambos os preços existem, `discountPercentCalculated = (oldPrice-currentPrice)/oldPrice*100`, arredondado a duas casas. Se a fonte também fornecer percentual, a divergência em pontos percentuais é preservada. Texto promocional oficial poderá ser evidência adicional no futuro, mas deve ser capturado literalmente com origem; texto livre do vendedor não deve bastar.

## Campos e fontes recomendadas

| Campo | Prioridade e origem |
|---|---|
| item ID, seller ID, official store, categoria, condição, variações, atributos | Items API oficial autorizada (`OFFICIAL_API`) |
| título, imagem, preço, `original_price`, moeda, disponibilidade, frete | API oficial; JSON-LD oficial como fallback |
| desconto/badge/validade | campo promocional oficial, lista ou página, preservando origem e instante |
| avaliação/reviews/vendidos | API/campo estruturado quando autorizado; não inventar se restrito |
| tamanhos/cores | IDs e combinações oficiais de `variations`; atributos apenas como fallback |
| affiliateUrl | cópia literal da Barra/Central (`AFFILIATE_TOOL`) |
| merchantUrl | `permalink`/URL canônica oficial |

A API Items documenta `id`, `seller_id`, `official_store_id`, `price`, `original_price`, moeda, categoria, permalink, imagens, atributos e variações, sujeitos a autenticação/permissões e mudanças de visibilidade. Ela é adequada para enriquecimento após descobrir IDs, mas não comprova atribuição afiliada e não foi demonstrada como API de listas.

## Arquitetura recomendada

```text
Affiliate List (discovery; snapshot completo quando verificável)
  -> IDs oficiais
  -> Items API / dados estruturados (enrichment)
  -> verificação determinística da promoção
  -> normalização + hashes + raw imutável
  -> staging inativo
  -> curadoria humana
  -> publicação (fora da ML001)
```

- Provider: `mercadolivre`, tipo marketplace/affiliate program; não é o Merchant.
- Merchant: seller/loja, chave `seller_id` oficial. `official_store_id` é atributo separado.
- Feed/source: `affiliate_list`; external feed ID deve ser um identificador estável fornecido oficialmente, ou um hash estável do link público sem parâmetros sensíveis.
- List: “UpPulse Promoção”, com URL pública preservada em armazenamento protegido e sanitizada em logs.
- Raw: payload por observação, com `identityHash`, `contentHash`, `observedAt`, origens por campo e status do snapshot.
- Product identity: `item_id` (MLB/MLBU). Se houver `catalog_product_id`, preservá-lo para resolução futura, sem substituir silenciosamente item por produto de catálogo.
- Variant: variation ID oficial. Sem variações expostas, usar uma chave explícita e determinística `item:<id>:default`, nunca título/tamanho inferido.
- Offer: `item_id + seller_id + variation_id/default`; contexto de promoção pode mudar conteúdo/versão, não a identidade da Offer.
- URLs: `affiliateUrl` literal do mecanismo oficial; `merchantUrl` canônica. Nunca derivar a primeira da segunda.

O modelo commerce atual cobre quase todos os campos exigidos. Para representar uma lista multi-merchant, `commerce_feeds.merchant_id` deve continuar nulo e cada raw/identity/offer aponta ao Merchant correto. Antes da ML002, deve-se decidir como registrar metadados da lista e proveniência por campo; nenhuma migration é proposta/executada aqui.

## Atualização e fim da promoção

Cada execução futura deve ter `snapshotId`, início/fim, resultado completo/parcial/bloqueado e `observedAt`. Apenas snapshots completos podem alimentar ausência. Reconsultar itens pela API autorizada e comparar preço, preço anterior, percentual, disponibilidade, status e presença na lista.

Uma oferta vira candidata a pausa quando: a API indica inativa/sem estoque; os campos objetivos deixam de demonstrar promoção; validade oficial expirou; ou o item fica ausente da lista em múltiplos snapshots completos. Recomenda-se confirmação em duas observações completas separadas por janela configurável, salvo término explícito/validade. A transição deve ir para staging/curadoria e produzir razão auditável; nenhuma despublicação automática foi implementada.

## Links afiliados e atribuição

O link curto é oficialmente compartilhável para a lista, logo é um artefato afiliado oficial da lista. A documentação pública diz que compras iniciadas por links de afiliado podem gerar receita, mas a cadeia técnica de redirect/cookie desta URL não pôde ser observada devido ao 403. Também não foi possível clicar nos itens nem provar que a atribuição da lista persiste na URL individual.

Para links individuais, o caminho comprovadamente oficial é a ação “Compartilhar” da Barra de Afiliados ou da Central. Até existir API oficial autorizada que forneça esses links, a ingestão exige etapa manual: capturar o link individual fornecido pelo ML, associá-lo ao item ID e preservá-lo literalmente. Não aceitar parâmetros reconstruídos pelo legado.

## Riscos e decisão

- Legal/termos: canais precisam estar declarados e dados promocionais não podem ser falsos/desatualizados; scraping/evasão pode gerar bloqueio ou penalidade.
- Técnico: 403, HTML instável, conteúdo renderizado, campos dependentes de sessão/localização, preços por variação e restrições da API.
- Operacional: lista pode mudar sem webhook; link individual pode exigir ação autenticada; snapshot parcial não pode causar pausa; promoções expiram rapidamente.
- Dados: seller e loja oficial não são equivalentes; item, catálogo e variação não devem ser colapsados; preço único não prova promoção.

Decisão ML001: **NEEDS_MANUAL_AFFILIATE_LINK_STEP**. A descoberta/enriquecimento pode ser automatizada somente após uma captura permitida dos IDs da lista, mas a atribuição individual não foi comprovada nem há gerador oficial programático documentado. Se a lista continuar inacessível a um cliente server-side autorizado, a própria descoberta também deverá usar export/captura manual oficial, não scraping evasivo.

## Referências oficiais

- Mercado Livre, “Crie Listas”: https://www.mercadolivre.com.br/l/crie-listas
- Mercado Livre, “Comece a Recomendar”: https://www.mercadolivre.com.br/l/comece-a-recomendar
- Mercado Livre Developers, “Itens e buscas”: https://developers.mercadolivre.com.br/pt_br/itens-e-buscas
- Mercado Livre Developers, “Publicar produtos” (objeto Item): https://developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao/publicacao-de-produtos
