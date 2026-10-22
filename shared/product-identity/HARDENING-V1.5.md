# Product Identity V1.5 — parsing e candidate retrieval

Implementação na branch solicitada `codespace-preview`, HEAD inicial
`cb88bc54745b23b03dc73ce0365ac6829c802678`. Missão exclusivamente SHADOW.
Nenhuma integração comercial, conexão PostgreSQL, avaliação real V1.5 ou operação Git de publicação foi executada.

## Estado inicial e preservação

`git status --short` antes de qualquer edição:

```text
 M package.json
?? CODEX-LAST-REPORT.txt
?? codex-session-01a0fe8a-acce-7183-b70d-a9d07e6ed2a1.md
?? scripts/product-identity-real-shadow.test.ts
?? scripts/product-identity-real-shadow.ts
?? shared/product-identity/OPERATIONAL-INTEGRATION-V1.md
?? shared/product-identity/REAL-SHADOW-EVALUATION-V1.md
?? shared/product-identity/validation/real-shadow-v1-report.json
```

A alteração anterior em package.json (inclusão do teste real-shadow V1.4) foi preservada.
Os sete arquivos não rastreados anteriores foram preservados. Não foi criada outra
branch porque a missão indicou expressamente codespace-preview. Não houve git add,
commit, push, merge, reset, remoção de artefatos ou sobrescrita do relatório real V1.4.

## A–C. Diagnóstico comprovado

**1080v14:** o tokenizer conservava o token alfanumérico aderido; o extrator
reconhecia versões somente em tokens inteiros `vN`, decimais ou romanos.
Assim, `1080 V14` tinha modelo 1080 e versão 14; `1080v14` tinha modelo
1080v14 e versão ausente. Isso fragmentava evidência estrutural.

**Cores compostas:** extração restrita ao sufixo, mas sem aliases para verde
limão, verde claro e outras combinações pequenas. Como o último token não era
uma cor conhecida, a extração parava; ambos os tokens ficavam no modelo.

**Retrieval:** a V1.4 percorria blocos por marca e IDs antes de ordenar por
Dice do título completo. O budget podia terminar antes de marcas/pares mais
fortes serem alcançados. Cor, público e repetição editorial influenciavam o
ranking. Depois, a seleção gulosa aplicava grau máximo 5 em ambos os endpoints,
preenchendo ciclos locais e podendo saturar pontes entre componentes.
Não havia propostas duplicadas no artefato (2.818 candidatos únicos), portanto
não se atribuiu o problema a duplicação.

No caso real KR7, os grupos de 8 e 5 membros tinham o mesmo Master parseado.
Havia 14 propostas entre eles no conjunto truncado, com Dice máximo
0,8888888888888888; nenhuma estava em candidates ou pairs. Isso identifica
top-K/ordenação como causa concreta nesse caso, sem presumir que todos os
696 produtos sem candidato tenham a mesma causa.

## D. Implementação

1. Normalização de token inteiro `([1-9]\d{2,3})v([1-9]\d?)` somente com
   marca conhecida e tipo SNEAKER reconhecido, sem marcadores de SKU/MPN/ref/código.
   Não divide prefixos/sufixos alfabéticos, modelos de 2 ou 5+ dígitos, zeros
   iniciais, versões zero ou de 3+ dígitos, nem códigos decimais aderidos.
   `1080.5v14` permanece um código inteiro: o tokenizer não o transforma em
   dois sinais de versão. A regra não contém nomes de marca ou produto.
2. Nove combinações pequenas: verde/azul/rosa/cinza + claro/escuro; verde limão.
   Extração continua somente no sufixo e exige a cor base. Claro/escuro/limão
   isolados ou dentro do modelo são preservados. Tons permanecem distintos
   em Variant (`verde-claro`, `verde-escuro`, `verde-limao`), sem colapsar na
   cor base. Nenhuma taxonomia comercial foi alterada.
3. Retrieval estrutural primeiro: marca, tipo, multiset de modelo, versão e
   qualificadores idênticos, sem ambiguidades de Master. A grafia de
   versionTokens não entra nessa assinatura. Evidência incompleta usa Dice
   de título como antes. Score 1 neste caminho significa evidência estrutural
   igual para agendamento; não é probabilidade, GTIN ou decisão do matcher.
4. Dois passes com um budget compartilhado; cada par elegível é contabilizado
   uma única vez. Primeiro evidência estrutural igual, depois propostas por
   título. O percurso enumera elegibilidade nos dois passes: não elimina o
   custo quadrático de enumerar blocos grandes nem aumenta o budget para
   disfarçar esse custo.
5. Antes de preencher candidatos redundantes, reserva pontes entre componentes
   da mesma assinatura estrutural, respeitando grau máximo de ambos os lados.
   A estrutura de conectividade existe somente para selecionar propostas;
   nenhum grupo de identidade é emitido pelo retrieval.
6. Budgets preservados: minSimilarity 0,35; top-K 5; retrieval 100.000;
   avaliação 20.000. Matcher, grouping, adapter e runner V1.4 permanecem intactos.
7. Metadados de parser/retrieval atualizados para V1.5; matcher permanece V1.2
   e grouping complete-pair-check-v1.

O teste que congelava parser V1.2 foi atualizado para o hash do parser V1.5
explicitamente autorizado, mantendo todos os hashes dos artefatos imutáveis,
a avaliação dos parses históricos e as matrizes histórica/atual. Também exige
exatamente os seis registros de parse alterados; não foi removido nem desativado.

## E–G. Arquivos e testes

Modificados nesta missão:

- `shared/product-identity/parser.ts`: normalização conservadora e nove cores.
- `server/productIdentity/candidates.ts`: prioridade estrutural e pontes antes de ciclos.
- `server/productIdentity/contracts.ts`: identificação das versões alteradas.
- `server/productIdentity/shadow.test.ts`: baseline histórico, hashes e deltas explícitos.
- `package.json`: inclusão dos cinco novos arquivos de teste nas suítes existentes,
  preservando a alteração preexistente.

Criados nesta missão:

- `shared/product-identity/v15.test.ts`: versões, cores, casos adversariais e títulos reais.
- `server/productIdentity/v15.test.ts`: comparação com scheduling V1.4 congelado
  para fixtures, top-K, budgets, determinismo, matcher obrigatório e segurança de grupos.
- `server/productIdentity/v15-real-regression-fixture.json`: os 13 alvos KR7 mais
  os 141 concorrentes Fila disponíveis no artefato local; somente campos de identidade.
- `scripts/product-identity-human-audit-v15.ts` e seu `.test.ts`: auditoria local dos
  247 pares, baseline, todas as decisões/motivos e barreira NO/UNSURE.
- `scripts/product-identity-real-shadow-v15.ts` e seu `.test.ts`: entrada manual
  separada, reusando seleção/READ ONLY/rollback anteriores, somente mocks nos testes.
- `scripts/product-identity-compare-v14-v15.ts` e seu `.test.ts`: comparação somente
  de arquivos, sem parser/matcher/evaluação/banco.
- `shared/product-identity/validation/v15-human-comparison.json`: matrizes,
  todas as mudanças de decisão/motivo e registros de parse alterados.
- `shared/product-identity/validation/v15-integrity.json`: hashes completos antes/depois.
- Este relatório.

Foram adicionados 61 testes individuais. As verificações anteriores de REVIEW,
NO_MATCH e NOT_EVALUATED bloqueando fronteiras de grupos continuam ativas.

## H–K. Resultado humano e todas as mudanças

Os 247 pares continuam 157 YES, 87 NO e 3 UNSURE. O baseline foi executado antes
da edição e seus 247 resultados completos conferem exatamente com o baseline
reconstruído dos parses armazenados e matcher V1.2 inalterado.

| MASTER | V1.4 YES / NO / UNSURE | V1.5 YES / NO / UNSURE |
| --- | --- | --- |
| AUTO_MATCH | 147 / 0 / 0 | 148 / 0 / 0 |
| REVIEW | 10 / 53 / 1 | 9 / 53 / 1 |
| NO_MATCH | 0 / 34 / 2 | 0 / 34 / 2 |

Todas as mudanças de decisão:

| PID | Human Master / Variant | MASTER anterior → novo | VARIANT anterior → novo |
| --- | --- | --- | --- |
| PID-0191 | YES / UNSURE | REVIEW → AUTO_MATCH | REVIEW → NO_MATCH |
| PID-0192 | NO / NO | REVIEW → REVIEW | REVIEW → NO_MATCH |

PID-0191: MASTER anterior `MODEL_EVIDENCE_DIFFERS`, `VERSION_PRESENT_ON_ONE_SIDE`;
novo `SAME_BRAND`, `SAME_MODEL_TOKEN_MULTISET`, `COMPATIBLE_VERSION_EVIDENCE`,
`SAME_TECHNICAL_QUALIFIERS`, `COLOR_AUDIENCE_ORDER_IGNORED`.
VARIANT anterior `MASTER_NOT_CONFIRMED`, `COLOR_EVIDENCE_MISSING`;
novo `EXPLICIT_VARIANT_CONFLICT`, conflito `COLOR_CONFLICT`.

PID-0192: MASTER mantém `MODEL_EVIDENCE_DIFFERS`. VARIANT anterior
`MASTER_NOT_CONFIRMED`, `COLOR_EVIDENCE_MISSING`; novo
`EXPLICIT_VARIANT_CONFLICT`, `MASTER_NOT_CONFIRMED`, conflito `COLOR_CONFLICT`.

Há duas outras mudanças de motivo, sem mudança de decisão:
PID-0177 perde `COLOR_EVIDENCE_MISSING` no VARIANT; PID-0188 perde
`VERSION_PRESENT_ON_ONE_SIDE` no MASTER. Todas constam no JSON de comparação.
PID-0242 muda parse, mas mantém decisão e motivos.

HUMAN NO → MASTER AUTO_MATCH: **0**.
HUMAN UNSURE → MASTER AUTO_MATCH: **0**.
Os 147 MASTER AUTO_MATCH anteriores foram preservados.
Não houve VARIANT promovido a AUTO_MATCH nesses pares.
O label VARIANT UNSURE do PID-0191 continua imutável: a nova rejeição por título
não substitui validação humana de variante/SKU.

## L–M. Fixtures e grouping

| Fixture | Baseline | V1.5 | Custo e limite |
| --- | --- | --- | --- |
| 24 identidades, mesmo Master, cores concorrentes, dois merchants | 3 componentes, 54 candidatos | 1 componente, 57 candidatos | 144 comparações; top-K 5; 276 pares avaliados na V1.5 |
| Concorrentes inferiores antes da proposta estrutural forte | forte não recuperado com budget 1/top-K 1 | forte recuperado | 1 comparação; 20 pares não examinados |
| 154 identidades Fila do artefato, preservando competição | dois componentes entre os 13 alvos KR7; 239 candidatos no fixture | 13 alvos no mesmo grupo de 20; 238 candidatos no fixture | 5.586 comparações; top-K 5; 594 pares avaliados na V1.5 |

Os números registrados da fatia Fila no artefato V1.4 eram 239 candidatos,
414 pares avaliados e 2.885 truncados. O fixture V1.5 tem 238 candidatos,
594 pares avaliados e 2.886 truncados. O aumento de verificação de pares internos
é um custo real: grupos maiores exigem mais confirmações. Não é ganho de qualidade
por si só. O fixture sintético prova mudança de scheduling; o fixture real reduzido
preserva o contexto necessário para reproduzir o problema observado.

Isolar apenas os 13 alvos removia concorrentes e já conectava todos pela seleção
antiga. Esse teste reduzido não provaria ganho; por isso foram incluídas as outras
141 identidades Fila. Isso não é reexecução dos 2.000 produtos, nem estimativa global.

Todo grupo dos fixtures foi verificado: cobertura exata de membros, nenhuma
repetição e todos os pares internos registrados como MASTER AUTO_MATCH. Com
budget de avaliação esgotado, pares NOT_EVALUATED bloqueiam merge e a mesma
propriedade se mantém. Master parseado igual mas modelo genérico ou qualificadores
internamente conflitantes continuam REVIEW e não formam grupos automáticos.

## Comparador e execução futura

O comparador valida os artefatos e informa coortes, interseção/adição/remoção,
igualdade dos inputs e scopes, budgets e versões. Coortes só são comparáveis
quando membros e inputs/scopes são iguais. Mudanças de dados impedem atribuição
causal exclusiva à versão. IDs de grupo regenerados não são contados como mudança
quando a composição permanece igual.

Informa MASTER/VARIANT, candidatos acrescentados/perdidos, truncamentos,
unexaminedPairs, coverageLimited, grupos, tamanho máximo, multi-merchant/provider,
produtos com composição de grupo alterada, uniões completas/parciais e splits,
parses alterados, decisões e motivos anteriores/novos, tempos e budgets.
AUTO_MATCH novos/perdidos distinguem pares anteriormente/agora não avaliados de
transições REVIEW/NO_MATCH. Inclui contagens e registros completos, e audita todos
os pares internos dos grupos. Nenhuma conclusão automática de melhora é emitida.

**Comando exato para execução real futura, com a variável já definida no terminal normal:**

```bash
cd /workspaces/beupfree-preview
AWIN_CATALOG_ADMIN_DATABASE_URL="${AWIN_CATALOG_ADMIN_DATABASE_URL:?Defina AWIN_CATALOG_ADMIN_DATABASE_URL no terminal}" node --import tsx scripts/product-identity-real-shadow-v15.ts
```

Produz `/tmp/product-identity-real-shadow-v15.json`. Recusa esse caminho se já
existir, antes de abrir conexão; a escrita usa `wx` para também impedir races.
O callback redireciona a saída do runner anterior e jamais escreve o caminho V1.4.
Seleção da coorte, SQL, READ ONLY e rollback são os anteriores.

**Comando exato para comparação posterior:**

```bash
cd /workspaces/beupfree-preview
node --import tsx scripts/product-identity-compare-v14-v15.ts /tmp/product-identity-real-shadow-v1.json /tmp/product-identity-real-shadow-v15.json
```

Nenhum desses dois comandos foi executado nesta missão. Os testes usam dados
locais e clientes falsos; não abrem conexão PostgreSQL.

## N. Riscos residuais e limites

- Títulos não provam SKU, construção técnica ou equivalência comercial absoluta.
- Uma cor composta no fim pode ser também um nome legítimo de modelo; o contexto
  de sufixo/base conhecida reduz, mas não elimina essa ambiguidade lexical.
- Códigos numéricos aderidos sem marcador explícito de SKU podem ainda ser ambíguos;
  tipos desconhecidos/ausentes e formatos fora da regra ficam conservadoramente intactos.
- Tons desconhecidos, Lilás, variações fora do pequeno vocabulário e descrições como
  Fresh Foam omitido continuam sem solução genérica; não foi criada taxonomia extensa.
- Top-K e budgets continuam podendo fragmentar grupos, especialmente com merchants
  muito desequilibrados, assinaturas grandes e capacidade insuficiente nas pontes.
- A ordenação residual por marca/ID ainda pode deixar pares não exatos sem retrieval
  quando o budget acaba. Não se prometeu retrieval exaustivo nem diversidade ótima.
- Enumeração de blocos permanece quadrática; dois passes adicionam trabalho de
  elegibilidade. Tempo/memória da coorte real V1.5 ainda precisam ser medidos.
- Reunião de componentes pode aumentar custo de verificação quadrática dos grupos;
  budget esgotado bloqueia fusões, sem criar decisões fictícias.
- Scores estruturais V1.5 e Dice puro V1.4 não são a mesma medida de similaridade;
  o comparador compara pares/decisões e não interpreta score 1 como prova de identidade.
- Os 247 labels e fixtures não medem precisão/recall do catálogo, não exercitam
  todos os marketplaces e não autorizam extrapolação aos 32.707 produtos.
- A execução real pode selecionar coorte diferente devido à evolução do catálogo;
  o comparador explicita essa incompatibilidade.

## O. Integridade

Hashes completos antes/depois em `validation/v15-integrity.json`. Foram preservados
os dois datasets, matcher, identity.test.ts, adapter, grouping, shadow.ts, runner/teste
real V1.4 e relatório real `/tmp/product-identity-real-shadow-v1.json`.
A tabela abaixo será complementada pelas verificações e estado Git finais.

| Arquivo | SHA-256 antes | SHA-256 depois | Igual |
| --- | --- | --- | --- |
| `shared/product-identity/parser.ts` | `d13e37922e2a243be4640eddc681db2f71858c93c92af56dd8c306a85b501e08` | `bd50efcc685958bef534a92e3a9f856e19334d1830d9d1b0971dd04c97165126` | NÃO |
| `server/productIdentity/candidates.ts` | `19e20aff931615f3cf471f6177d462ef0a4884fc716c7f54737412a05cdbd6b6` | `7553627960fa5fb1d10cfaf9825db4ce865056c5cb378914af0618a70b61a9ff` | NÃO |
| `shared/product-identity/identity.test.ts` | `df4512d4ad331a4bdbb70b91584c59269bb5ce3158e69025574e9d28cb013500` | `df4512d4ad331a4bdbb70b91584c59269bb5ce3158e69025574e9d28cb013500` | SIM |
| `server/productIdentity/shadow.ts` | `c1c8662f62b36c8208775bcc017bfd94bac550c31bb1393418ada50916dc76a5` | `c1c8662f62b36c8208775bcc017bfd94bac550c31bb1393418ada50916dc76a5` | SIM |
| `server/productIdentity/contracts.ts` | `24149512c00435973b6f6d5b2740b6928847eca3feed94a993a474b22b361af5` | `948c5ab107bf27e89de5d821207de9dbd3e85d86bbc900278caeaa904c19203a` | NÃO |
| `shared/product-identity/validation/golden-v1.json` | `6024db9bbfb06b1975d5bb13fb30e7ae028d7519d49e4e4ac1085717c1fa56a9` | `6024db9bbfb06b1975d5bb13fb30e7ae028d7519d49e4e4ac1085717c1fa56a9` | SIM |
| `shared/product-identity/validation/labeling-v1.json` | `5d269cfd8596cff3d37a56287adc64e142420b6f04f229d880959d919c2c599d` | `5d269cfd8596cff3d37a56287adc64e142420b6f04f229d880959d919c2c599d` | SIM |
| `shared/product-identity/matcher.ts` | `52bd2c2307496ff149e4c5dbb07bbf0e48d02432cf271e7b8af575cf788b686f` | `52bd2c2307496ff149e4c5dbb07bbf0e48d02432cf271e7b8af575cf788b686f` | SIM |
| `server/productIdentity/adapter.ts` | `e059625fea508ab5e41d472ca224101d030171c0bb4137d7fdfadcb8804d918b` | `e059625fea508ab5e41d472ca224101d030171c0bb4137d7fdfadcb8804d918b` | SIM |
| `server/productIdentity/grouping.ts` | `7e30eb5e2d2086054ec816194bac38844b3e9856a99a1bff6a7b27c0cf6f9e16` | `7e30eb5e2d2086054ec816194bac38844b3e9856a99a1bff6a7b27c0cf6f9e16` | SIM |
| `scripts/product-identity-real-shadow.ts` | `aa69ca448458a7d552691f1343d2eb805e4a815d4a80a070eae0d68425091098` | `aa69ca448458a7d552691f1343d2eb805e4a815d4a80a070eae0d68425091098` | SIM |
| `scripts/product-identity-real-shadow.test.ts` | `87b64067320ba71a55f561bd953e80907271bfa080980786cc98bf7ecc653091` | `87b64067320ba71a55f561bd953e80907271bfa080980786cc98bf7ecc653091` | SIM |
| `package.json` | `1a0e5ad1c92f678d66dca7880b7b5865b1607c586520b66385fab89ed88b35b6` | `ae0bb2259dcaee7251e4dcb62a39a06ad48ae15b1f86f85bd67c53668f4b6a47` | NÃO |
| `/tmp/product-identity-real-shadow-v1.json` | `b4f363ef24dde5868339f3c89e8af6b8a2d2c74b7ae4426ad4b6684438d8ade3` | `b4f363ef24dde5868339f3c89e8af6b8a2d2c74b7ae4426ad4b6684438d8ade3` | SIM |

## Verificações finais

- `npm run test:product-identity`: PASS, 10 arquivos de teste, zero falhas.
  O isolamento padrão deste Node 24 apresenta os arquivos como unidades.
- Mesmos dez arquivos com `node --import tsx --test --test-isolation=none`:
  **205 testes individuais, 205 passaram, 0 falharam, 0 ignorados/cancelados**.
- `npm run check`: PASS, saída 0, sem erros TypeScript.
- `git diff --check`: PASS; arquivos novos também verificados individualmente.
- Auditoria humana: PASS; baseline pré-edição e baseline reconstruído conferem
  exatamente nos resultados completos dos 247 pares.
- Isolamento comercial existente: PASS, inclusive projeção, páginas, contagens,
  facetas, preços/ofertas, URLs e falhas locais do SHADOW.

Na primeira execução dos testes novos, dois testes falharam: código decimal
aderido não era conservado integralmente pelo tokenizer; o fixture sintético
formava três componentes antigos, em vez dos dois inicialmente supostos.
O tokenizer foi corrigido e a expectativa do baseline foi ajustada ao resultado
medido da implementação V1.4 congelada. Ambos passaram nas execuções seguintes.
Nenhum teste/dataset/label foi removido para obter aprovação.

Build, suíte unitária global, Playwright e regressão comercial completa não foram
executados: a missão restringe-se ao pipeline auxiliar SHADOW, sem modificação de
fluxos públicos/comerciais. A suíte específica inclui a barreira comercial existente.
A execução real PostgreSQL e a comparação dos dois relatórios reais ficam para
execução manual do usuário; não há números reais V1.5 nesta entrega.

## P. git diff --stat

O diff inclui a alteração preexistente em package.json. Arquivos não rastreados
não aparecem no stat; a lista de arquivos criados acima e o status abaixo os cobrem.

```text
 package.json                          |  4 +--
 server/productIdentity/candidates.ts  | 56 ++++++++++++++++++++++++++++-------
 server/productIdentity/contracts.ts   |  2 +-
 server/productIdentity/shadow.test.ts | 17 +++++++----
 shared/product-identity/parser.ts     | 21 +++++++++++--
 5 files changed, 79 insertions(+), 21 deletions(-)
```

## Q. git status --short

```text
 M package.json
 M server/productIdentity/candidates.ts
 M server/productIdentity/contracts.ts
 M server/productIdentity/shadow.test.ts
 M shared/product-identity/parser.ts
?? CODEX-LAST-REPORT.txt
?? codex-session-01a0fe8a-acce-7183-b70d-a9d07e6ed2a1.md
?? scripts/product-identity-compare-v14-v15.test.ts
?? scripts/product-identity-compare-v14-v15.ts
?? scripts/product-identity-human-audit-v15.test.ts
?? scripts/product-identity-human-audit-v15.ts
?? scripts/product-identity-real-shadow-v15.test.ts
?? scripts/product-identity-real-shadow-v15.ts
?? scripts/product-identity-real-shadow.test.ts
?? scripts/product-identity-real-shadow.ts
?? server/productIdentity/v15-real-regression-fixture.json
?? server/productIdentity/v15.test.ts
?? shared/product-identity/HARDENING-V1.5.md
?? shared/product-identity/OPERATIONAL-INTEGRATION-V1.md
?? shared/product-identity/REAL-SHADOW-EVALUATION-V1.md
?? shared/product-identity/v15.test.ts
?? shared/product-identity/validation/real-shadow-v1-report.json
?? shared/product-identity/validation/v15-human-comparison.json
?? shared/product-identity/validation/v15-integrity.json
```

## Declarações

- Banco acessado: NÃO
- Banco alterado: NÃO
- Migration criada: NÃO
- Catálogo alterado: NÃO
- Publicação alterada: NÃO
- Importação executada: NÃO
- Golden dataset alterado: NÃO
- Human labels alterados: NÃO
- Matcher alterado: NÃO
- Commit: NÃO
- Push: NÃO
- Merge: NÃO
- Deploy: NÃO

PRODUCT IDENTITY V1.5 PRONTO PARA VALIDAÇÃO REAL
