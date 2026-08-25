# DAFITI005 — catálogo operacional em staging

## Segurança

Esta missão cria código, tipos e a migration `0008_operational_catalog.sql`, mas
não aplica schema nem persiste classificações. O dry-run exige somente
`AWIN_CURATOR_DATABASE_URL`, abre `REPEATABLE READ READ ONLY` e termina com
`ROLLBACK`. Products continuam `draft`, identities continuam `staging`,
Variants continuam inativas e Offers continuam `paused`/inativas.

## Modelo reutilizado e extensão

Provider, merchant, feed, raw payload, identidade externa, Product, Variant,
Offer, promoção e imagens permanecem nas entidades existentes. A extensão é
append-only:

- `product_catalog_classifications`: universe, style, activities, confidence,
  reason codes, estado operacional, versão, horário e evidence raw;
- `product_variant_normalizations`: tamanho/cor raw, normalizado opcional,
  status, reason codes e versão;
- views `latest_*`: selecionam a versão vigente sem apagar histórico.

Os estados operacionais são `CATALOG_ELIGIBLE`, `QUARANTINED`, `OUT_OF_SCOPE`,
`PUBLISHED` e `PAUSED`. Eles não substituem `products.catalog_status`,
`external_product_identities.publication_state` ou `offers.status`; publicação
continua exigindo uma ação separada e explícita.

## Raw + normalized

`product_variants.size` e `colour` continuam sendo a origem raw. A tabela de
normalização acrescenta valores derivados sem sobrescrever a origem.

- numeração BR explícita e fração `40 1/2` são normalizadas com segurança;
- numeração infantil curta exige contexto `INFANTIL`;
- `EG` é suspeito e `único` permanece raw-only;
- cor simples conhecida e compostos delimitados por `/`, `+`, `,` ou `&` são
  normalizados; termos não mapeados ficam raw-only.

Não há conversão internacional ou inferência de equivalência.

## Offer, promoção e affiliate URL

O contrato preserva current price, previous price, percentual decimal da
evidence e percentual do merchant/oferta. Divergências permanecem auditáveis.
Affiliate URL é copiada literalmente: não é reconstruída, encurtada ou trocada
pela merchant URL. Imagens permanecem URLs ordenadas do feed; não são baixadas.

## Contrato de leitura

`OperationalCatalogProduct` contém identidade, marca, nome, descrição, público,
estado, taxonomia versionada, preços, Variants raw/normalized, imagens ordenadas,
merchant e affiliate URL literal. Não há endpoint público nesta missão.

Esse contrato cobre filtros futuros por marca, preço, desconto, público,
tamanho normalizado quando seguro, cor normalizada quando segura, style,
activity, merchant e disponibilidade. Ordenação determinística pode usar preço,
desconto, marca, activity e merchant. Popularidade e relevância aprendida são
explicitamente indisponíveis e não são inventadas.

Os mesmos campos suportam futura comparação de aproximadamente cinco Products
e geração de PDF, mas nenhum comparador, favorito ou PDF foi implementado.

## Identidade, snapshots e atualização

Merchant variation identity nunca é descartada. Tamanho/cor iguais geram apenas
candidatos de revisão, nunca merge. Nomes, descrições, marca+nome e imagens não
são identidade forte.

As tabelas existentes já preservam `content_hash`, `last_seen_at`, preços,
estoque, imagens e evidence. Classificações e normalizações versionadas permitem
comparar snapshots futuros para detectar mudança, desaparecimento ou
reclassificação. Nenhum scheduler ou pausa automática foi criado.

## Dry-run

```bash
npm run awin:dafiti-catalog-dry-run
```

O comando aborta em divergência do snapshot ou se um Product elegível não tiver
Variant, Offer promocional válida, imagem ou affiliate URL, e também se qualquer
entidade Dafiti estiver publicada/ativa. Ele não contém comandos de escrita.

## DAFITI006 — persistência controlada

A carga inicial é feita exclusivamente pela CLI privada
`awin:dafiti-catalog-persist`. Ela não consulta `DATABASE_URL` implicitamente:
exige `AWIN_CATALOG_ADMIN_DATABASE_URL`, `AWIN_CATALOG_EXPECTED_HOST`, modo
`staging`, merchant `17697`, confirmação e versões explícitas. O processo valida
o usuário/database conectado, o fechamento editorial e a invisibilidade antes
do commit.

As chaves únicas `(product_id, classifier_version)` e
`(variant_id, normalizer_version)` tornam um reimport idêntico um no-op. Conteúdo
divergente sob a mesma versão aborta a transação; ele nunca é resolvido com
`UPDATE`. Inserts são enviados em lotes dentro de uma única transação, enquanto
triggers bloqueiam todo `UPDATE`/`DELETE` posterior. As views `latest_*` usam
ordenação total por timestamp, criação e ID.

Exemplo operacional (os valores das variáveis devem vir do cofre do ambiente e
nunca ser registrados em logs):

```bash
npm run awin:dafiti-catalog-persist -- \
  --mode=staging \
  --merchant=17697 \
  --classifier-version=uppulse-taxonomy-v1 \
  --normalizer-version=uppulse-normalizer-v1 \
  --confirm-staging
```

Persistir metadados operacionais não muda `products.catalog_status`,
`external_product_identities.publication_state`, `product_variants.active` nem
`offers.status/active`. Publicação continua fora desta pipeline.
