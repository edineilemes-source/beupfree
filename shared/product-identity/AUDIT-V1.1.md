# Auditoria Product Identity V1.1

Snapshot: 2026-09-23T00:01:43.341Z. Transação `REPEATABLE READ READ ONLY`,
`transaction_read_only=on`, encerrada com ROLLBACK. Nenhuma escrita operacional.
Baseline V1 executado antes da edição e reproduzido integralmente nesta missão.

Universo: Dafiti 11.424; Fut Fanatics 5.554; total 16.978. Mesma seleção de registros,
topK 5 e similaridade mínima 0.55. Controle positivo: 548 grupos normalizados,
535 grupos um-a-um, 548 produtos Fut, 563 pares. Não exatos: 18.184 pares,
3.925 produtos com candidatos e 1.081 sem candidatos.

| Coorte / nível | AUTO_MATCH | REVIEW | NO_MATCH |
| --- | ---: | ---: | ---: |
| Controle positivo V1 | 554 | 9 | 0 |
| Controle positivo mestre V1.1 | 559 | 4 | 0 |
| Não exatos V1 | 2.675 | 13.400 | 2.109 |
| Não exatos mestre V1.1 | 2.801 | 13.268 | 2.115 |
| Todos os pares, mestre V1.1 | 3.360 | 13.272 | 2.115 |
| Controle positivo, variante V1.1 | 512 | 51 | 0 |
| Não exatos, variante V1.1 | 37 | 12.355 | 5.792 |
| Todos os pares, variante V1.1 | 549 | 12.406 | 5.792 |

Dos 3.360 mestres automáticos: 549 variantes automáticas, 1.312 em revisão,
1.499 incompatíveis. As 5.792 rejeições totais de variante incluem pares cujo
mestre também foi rejeitado ou está em revisão; não significam 5.792 conflitos
entre variantes de mestres confirmados.

## Comparação individual e segurança

Nenhum AUTO_MATCH V1 foi rebaixado. Nos não exatos: 126 REVIEW → AUTO_MATCH,
60 REVIEW → NO_MATCH, 54 NO_MATCH → REVIEW. Sem violações automáticas nos oito
controles negativos de geração, incluindo as sondagens reais além do topK.
Os cinco controles positivos recuperados eram Fresh Foam X 880 V15, X 1080 V14,
X Evoz V4, X More V6 e Puma X Ray 2 Square BDP II. O X interno deixou de ser
uma segunda geração romana. As demais transições foram revisadas com evidência
dos títulos, sem tratar aumento de matches como objetivo de qualidade.

A primeira execução intermediária revelou dois potenciais falsos positivos:
`Aramis Easy Sand Cinza` / `Aramis Easy Cinza` (mestre) e `Klin Freestyle Infantil`
/ `Klin Freestyle Baby` com a mesma cor (variante). Ambos foram corrigidos para
REVIEW no nível correspondente e receberam testes. Uma regressão intermediária
de ordem em `Club Era II` / `Club II Era` também foi corrigida antes do resultado final.

Foram produzidas e inspecionadas quatro amostras determinísticas de 20 pares:
mestre automático com nomes diferentes, mestre automático + variante em revisão,
mestre automático + variante incompatível e mestre em revisão. Foram também
inspecionados os automatches de variante não exatos e os novos automatches de mestre.
Nenhum falso positivo remanescente foi confirmado por essa inspeção de títulos;
isso **não mede precisão** nem comprova igualdade física dos produtos.

Os arquivos locais `/tmp/product-identity-v11-summary.json` e
`/tmp/product-identity-v11-audit.json` contêm, respectivamente, resumo com as 80
amostras completas e relatório detalhado. A saída da CLI padrão reproduz o formato
resumido; `--detailed` habilita o relatório completo. Arquivos temporários não fazem
parte do Git. Cada amostra contém nomes, marca, IDs, ambas as decisões, confidences,
reasons e conflicts. O relatório inclui hashes SHA-256 do parser e matcher.

## Multiplicidade e duplicidades aparentes

- 1.080 produtos Fut têm exatamente um registro candidato mestre automático.
- 767 têm mais de um: 330 com dois, 219 com três, 127 com quatro e 91 com cinco.
- Depois de ignorar variantes: 1.847 produtos Fut têm uma assinatura mestre;
  nenhum tem mais de uma assinatura automática. Existem 580 assinaturas candidatas
  distintas globalmente e 1.847 ligações produto Fut → assinatura.
- Essa unicidade decorre da igualdade estrutural exigida pelo matcher; não elimina
  incerteza de identidade real nem considera candidatos que ficaram em REVIEW.
- 523 grupos de duplicidades aparentes: 1.273 registros, 750 registros adicionais.
  Dafiti: 462 grupos/1.150 registros; Fut: 61 grupos/123 registros. Nenhuma exclusão.
  Os registros podem esconder diferenças de tamanho/SKU não presentes no título.

## Distribuição por marca

Cada célula contém AUTO_MATCH / REVIEW / NO_MATCH, contando pares de ambas as coortes.

| Marca | Mestre | Variante |
| --- | --- | --- |
| adidas | 17 / 130 / 11 | 0 / 73 / 85 |
| aramis | 108 / 357 / 0 | 34 / 281 / 150 |
| asics | 321 / 483 / 367 | 23 / 560 / 588 |
| bibi | 45 / 25 / 4 | 10 / 46 / 18 |
| calvin klein | 21 / 66 / 0 | 6 / 58 / 23 |
| chilli beans | 0 / 3 / 0 | 0 / 2 / 1 |
| coca-cola | 92 / 944 / 2 | 27 / 774 / 237 |
| colcci | 0 / 105 / 0 | 0 / 85 / 20 |
| converse | 2 / 74 / 0 | 0 / 37 / 39 |
| dc shoes | 7 / 42 / 0 | 3 / 35 / 11 |
| democrata | 0 / 30 / 0 | 0 / 30 / 0 |
| everlast | 145 / 399 / 30 | 5 / 434 / 135 |
| ferracini | 11 / 98 / 0 | 5 / 70 / 34 |
| fila | 556 / 1277 / 64 | 79 / 1425 / 393 |
| hocks | 0 / 12 / 0 | 0 / 12 / 0 |
| hoka | 2 / 1 / 0 | 0 / 2 / 1 |
| joma | 96 / 319 / 0 | 6 / 307 / 102 |
| klin | 2 / 110 / 0 | 0 / 99 / 13 |
| mizuno | 103 / 250 / 69 | 11 / 271 / 140 |
| mormaii | 15 / 140 / 0 | 0 / 128 / 27 |
| new balance | 462 / 599 / 428 | 32 / 732 / 725 |
| oakley | 20 / 60 / 34 | 4 / 55 / 55 |
| olympikus | 192 / 1719 / 273 | 42 / 1643 / 499 |
| penalty | 88 / 552 / 326 | 11 / 454 / 501 |
| puma | 365 / 1803 / 328 | 79 / 1579 / 838 |
| qix | 9 / 29 / 0 | 2 / 28 / 8 |
| redley | 72 / 299 / 1 | 19 / 199 / 154 |
| reebok | 73 / 414 / 13 | 7 / 352 / 141 |
| reserva | 130 / 369 / 1 | 63 / 335 / 102 |
| skechers | 75 / 234 / 17 | 21 / 200 / 105 |
| tesla | 2 / 9 / 0 | 0 / 8 / 3 |
| umbro | 258 / 1752 / 76 | 48 / 1576 / 462 |
| under armour | 52 / 412 / 31 | 5 / 368 / 122 |
| via marte | 0 / 43 / 32 | 0 / 43 / 32 |
| west coast | 19 / 113 / 8 | 7 / 105 / 28 |

## Verificação e limites

142 testes focados passaram: 82 de identidade, 13 da auditoria e 47 existentes
relacionados a taxonomia, catálogo operacional e projeção de busca. Todos os testes
V1 foram preservados. Comando utilizado:

```bash
node --import tsx --test --test-isolation=none \
  shared/product-identity/identity.test.ts \
  scripts/product-identity-offline-evaluation.test.ts \
  server/integrations/awin/productTaxonomy.test.ts \
  server/integrations/awin/operationalCatalog.test.ts \
  server/catalogSearchProjection/builder.test.ts \
  server/catalogSearchProjection/repository.test.ts
```

`npm run check` encontrou TS5033/EROFS ao gravar cache em node_modules somente leitura.
`npm run check -- --incremental false` passou. `git diff --check` passou; os arquivos
não rastreados também foram verificados separadamente. Não houve alteração de UI
ou integração de produção que exigisse Playwright, build ou suites completas.

Restam limitações de vocabulário (por exemplo, areia e verde militar), descrições
incompletas, cores parcialmente sobrepostas e ausência de identificadores fortes
nesta auditoria. Cores desconhecidas não são descartadas arbitrariamente. A decisão
automática de variante sem GTIN compara atributos observados, não prova SKU idêntico.
É necessária amostra rotulada com evidência de fabricante antes de persistir ou fundir.

Banco alterado: NÃO. Catálogo alterado: NÃO. Migration criada: NÃO.
Importação executada: NÃO. Commit: NÃO. Push: NÃO. Merge: NÃO. Deploy: NÃO.

PRODUCT IDENTITY V1.1 APROVADO PARA PRÓXIMA ETAPA — validação rotulada offline.
Separação mestre/variante implementada, controles preservados e auditoria somente
leitura concluída; esta aprovação não autoriza persistência ou fusão operacional.
