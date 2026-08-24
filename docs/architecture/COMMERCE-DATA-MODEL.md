# Modelo de dados de commerce

## Modelo anterior e decisão de compatibilidade

O catálogo anterior usa `products` como conceito publicável, `offers` como preço/link ligado a marketplace e `product_images` por Product. `collection_sources`, `collection_memberships`, `collection_batches`, `raw_collected_items` e `processed_items` formam o pipeline legado de coleta/triagem. Seus hashes têm finalidade de coleta, não constituem identidade Provider/Merchant/Feed. `curation_sources` configura listas operacionais e também permanece inalterada.

Reutilizamos `products`, `offers` e `product_images` porque suas semânticas centrais são compatíveis. Generalizamos apenas `offers` e `product_images` com colunas opcionais. Mantemos todas as colunas, relações, favoritos, rotas e collectors existentes. Não reutilizamos `marketplaces` para Provider/Merchant, nem `raw_collected_items`/`processed_items` para feed Awin.

## Modelo normalizado

```text
commerce_providers
  -> commerce_merchants
  -> commerce_feeds
  -> commerce_raw_feed_items
  -> external_product_identities -> products (sempre draft na ingestão)
       -> product_variants
            -> offers
            -> product_images
            -> offer_promotion_evidence
```

- Provider: `code` global único; o seed/upsert de `awin` é idempotente.
- Merchant: único por `(provider_id, external_merchant_id)`. Nomes de merchants são dados do feed, nunca schema/lógica.
- Feed: único por `(provider_id, external_feed_id)`; merchant é opcional porque um arquivo pode conter mais de um.
- Raw: único por provider + merchant + feed + `identity_hash`; `content_hash` detecta mudança.
- Product: identidade conservadora via `external_product_identities`, única por provider + merchant + `external_product_key`.
- Variant: única por `(provider_id, merchant_id, external_variant_key)`. EAN/GTIN inválido ou sentinela é armazenado somente no raw, não na coluna confiável nem na identidade.
- Offer: única por `(provider_id, merchant_id, external_offer_key)` e ligada a Product/Variant.
- Image: `product_images` é deduplicada por `(product_id, url)` e pode registrar provider/variant/tipo/proveniência.
- Evidência promocional: única por `(offer_id, evidence_source)`, liga old/current/percentual/status/tipo/fonte ao Feed e ao timestamp observado. Não representa Pix.

No modelo existente, `current_price` representa `price`, `original_price` representa `old_price`, `original_url` representa `merchant_url` e `affiliate_url` continua sendo o link afiliado. `aw_deep_link` é copiado literalmente para `affiliate_url`; `merchant_deep_link`, para `original_url`. Nenhum deep link é reconstruído.

## Publicação e proveniência

A barreira é redundante: Product `draft`; external identity `staging` e inativa; Variant inativa; Offer `paused` e inativa. As APIs públicas existentes filtram `products.catalog_status='published'`; nenhuma rota foi alterada e `PUBLIC_DEMO_MODE` permanece intacto.

`provenance_method` prepara `merchant_provided`, `normalized`, `ai_extracted` e `externally_enriched`. Esta missão usa apenas os dois primeiros. Provider, merchant, feed, IDs externos, hashes e timestamps permanecem consultáveis em colunas próprias.

## Idempotência e ausência

O import é uma transação PostgreSQL e usa constraints naturais com upsert. Reimport idêntico não cria Product, Variant, Offer, imagem ou raw. Mudanças de preço/estoque atualizam a Offer existente. O mesmo EAN em merchants diferentes não colide porque merchant participa das chaves.

Itens ausentes são contados em `missingCandidates` comparando as identidades vistas com o estado do feed. Não há delete nem expiração automática. Uma política futura poderá desativar após número de snapshots completos e janela temporal definidos explicitamente.

## Resolução futura e rollback conceitual

Não ocorre merge entre URLs ou merchants. Resolução cross-merchant futura deve criar uma camada canônica/curada acima das identidades externas, com evidência e reversibilidade.

A migration 0006 é somente aditiva. Rollback conceitual, se autorizado no futuro, consiste em parar imports, remover o seed/provider e as novas tabelas/colunas/Enums na ordem inversa das FKs. Esta missão não fornece nem executa `DROP`, pois dados e compatibilidade devem ser preservados.

A migration 0007 também é estritamente aditiva e cria apenas `offer_promotion_evidence` e índices/checks. DAFITI002 aplicou-a ao banco oficial após validação transacional com rollback; nenhuma coluna ou linha anterior foi alterada pela migration.
