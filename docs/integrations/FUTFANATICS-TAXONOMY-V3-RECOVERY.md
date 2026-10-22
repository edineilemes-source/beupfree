# Reconstrução FutFanatics — uppulse-taxonomy-v3

Data: 2026-09-14. Merchant Awin: 17893. Feed da missão: 46605.

## Recuperação

Worktree persistente: `/workspaces/beupfree-futfanatics-taxonomy`.
Branch: `futfanatics-taxonomy-fix`.
HEAD e `origin/codespace-working`: `9d2dba32f327e98d7bbbe4034b8c148dec7d3935`.

O diretório antigo estava ausente. Somente seu registro administrativo foi removido com `git worktree remove /tmp/beupfree-futfanatics-visible`. O outro registro de worktree foi preservado. Nenhum arquivo do worktree compartilhado foi editado.

## Resultado e prova de equivalência

| Medida | Esperado | Reconstruído |
|---|---:|---:|
| Produtos | 19.861 | 19.861 |
| SNEAKER_CONFIRMED | 6.831 | 6.831 |
| SNEAKER_PROBABLE | 0 | 0 |
| UNRESOLVED | 4.568 | 4.568 |
| NON_SNEAKER | 8.462 | 8.462 |
| Confirmados com promoção válida | 5.554 | 5.554 |
| Confirmados sem promoção válida | 1.277 | 1.277 |
| Potencialmente elegíveis | 5.554 | 5.554 |

As classificações originais v3 de 2026-09-11 permaneceram no banco. A comparação dos 19.861 produtos teve zero diferenças em universo, estilo, atividades, confiança, motivos, estado operacional e evidência de classificação. A comparação desconsidera a ordem das chaves JSON e não exige atualizar timestamps de uma classificação idêntica.

A persistência oficial com `--classification-only` verificou 19.861 registros: zero criados, 19.861 inalterados, zero inválidos/conflitos. As 59.583 classificações históricas do merchant também permaneceram idênticas, incluindo timestamps.

A consulta de evidência promocional é LEFT JOIN: ausência de promoção não exclui o produto da taxonomia, mas continua impedindo sua elegibilidade. Nenhuma regra de `promotionConfirmed`, `validCurrentPrice`, `validOldPrice`, `discountConsistent` ou `validatePromotion` foi relaxada.

## Execução

As variáveis administrativas foram carregadas sem copiar ou registrar credenciais no worktree.

```bash
node --import tsx scripts/awin-dafiti-catalog-persist.ts \
  --mode=staging --confirm-staging --merchant=17893 \
  --classifier-version=uppulse-taxonomy-v3 \
  --normalizer-version=uppulse-normalizer-v1 \
  --classification-only --dry-run
```

Depois da prévia READ ONLY e dos testes, o mesmo comando foi executado sem `--dry-run`. O modo classification-only não chama a persistência de normalizações. A persistência de classificações continua append-only, idempotente e rejeita conflito de conteúdo na mesma versão.

## Auditoria

Zero elegíveis sem promoção válida. Zero confirmados com nomes de bolas, faixas, raquetes, bolsas ou sapatos. `catalog_search_products` permanece com 227 FutFanatics; nenhuma projeção foi executada.

A lista nominal dos 30 produtos da auditoria anterior não estava disponível. A equivalência integral cobre todos os 6.831 confirmados originais. A amostra reproduzível abaixo contém 30 produtos reais dos modelos citados na missão; todos eram falsos negativos v1 e foram confirmados na reconstrução. Esta amostra não é apresentada como a lista histórica recuperada.

| Product ID | Nome | v1 | v3 | Estado comercial |
|---|---|---|---|---|
| 001dd3b2-0670-4202-b699-121969eb7ac6 | Tênis Adidas Lite Racer 4.0 Off White e Laranja | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 00a2ea94-7df3-4e17-ae5d-93b1ec771931 | Tênis Olympikus Circuito Branco e Preto | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 00b72821-628e-49de-b6d7-3f765951a902 | Tênis Asics Gel Excite 11 Feminino Laranja | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | QUARANTINED |
| 016b5a99-9c40-4044-bcf9-158c347398e0 | Tênis Asics Gel Excite 11 Feminino Lilás | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 02854039-4fe1-4493-8ce2-31b228e9c679 | Tênis Adidas Runfalcon 5 Cinza e Laranja | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 0474575e-9c6e-4f86-ad10-e12eef69f288 | Tênis Adidas Runfalcon 5 Feminino Cinza e Preto | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 053bb128-4f91-424b-a111-fef1f5c06196 | Tênis Adidas Runfalcon 5 Juvenil Preto | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | QUARANTINED |
| 18f2f404-2200-4b4b-b126-2fefd1b02690 | Tênis Adidas Lite Racer 4.0 Cáqui | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | QUARANTINED |
| 1cb5127b-d67c-4fd8-8dc9-a4d8325c8d82 | Tênis Adidas Lite Racer 4.0 Feminino | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 2334ab78-1470-4083-aebb-d5071e732440 | Tênis Adidas Runfalcon 5 All Black | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 2430ee41-55f0-432f-b65e-cbfc083c11e1 | Tênis Adidas Runfalcon 5 Feminino Branco e Lilás | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 2545f1cd-d05a-4309-9830-78f077715d73 | Tênis Adidas Runfalcon 5 EL Kids Marinho | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | QUARANTINED |
| 30b6c7b7-46aa-4aed-882b-be8fb13ed589 | Tênis Asics Gel Excite 11 Feminino Salmão | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 33730702-2613-40c1-b666-3201c87c2222 | Tênis Adidas Runfalcon 5 Preto e Laranja | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 352cfe54-d7db-4f83-b8b7-072f983466a9 | Tênis Asics Gel Excite 11 Marinho | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 3d9ced1a-681c-435c-b315-369618dd3b75 | Tênis Adidas Runfalcon 5 Feminino Preto e Dourado | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 3e8193c6-59dd-441d-b92d-01d9d9965796 | Tênis Adidas Lite Racer 4.0 Preto | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 3f8143f4-885a-440a-93eb-f4d45c4fa7b4 | Tênis Adidas Runfalcon 5 Juvenil Lilás | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 4ad09838-bbc2-458d-afcb-ffa139711612 | Tênis Adidas Runfalcon 5 TR Preto e Cinza | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 508d1bba-86db-4ea8-a06d-264857bca653 | Tênis Olympikus Circuito Preto e Cinza | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 5360698b-f6cc-4f26-be0f-838d3ce080de | Tênis Adidas Runfalcon 5 TR Cinza e Preto | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 563b49f7-6201-4b7d-ab43-06004e5a4ad4 | Tênis Adidas Runfalcon 5 Feminino Verde | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 59fb74ae-1208-41aa-8b7d-4b1ff761416f | Tênis Adidas Runfalcon 5 Verde | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 6657309b-03a3-4f8f-b2f2-1368e44e4a96 | Tênis Olympikus Circuito Cinza | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 7021e84c-eaf9-4da4-982c-e51e0eba4afe | Tênis Adidas Runfalcon 5 EL Kids Preto e Branco | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 70f25815-41e6-45b0-abf9-ec8f9b760b27 | Tênis Adidas Runfalcon 5 Juvenil Roxo | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | QUARANTINED |
| 744ca645-3a22-4bae-8131-d8e6bfe1ef6f | Tênis Asics Gel Excite 11 Feminino Marinho | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 7574b4cc-f282-45ad-8637-85c42d68fad4 | Tênis Adidas Runfalcon 5 Juvenil Azul Royal e Branco | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 7774b3a6-7910-48c4-892b-1e007d8f92a5 | Tênis Asics Gel Excite 11 Preto | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |
| 7a6d7a39-1183-426c-9c25-30b52d9ab6f1 | Tênis Adidas Runfalcon 5 Bege | SNEAKER_PROBABLE | SNEAKER_CONFIRMED | CATALOG_ELIGIBLE |

## Integridade das tabelas protegidas

Contagem e checksum do conteúdo completo de cada tabela foram comparados antes/depois, em transações somente leitura. Todos permaneceram iguais.

| Tabela | Linhas antes/depois | Checksum antes/depois |
|---|---:|---|
| commerce_raw_feed_items | 96343 | `d0e3d70b3514b6f3de59d3eb8ebfda37` |
| products | 32707 | `1f8d238efa713f55515bbe46871c5d08` |
| product_variants | 96343 | `faf8c28fb962a9b3f743bbd0c4ea74d5` |
| offers | 96851 | `28caf780ec081d6a8bc6af604722b291` |
| offer_promotion_evidence | 91810 | `d9c47c1b189adc4693afaf71ae8f83f9` |
| catalog_search_products | 11651 | `97e74452c51ccc1ac6c92098deccd21f` |
| product_variant_normalizations | 94829 | `4d267dbb29ff7e7d3f4ccd9f00cdf94e` |

## Testes

```bash
node --import tsx --test --test-isolation=none \
  server/integrations/awin/productTaxonomy.test.ts \
  server/integrations/awin/operationalCatalog.test.ts \
  server/catalogSearchProjection/builder.test.ts
npm run check
git diff --check
```

42 testes passaram, zero falhas. TypeScript e diff sem erros. A primeira execução de TypeScript teve bloqueio EROFS ao gravar o cache no worktree persistente; a repetição com permissão passou. Os testes finais foram executados sem isolamento para registrar explicitamente os testes individuais neste ambiente Node 24.

Sem nova importação, alterações de evidências promocionais, schema, migrations, projeção, commit, push, merge ou deploy. Os cinco arquivos reconstruídos permanecem não commitados no worktree persistente.

## Conclusão

V3 RECONSTRUÍDA COM SUCESSO — PRONTO PARA PROJETAR.
