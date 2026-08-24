# Awin Product Feed

## Escopo e arquitetura

Awin é um **provider de aquisição**. Cada anunciante encontrado no CSV é um **merchant**, identificado por `merchant_id`; nomes, domínios e categorias de lojas não fazem parte da configuração do conector.

O fluxo preparado nesta etapa é:

```text
Awin -> feed configurável -> merchant -> raw envelope
     -> normalização -> product -> variant -> offer -> affiliate URL
```

O conector nunca publica produtos e não interfere em `PUBLIC_DEMO_MODE`. A persistência manual desta etapa grava somente staging inativo. Agendamento, IA, recomendação e comparação continuam fora do escopo.

## Configuração segura

`AWIN_PRODUCT_FEED_URL` contém a URL completa secreta. `AWIN_PRODUCT_FEED_ID` é um rótulo operacional não secreto. A URL nunca deve ir para Git, banco, fixture ou log. O downloader mascara caminho, query, usuário e senha em mensagens, usa timeout, limita bytes, valida HTTP e aceita no máximo redirects na mesma origem e no mesmo protocolo.

Para dry-run local, sem rede nem persistência:

```bash
npm run awin:dry-run -- --file /caminho/privado/feed.csv.gz
# equivalente novo:
npm run awin:import -- --file /caminho/privado/feed.csv.gz --mode=dry-run
```

Para uma execução manual usando ambiente (não usada por testes):

```bash
npm run awin:dry-run -- --env
```

Persistência exige simultaneamente `--mode=staging`, `--confirm-staging` e `AWIN_STAGING_DATABASE_URL`. A CLI ignora `DATABASE_URL`, evitando que uma execução acidental use o banco oficial:

```bash
AWIN_STAGING_DATABASE_URL=postgresql://... npm run awin:import -- \
  --file /caminho/privado/feed.csv.gz --mode=staging --confirm-staging
```

Cada feed tem `external_feed_id`; não se cria collector por merchant. A tabela de feeds nunca guarda URL, API key nem referência contendo o segredo.

## Leitura e formato

O módulo aceita CSV UTF-8 com BOM opcional, compactado com gzip. O parser usa o header dinamicamente, não depende da ordem, preserva os valores originais e suporta campos entre aspas com vírgulas, aspas escapadas e quebras de linha. Colunas opcionais ausentes e valores vazios permanecem ausentes/vazios no raw; conversões tipadas retornam `null` quando inseguras.

Uma linha normalizada exige `merchant_id`, `product_name`, `aw_deep_link`, preço numérico não negativo (`search_price`, com fallback para `store_price`) e moeda ISO de três letras reconhecida pelo runtime. Linhas inválidas são contabilizadas com motivos e não viram candidatas.

Os campos de identificação, produto, categoria, preço, disponibilidade, variante, imagem, entrega, links e metadados descritos pela Awin são mapeados quando presentes. A descrição é preservada literalmente; o conector não extrai nem inventa atributos semânticos.

## Raw e proveniência

Cada `AwinFeedItem` contém todas as strings originais. O `AwinRawEnvelope` acrescenta:

- `provider = awin`, `feedId`, `merchantId`;
- `awProductId` e `merchantProductId`;
- timestamp de ingestão;
- `identityHash`, estável para a identidade externa no feed;
- `contentHash`, calculado sobre payload canônico e sensível a alterações.

Segredos não fazem parte do CSV nem do envelope. A proveniência normalizada registra provider, merchant, feed/data feed, IDs externos e `last_updated`. Isso distingue dado fornecido/normalizado e deixa enriquecimento futuro como camada separada.

`raw_collected_items` foi mantida para compatibilidade com collectors legados: exige `batchId`/`rawTitle`, não explicita provider/merchant/feed e não garante idempotência adequada. Awin usa `commerce_raw_feed_items`, com chave única `(provider_id, merchant_id, feed_id, identity_hash)`. Campos com nomes de credenciais são removidos do payload antes da gravação.

## Produto, variante e oferta

As chaves são SHA-256 e sempre incluem provider e merchant quando aplicável.

Produto usa, em ordem:

1. `parent_product_id`;
2. identidade da página de `merchant_deep_link` sem query/fragmento;
3. descritor normalizado de marca + nome + modelo.

O fallback de página agrupa linhas de tamanho sem depender do tracking. O descritor é o último recurso e seus possíveis falsos agrupamentos devem ser auditados antes de persistência.

Variante usa, em ordem:

1. EAN/GTIN estruturalmente válido;
2. `merchant_product_id` com tamanho, cor e demais atributos de variante disponíveis;
3. `merchant_product_id` isolado, quando não há atributos;
4. `aw_product_id` como último identificador externo disponível.

EAN/GTIN não é confiável apenas porque o campo está preenchido. A normalização aceita somente GTIN-8, UPC/GTIN-12, EAN/GTIN-13 e GTIN-14 numéricos com dígito verificador válido. Vazio, whitespace, valores não numéricos, somente zeros e sentinelas como `"0"` são preservados no raw, mas descartados da identidade; a linha continua válida e segue para o fallback.

Todas as chaves continuam contextualizadas por provider, merchant e Product. Oferta usa `aw_product_id`, depois `merchant_product_id`, dentro do merchant. Assim, tamanhos do mesmo modelo compartilham Product, mas mantêm Variant e Offer distintas.

Product por página (`merchant_deep_link` sem query/fragmento) é uma estratégia conservadora desta normalização quando não há `parent_product_id` confiável. Nomes ou descrições iguais em URLs diferentes não implicam automaticamente o mesmo Product. A resolução de entidades entre URLs ou merchants será uma responsabilidade futura de curadoria/entity resolution, sem mesclagem automática nesta camada.

## Links e imagens

`aw_deep_link` é copiado exatamente para `offer.affiliateUrl`: não é reconstruído, limpo ou substituído. `merchant_deep_link` fica separado em `offer.merchantUrl`, apenas como origem comercial/auditoria. Logs nunca devem imprimir ambos integralmente.

Imagens são deduplicadas pela URL exata dentro do produto. A ordem prioriza imagem merchant, imagem Awin, thumbnails, imagem grande e `alternate_image*`.

## Idempotência

O reconciliador puro compara estado por `productKey`, `variantKey` e `offerKey`, classificando `created`, `updated` ou `unchanged`. Imagens usam chave `productKey + URL`. Uma mudança de preço/estoque altera o conteúdo da oferta e resulta em `updated`, sem alterar sua identidade. Linhas inválidas e futuras regras de descarte alimentam `invalid`/`ignored` no relatório de ingestão.

A migration aditiva `0006_commerce_staging_model.sql` introduz:

- providers e merchants com unicidade `(provider_id, external_id)`;
- feeds identificados externamente, sem segredo ou URL;
- raw feed items com unicidade de identidade/conteúdo e JSON original;
- product external identities;
- variants com unicidade por produto e identidade externa;
- offers com merchant, variant, IDs externos, `affiliate_url` e `merchant_url` separados;
- proveniência por entidade e índices únicos para imagens/ofertas.

Awin não é representada em `marketplaces`: isso confundiria rede provedora com merchant. `products` é reutilizada como conceito conservador; sua identidade Awin reside em `external_product_identities`. Todos os Products entram como `catalog_status='draft'`, identidades como `publication_state='staging' AND active=false`, Variants como `active=false` e Offers como `status='paused' AND active=false`.

O repository envolve cada import em transação. Mesmo conteúdo atualiza apenas `last_seen_at` e retorna `unchanged`; conteúdo diferente preserva as chaves e retorna `updated`. Ausências são apenas contadas em `missingCandidates`: nenhum registro é apagado ou desativado automaticamente nesta missão.

AWIN005 adicionou preload de hashes/identities/merchants e bulk upsert de raw/imagens via `jsonb_to_recordset`. A transação e as constraints continuam sendo a autoridade; veja `AWIN-CURATION.md` para benchmark e preview privado.

## Dry-run

O relatório apresenta provider, merchants, linhas raw/válidas/inválidas, candidatos únicos a Product/Variant/Offer, marcas, cobertura de EAN/link/imagem/descrição, faixa de preço, campos mais preenchidos, vazios relevantes e motivos de invalidez. EAN possui métricas separadas de presença bruta, válido e inválido. O relatório também verifica se uma Variant reúne tamanhos ou GTINs válidos diferentes, atravessa Products ou atravessa merchants. Ele consome o stream uma vez e não importa `db`, não abre `DATABASE_URL` e não persiste nada.

## Adição de outro merchant

Solicite um Product Feed Awin compatível, configure-o como novo feed com ID próprio e execute dry-run. O merchant vem de cada linha; nenhuma alteração de código deve ser necessária. Antes da futura persistência, valide taxa de campos, estabilidade de IDs e agrupamento Product/Variant do merchant.

## Importação filtrada Dafiti

DAFITI002 introduziu um pipeline merchant-aware sem hardcode de IDs externos. Ele aceita somente `merchant_category` exatamente `tênis` ou `tênis performance`, promoção `oldPrice > searchPrice > 0`, estoque e todos os campos mínimos. O arquivo completo é lido em preflight antes de qualquer escrita e deve produzir exatamente 74.968 elegíveis. Apenas esses raws são persistidos, separados pelos `data_feed_id` 53075, 53089 e 53091 observados nas próprias linhas.

O import usa stream gzip, batches de 250 e upserts JSONB. Products entram `draft`, identities `staging/active=false`, Variants `active=false` e Offers `paused/active=false`. `offer_promotion_evidence` registra a regra objetiva e a origem `AWIN_DAFITI_FEED`. Reimport idêntico compara feed + identity hash + content hash e pula os upserts de entidades.

## Limitações atuais

- Sem desativação automática de ofertas ausentes entre snapshots; há somente detecção segura.
- A importação staging requer banco já migrado e explicitamente dedicado.
- O fallback por descritor pode agrupar nomes iguais; deve ser medido por merchant.
- Moedas válidas dependem do suporte `Intl` do runtime.
- Não há conversão de encodings legados; feeds devem ser UTF-8.
- `size_stock_amount` é preservado como string porque seu significado/formato pode variar.
- Não há interpretação de descrição, score, IA, comissão ou publicação.
