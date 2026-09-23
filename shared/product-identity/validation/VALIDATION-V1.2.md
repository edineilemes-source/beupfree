# Product Identity V1.2 — Validação humana e técnica

Registro de consolidação: 2026-09-23, branch `codespace-preview`.
Esta missão documenta a implementação existente; não altera parser, matcher,
testes, golden dataset ou human labels. Não realiza persistência ou fusão de produtos.

## Contexto do produto e segurança

Product Identity é uma capacidade auxiliar do UpPulse. O objetivo central é
**encontrar e apresentar produtos/ofertas realmente em promoção**. Identidade
entre marketplaces permite consolidar ofertas, comparar preços, evitar duplicidade
desnecessária e futuramente apoiar comparação/recomendação. Matching perfeito
entre marketplaces **não é requisito para publicação de um produto no catálogo**.

A arquitetura permanece:

```text
Produto Mestre
    ↓
Variante
    ↓
Oferta
```

Não existe entidade Product Family nesta arquitetura. O campo legado `modelFamily`
do parser não introduz uma entidade de domínio. Similaridade/recomendação de produtos
é um problema separado de Product Identity. O domínio continua multi-marketplace;
Dafiti e Fut Fanatics são os parceiros presentes nesta avaliação.

**PRECISÃO DO AUTO_MATCH > COBERTURA.** Um falso negativo de identidade pode manter
duas ofertas separadas, o que é tolerável. Um falso positivo pode fundir produtos
diferentes, consequência mais grave. REVIEW é uma decisão válida e desejável quando
a evidência não permite fusão automática segura; REVIEW não autoriza fusão.

## Dataset e método

Fontes locais: [golden-v1.json](golden-v1.json) e [labeling-v1.json](labeling-v1.json).
São **247 pares reais Dafiti × Fut Fanatics**, com os seguintes labels de Mestre:

| Human Master | Pares |
| --- | ---: |
| YES | 157 |
| NO | 87 |
| UNSURE | 3 |
| Total | 247 |

O dataset foi construído para avaliação do matcher, com amostragem por estratos de
decisão; não representa necessariamente uma amostra estatística aleatória de todo
o catálogo. Não se estima precisão global do catálogo a partir destes resultados.

A baseline histórica vem de `golden.cases[].matcherV11.masterDecision`. Os labels
vêm de `labeling.cases[].humanLabel.sameMaster`, associados por `id`, e não da
previsão do matcher. A V1.2 é executada novamente sobre os inputs `identity.raw`
armazenados no golden. Os parses atuais foram comparados aos parses do snapshot.
Nesta consolidação não se executou um matcher V1.1 reconstruído: confirmou-se sua
matriz registrada no golden, preservando os resultados históricos.

## Baseline V1.1 MASTER × HUMAN

| Decisão | YES | NO | UNSURE |
| --- | ---: | ---: | ---: |
| AUTO_MATCH | 147 | 0 | 0 |
| REVIEW | 7 | 52 | 1 |
| NO_MATCH | 3 | 35 | 2 |

AUTO_MATCH: **147/147 casos avaliados como HUMAN YES**.
**0 falsos positivos observados neste dataset** entre os AUTO_MATCH.
Isso não demonstra precisão absoluta no catálogo nem ausência de erros futuros.

## Resultado V1.2 MASTER × HUMAN

| Decisão | YES | NO | UNSURE |
| --- | ---: | ---: | ---: |
| AUTO_MATCH | 147 | 0 | 0 |
| REVIEW | 10 | 53 | 1 |
| NO_MATCH | 0 | 34 | 2 |

Foram confirmadas exatamente quatro mudanças de decisão de Mestre:

| PID | V1.1 | V1.2 | Human Master | Números FUT × DAF |
| --- | --- | --- | --- | --- |
| PID-0208 | NO_MATCH | REVIEW | NO | `["1"]` × `["1","70"]` |
| PID-0226 | NO_MATCH | REVIEW | YES | `["3"]` × `["3","34"]` |
| PID-0230 | NO_MATCH | REVIEW | YES | `["2"]` × `["1285710","2"]` |
| PID-0235 | NO_MATCH | REVIEW | YES | `["101"]` × `["101","36"]` |

Os demais 243 pares mantiveram a decisão de Mestre. Nenhum novo AUTO_MATCH foi
criado. Os **147 AUTO_MATCH anteriores foram preservados**. HUMAN NO → AUTO_MATCH:
**0**. HUMAN UNSURE → AUTO_MATCH: **0**. A V1.2 também tem **0 falsos positivos
observados neste dataset** entre os AUTO_MATCH.

Nos quatro pares, a rejeição anterior tinha `MODEL_NUMBER_CONFLICT`. Agora aparecem
`AMBIGUOUS_ADDITIONAL_MODEL_NUMBER` e `MODEL_EVIDENCE_DIFFERS`; PID-0235 também mantém
`TECHNICAL_QUALIFIER_EVIDENCE_DIFFERS` por `SE`. O label YES de PID-0235 não comprova
que SE seja irrelevante: a equivalência comercial permanece inconclusiva, em REVIEW.

## Regra V1.2 e proteções

Implementação em [matcher.ts](../matcher.ts), funções `matchMaster` e
`isStrictSubmultiset`. Consideram-se os tokens inteiros de `modelTokens`.
Quando ambos os lados têm números, e os números de um lado estão estritamente
contidos no outro, respeitando multiplicidade, existem números adicionais que
podem representar evidência numérica ambígua. Na ausência de outro conflito
estrutural explícito, a rejeição NO_MATCH pode ser rebaixada para REVIEW, com reason:

```text
AMBIGUOUS_ADDITIONAL_MODEL_NUMBER
```

A regra não presume tamanho, SKU ou MPN; não remove números do parse; não transforma
automaticamente o par em AUTO_MATCH. Todos os números continuam preservados.
A comparação é simétrica. Ausência completa de números em um dos lados não aciona
essa nova regra. Não se generaliza acréscimo numérico para substituição numérica.

Continuam bloqueados como conflitos reais, quando reconhecidos pelo V1.1:
substituições de números de modelo, gerações diferentes, versões explicitamente
diferentes, marcas diferentes, tipos de produto incompatíveis e qualificadores
estruturais explicitamente incompatíveis, inclusive qualificadores funcionais.
A V1.2 não amplia o vocabulário nem cria uma classificação geral de função.
Por exemplo, Futsal × Society permanece REVIEW no PID-0154; não se afirma que
qualquer diferença funcional seja automaticamente classificada como NO_MATCH.

Os testes preservam NO_MATCH para **V3 × V4**, **Gel Cumulus 27 × Gel Cumulus 28**
e **480 × 1080**, além de substituições com um número compartilhado. Conflitos
explícitos de marca, tipo, versão ou qualificador prevalecem mesmo com números
adicionais. A multiplicidade impede que repetições ocultem substituições.

### Consequência conhecida: PID-0208

PID-0208 possui HUMAN NO e passou de NO_MATCH para REVIEW. É uma **perda deliberada
de rejeição automática**, não um falso AUTO_MATCH. A decisão foi aceita porque
REVIEW não funde produtos automaticamente. Esse caso permanece como teste
adversarial explícito em [identity.test.ts](../identity.test.ts).

## Limitações

- Os 247 pares rotulados não são ground truth completo do catálogo.
- Títulos comerciais podem omitir atributos; ausência de atributo não prova igualdade.
- Igualdade de Mestre não prova igualdade de Variante.
- Igualdade de Variante sem GTIN/MPN forte não necessariamente prova identidade
  física absoluta do SKU. MPN isolado também não comprova Variante no contrato atual.
- As regras dependem da evidência disponível nos feeds; o vocabulário de calçados
  continua evolutivo.
- REVIEW continuará existindo propositalmente; a regra pode aumentar a fila de
  revisão para produtos efetivamente distintos com números adicionais.
- Kilian/Killian, 1080 V14/1080v14, Incolor, All Black, Woven, SE e Reflexivo não
  foram resolvidos genericamente pela V1.2. Nenhuma nova regra foi criada nesta missão.

## Integridade dos artefatos

SHA-256 observados nesta consolidação:

| Arquivo | SHA-256 |
| --- | --- |
| golden-v1.json | `6024db9bbfb06b1975d5bb13fb30e7ae028d7519d49e4e4ac1085717c1fa56a9` |
| labeling-v1.json | `5d269cfd8596cff3d37a56287adc64e142420b6f04f229d880959d919c2c599d` |
| ../parser.ts | `d13e37922e2a243be4640eddc681db2f71858c93c92af56dd8c306a85b501e08` |
| ../matcher.ts | `52bd2c2307496ff149e4c5dbb07bbf0e48d02432cf271e7b8af575cf788b686f` |
| ../identity.test.ts | `df4512d4ad331a4bdbb70b91584c59269bb5ce3158e69025574e9d28cb013500` |

Os hashes dos dois JSONs coincidem com os registrados no diagnóstico anterior,
disponíveis nesta sessão em `/tmp/pid-hashes.json`. Também foram capturados hashes
no início desta missão para comparação ao final. Os JSONs não foram reescritos.
Os hashes acima permitem conferir os artefatos sem depender dos arquivos temporários.

## Reprodução local, sem banco ou servidor

Execute na raiz `/workspaces/beupfree-preview`. O comando abaixo usa somente os
arquivos do repositório, imprime as duas matrizes e todas as transições e verifica
as principais proteções. Não escreve nos datasets.

```bash
node --import tsx --input-type=module <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { parseProductIdentity as parse } from './shared/product-identity/parser.ts';
import { matchProductIdentities as match } from './shared/product-identity/matcher.ts';
const read = name => JSON.parse(fs.readFileSync(
  `shared/product-identity/validation/${name}-v1.json`, 'utf8'));
const golden = read('golden'), labeling = read('labeling');
assert.equal(golden.cases.length, 247);
assert.equal(labeling.cases.length, 247);
assert.equal(new Set(golden.cases.map(c => c.id)).size, 247);
const labels = new Map(labeling.cases.map(c => [c.id, c.humanLabel.sameMaster]));
assert.equal(labels.size, 247);
const baseline = {}, current = {}, human = {}, changes = [];
let protectedAuto = 0, newAuto = 0;
for (const c of golden.cases) {
  const h = labels.get(c.id);
  assert.ok(['YES', 'NO', 'UNSURE'].includes(h));
  human[h] = (human[h] || 0) + 1;
  const a = parse(c.futFanatics.identity.raw), b = parse(c.dafiti.identity.raw);
  assert.deepEqual(a, c.futFanatics.identity);
  assert.deepEqual(b, c.dafiti.identity);
  const before = c.matcherV11.masterDecision, result = match(a, b);
  const after = result.masterDecision;
  for (const [matrix, decision] of [[baseline, before], [current, after]]) {
    matrix[decision] ??= { YES: 0, NO: 0, UNSURE: 0 };
    matrix[decision][h]++;
  }
  if (before === 'AUTO_MATCH') {
    assert.equal(after, 'AUTO_MATCH');
    protectedAuto++;
  }
  if (after === 'AUTO_MATCH') {
    assert.equal(h, 'YES');
    if (before !== 'AUTO_MATCH') newAuto++;
  }
  if (before !== after) {
    assert.equal(before, 'NO_MATCH');
    assert.equal(after, 'REVIEW');
    assert.ok(result.master.reasons.includes('AMBIGUOUS_ADDITIONAL_MODEL_NUMBER'));
    changes.push({ id: c.id, before, after, human: h,
      numbers: [a, b].map(p => p.modelTokens.filter(t => /^\d+$/.test(t))),
      reasons: result.master.reasons });
  }
}
assert.deepEqual(human, { YES: 157, NO: 87, UNSURE: 3 });
assert.deepEqual(baseline, {
  AUTO_MATCH: { YES: 147, NO: 0, UNSURE: 0 },
  REVIEW: { YES: 7, NO: 52, UNSURE: 1 },
  NO_MATCH: { YES: 3, NO: 35, UNSURE: 2 }
});
assert.deepEqual(current, {
  AUTO_MATCH: { YES: 147, NO: 0, UNSURE: 0 },
  REVIEW: { YES: 10, NO: 53, UNSURE: 1 },
  NO_MATCH: { YES: 0, NO: 34, UNSURE: 2 }
});
assert.equal(protectedAuto, 147);
assert.equal(newAuto, 0);
assert.deepEqual(changes.map(c => c.id),
  ['PID-0208', 'PID-0226', 'PID-0230', 'PID-0235']);
console.log(JSON.stringify({ human, baseline, current, changes, protectedAuto, newAuto }, null, 2));
JS
```

Para verificar hashes:

```bash
sha256sum shared/product-identity/validation/golden-v1.json \
  shared/product-identity/validation/labeling-v1.json \
  shared/product-identity/parser.ts shared/product-identity/matcher.ts \
  shared/product-identity/identity.test.ts
```

## Validação técnica desta consolidação

Execuções realizadas em 2026-09-23, sem iniciar servidor ou acessar banco:

| Comando/verificação | Resultado |
| --- | --- |
| `node --import tsx --test --test-isolation=none shared/product-identity/identity.test.ts scripts/product-identity-offline-evaluation.test.ts` | 113 testes passaram; 0 falhas, 0 cancelados, 0 ignorados |
| `npm run check -- --incremental false` | Passou, código de saída 0; sem cache incremental |
| Comando de reprodução acima, extraído deste documento e executado em `/tmp/pid-doc-reproduce.sh` | Passou; confirmou 247 pares, matrizes, quatro transições e 147 AUTO_MATCH preservados |
| Comparação SHA-256 no início/fim da missão | Parser, matcher, testes e ambos os datasets preservados; JSONs também coincidem com hashes anteriores |
| `git diff --check` | Passou; o Markdown não rastreado também foi verificado separadamente com `git diff --no-index --check /dev/null shared/product-identity/validation/VALIDATION-V1.2.md` |

Os resultados acima pertencem a esta consolidação, não substituem o histórico de
execuções da implementação. Não foram executadas a suíte unitária completa,
Playwright, build, auditoria remota ou operações com bind de porta nesta missão.
A documentação do resultado não equivale a autorização para persistência, fusão
operacional ou publicação.

## Estado e escopo da entrega

- Implementação V1.2 preexistente: `../matcher.ts` e `../identity.test.ts`, ambos
  modificados no Git antes desta missão e preservados durante ela.
- Datasets preexistentes, ainda não rastreados no início desta missão:
  `golden-v1.json` e `labeling-v1.json`, preservados integralmente.
- Único arquivo criado nesta missão: `VALIDATION-V1.2.md`.

`git diff --stat` mostra somente as alterações rastreadas da implementação; não
inclui este documento nem os JSONs não rastreados. Use também
`git status --short --untracked-files=all` para inspecionar os três arquivos.

Parser alterado nesta missão: NÃO. Matcher alterado nesta missão: NÃO.
Testes alterados nesta missão: NÃO. Human labels alterados: NÃO.
Golden dataset alterado: NÃO. Banco alterado: NÃO. Migration: NÃO.
Importação: NÃO. Git add: NÃO. Commit: NÃO. Push: NÃO. Merge: NÃO. Deploy: NÃO.

PRODUCT IDENTITY V1.2 DOCUMENTADO E PRONTO PARA CONSOLIDAÇÃO
