# Smart Decision Engine

## Missão

O Smart Decision Engine transforma alternativas normalizadas em resultados ordenados e
explicáveis. Ele é uma fundação reutilizável: não conhece o UpPulse/BeUpFree, interfaces
React, marketplaces, categorias de produto ou mecanismos de persistência.

Produto e plataforma ficam fora deste módulo. Essas camadas são responsáveis por converter
seus dados em `DecisionCandidate` e `DecisionContext`; analisadores independentes expressam
critérios de decisão sem acoplar o núcleo à origem dos dados.

## Fluxo

```text
Decision Engine
    → Criteria
    → Analyzers
    → Criterion Evaluations
    → Aggregation
    → Decision Result
```

`Criterion` identifica uma dimensão de decisão sem incorporar seu peso. Cada analisador
síncrono ou assíncrono declara o critério que atende e produz uma avaliação desse critério
para um candidato. O motor limita pontuações e confianças ao intervalo de 0 a 100, calcula
médias simples por candidato, consolida motivos e alertas e ordena o resultado pela maior
pontuação.

`CriteriaRegistry` oferece um catálogo instanciável de critérios. `CriterionWeight` modela
pesos configuráveis para estratégias futuras, mas nenhum peso participa da agregação atual.

## Regras de dependência

- O motor não depende de React, contextos de UI, rotas ou armazenamento.
- O motor não conhece plataformas, marketplaces nem domínios ou categorias específicos.
- Camadas de produto podem depender da API pública deste módulo; este módulo nunca depende
  delas.
- Consumidores devem importar somente de `decision-engine/index.ts`.

## Fora do escopo atual

Esta fundação não contém regras reais de preço, avaliação, frete ou vendedor, pesos,
recomendações finais, chamadas a serviços externos, cache ou integração com a comparação.

## Exemplo mínimo

```ts
import {
  DecisionEngine,
  type Analyzer,
  type DecisionContext,
} from "@/decision-engine";

const analyzer: Analyzer = {
  id: "example",
  criterionId: "example-criterion",
  analyze: (candidate) => ({
    analyzerId: "example",
    criterionId: "example-criterion",
    candidateId: candidate.id,
    score: 80,
    confidence: 90,
    reasons: ["Exemplo de critério atendido"],
    warnings: [],
  }),
};

const context: DecisionContext = {
  candidates: [{ id: "a", name: "Alternativa A", attributes: {} }],
};

const results = await new DecisionEngine([analyzer]).evaluate(context);
```
