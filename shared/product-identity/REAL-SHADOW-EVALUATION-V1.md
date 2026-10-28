# Product Identity V1.4 — avaliação real Shadow

**PRODUCT IDENTITY V1.4 REAL SHADOW BLOQUEADO**

## A–D. Base, arquivos e segurança

Branch solicitada e preservada: `codespace-preview`. Base/HEAD: `cb88bc54745b23b03dc73ce0365ac6829c802678` (merge PR #9, base esperada cb88bc5).

Criados na tentativa anterior e atualizados nesta retomada: este documento e `validation/real-shadow-v1-report.json`. Nenhum código modificado. `OPERATIONAL-INTEGRATION-V1.md` já estava não rastreado e foi preservado.

Retomada em 2026-10-02: `AWIN_CATALOG_ADMIN_DATABASE_URL` **PRESENTE**. Código de conexão existente inspecionado: `server/integrations/awin/catalogPersistence.ts` e `scripts/awin-dafiti-catalog-persist.ts` usam a conexão administrativa explicitamente com `pg`. A avaliação somente leitura não requer `AWIN_CURATOR_DATABASE_URL`; nenhuma função de persistência foi chamada.

Tentativa direta com `pg.Client`, conexão lida somente de `process.env`, timeout de conexão de 15.000 ms. Falha **EAI_AGAIN** na resolução DNS, antes de estabelecer conexão e executar `BEGIN READ ONLY`. **transaction_read_only = on NÃO COMPROVADO**. Parada obrigatória: zero consultas reais, nenhuma transação iniciada; ROLLBACK não aplicável. Nenhum valor de conexão foi exibido, copiado ou gravado. Nenhum `.env` criado.

## E. Fontes identificadas pelo código

`server/publicCatalog/operational.ts` instancia `PgCatalogSearchProjectionRepository` com `AWIN_CURATOR_DATABASE_URL`. A projeção comercial lê `catalog_search_products`, `commerce_merchants` e `offers`. A listagem pública aplica `catalog_state = CATALOG_ELIGIBLE` e disponibilidade; ofertas e URL afiliada pertencem exclusivamente ao fluxo comercial.

O adaptador existente `server/productIdentity/adapter.ts`, em conjunto com `shared/schema.ts`, identifica entidades reconciliadas: `products`, `external_product_identities`, `commerce_providers`, `commerce_merchants`, `commerce_feeds`, `brands` e `product_variants`. Isto é descoberta estática, não confirmação do conteúdo/schema implantado. Nenhuma tabela foi consultada nesta missão, inclusive na retomada.

Campos aceitos: product.id/mainName/brandId/updatedAt; identity.id/productId/providerId/merchantId/feedId/externalProductKey/provenanceMethod/lastSeenAt; provider.id; merchant.id/providerId; feed.id/providerId/merchantId; brand.id/name; variants.id/productId/providerId/merchantId/externalVariantKey/size/colour/gtin/ean/upc/mpn/provenanceMethod/updatedAt/lastSeenAt. A disponibilidade vem da projeção comercial e não é entrada de identidade. O adaptador usa nome e marca; GTIN/MPN somente com seleção explícita de variante, sem inferir associação de SKU. Não existe seleção implícita da primeira variante. Não se criou acoplamento a merchant específico.

## F–O. Universo, coorte, decisões, candidatos, grupos, amostras e custo

Todos os números reais estão **NÃO MEDIDOS**, representados por `null` no JSON, nunca por zero. Universo, coorte, providers, merchants, marcas, decisões Master/Variant, produtos sem/um/múltiplos candidatos, agrupamentos, tamanhos, transitividade, padrões REVIEW/NO_MATCH, amostras e tempos reais não puderam ser obtidos. Nenhuma amostragem foi executada; nenhuma amostra real foi produzida. Não é possível estabelecer regra de agregação por Merchant Product aplicada a uma execução que não ocorreu.

Limites existentes V1.3, não alterados: 2.000 entradas, similaridade mínima 0,35, top-K de grau máximo 5 por produto, 100.000 comparações de retrieval e 20.000 pares avaliados incluindo verificação de grupos. Candidate generator usa blocos de marca, compatibilidade de tipo conhecido e Dice de tokens; exclui mesmo provider/merchant. Não houve comparação cartesiana nesta missão.

Riscos estáticos para futura execução: o runner V1.3 rejeita mais de 2.000 produtos; uma coorte maior precisará de seleção determinística documentada e não poderá ser apresentada como universo completo. Retrieval percorre pares dentro dos blocos, inclusive contabilizando pares após esgotar budget; budget de matching não representa sozinho todo o custo de CPU. Falta de marca e universo com um único merchant podem limitar cobertura; não há evidência de que estas condições ocorram no catálogo real. Não houve tuning nem mudança semântica.

## P. Isolamento comercial

`commercialIsolation.test.ts` passou. Com fixtures, compara SHADOW OFF/ON para projeção integral, páginas públicas, contagens, facets, detalhe, URL de redirecionamento e filtros enviados ao repository. Verifica preços, descontos, disponibilidade, ofertas, merchant e elegibilidade pela igualdade integral e mantém os objetos comerciais intactos. Exercita erro, entrada inválida e budgets esgotados. Produto sem promoção permanece fora da projeção mesmo com AUTO_MATCH; produtos com REVIEW/NO_MATCH ou sem candidato continuam sujeitos apenas à elegibilidade comercial.

Esta evidência é local e baseada em fixtures. Todas essas dimensões no catálogo real permanecem NÃO VERIFICADAS. Nenhuma alteração comercial foi realizada; nenhuma chamada real de publicação/importação foi feita.

## Q–S. Verificações, limitações e riscos

- `npm run test:product-identity`: PASS, quatro arquivos (V1.2, avaliação offline, Shadow V1.3, isolamento comercial), zero falhas.
- `npm run check`: PASS.
- Retomada: comparação SHA-256 dos 14 artefatos com os hashes antes da tentativa anterior: PASS, todos idênticos. Não depende de manifesto temporário da sessão anterior.
- `git diff --check`: PASS.
- Testes de novo runner/adaptador: não aplicáveis; nenhum foi criado após o bloqueio de segurança.

Não foram executados testes reais de banco nem avaliação real: conexão presente, porém resolução DNS falhou com EAI_AGAIN nesta sessão. Não é possível aprovar comportamento operacional, qualidade do matcher, transitividade ou isolamento real a partir das fixtures. JSON é registro reproduzível do bloqueio e evidências locais, não relatório de métricas reais. Para retomar é necessário acesso DNS/rede à conexão já disponibilizada; provar READ ONLY antes de qualquer consulta de catálogo e terminar a transação com ROLLBACK.

## T. Hashes SHA-256 antes/depois

Todos idênticos; o JSON registra ambos os valores para cada artefato.

| Artefato | SHA-256 antes = depois |
| --- | --- |
| `shared/product-identity/parser.ts` | `d13e37922e2a243be4640eddc681db2f71858c93c92af56dd8c306a85b501e08` |
| `shared/product-identity/matcher.ts` | `52bd2c2307496ff149e4c5dbb07bbf0e48d02432cf271e7b8af575cf788b686f` |
| `shared/product-identity/identity.test.ts` | `df4512d4ad331a4bdbb70b91584c59269bb5ce3158e69025574e9d28cb013500` |
| `shared/product-identity/validation/golden-v1.json` | `6024db9bbfb06b1975d5bb13fb30e7ae028d7519d49e4e4ac1085717c1fa56a9` |
| `shared/product-identity/validation/labeling-v1.json` | `5d269cfd8596cff3d37a56287adc64e142420b6f04f229d880959d919c2c599d` |
| `shared/product-identity/validation/shadow-v1-fixture-report.json` | `f6eaa1d4e69ef91d2295f4b2232d041fa2239ab29f7ddae7381309aa8456d35b` |
| `server/productIdentity/adapter.ts` | `e059625fea508ab5e41d472ca224101d030171c0bb4137d7fdfadcb8804d918b` |
| `server/productIdentity/candidates.ts` | `19e20aff931615f3cf471f6177d462ef0a4884fc716c7f54737412a05cdbd6b6` |
| `server/productIdentity/commercialIsolation.test.ts` | `144d56a9b3cc0581b1a2d57361cfeb27d28f2356adc277ab0da90c037e694b33` |
| `server/productIdentity/contracts.ts` | `24149512c00435973b6f6d5b2740b6928847eca3feed94a993a474b22b361af5` |
| `server/productIdentity/fixtures.ts` | `5d92c773ca3a10b971d771e8eabb8a8460d7fdb9ffb1c7c3ad325abbe5791862` |
| `server/productIdentity/grouping.ts` | `7e30eb5e2d2086054ec816194bac38844b3e9856a99a1bff6a7b27c0cf6f9e16` |
| `server/productIdentity/shadow.test.ts` | `e4813b4ce9be055487bedd009f8db808280884e2b423fff902995e9c0c460407` |
| `server/productIdentity/shadow.ts` | `c1c8662f62b36c8208775bcc017bfd94bac550c31bb1393418ada50916dc76a5` |

## U–V. Git e transferência

`git diff --stat`: vazio (artefatos novos ainda não rastreados não aparecem neste comando).

`git status --short` verificado nesta retomada:

```text
?? CODEX-LAST-REPORT.txt
?? shared/product-identity/OPERATIONAL-INTEGRATION-V1.md
?? shared/product-identity/REAL-SHADOW-EVALUATION-V1.md
?? shared/product-identity/validation/real-shadow-v1-report.json
```

Cópia integral solicitada em `/workspaces/beupfree/tmp/CODEX-LAST-REPORT.txt`: **NÃO gravada**. O caminho existe, porém está fora das raízes de escrita permitidas nesta sessão (`/tmp` e `/workspaces/beupfree-preview`); a política não permite solicitar ampliação. O arquivo antigo `CODEX-LAST-REPORT.txt` no preview foi preservado. Os dois artefatos oficiais contêm o relatório atualizado do bloqueio.

Banco alterado: NÃO
Migration criada: NÃO
Catálogo alterado: NÃO
Publicação alterada: NÃO
Importação executada: NÃO
Parser V1.2 alterado: NÃO
Matcher V1.2 alterado: NÃO
Golden dataset alterado: NÃO
Human labels alterados: NÃO
Commit: NÃO
Push: NÃO
Merge: NÃO
Deploy: NÃO

PRODUCT IDENTITY V1.4 REAL SHADOW BLOQUEADO
