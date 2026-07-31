# Smart Decision Engine — Linguagem Ubíqua

## 1. Propósito

Este documento define a **Linguagem Ubíqua** oficial do domínio **Smart Decision
Engine**. Os termos aqui descritos devem ser usados com o mesmo significado por
produto, engenharia, dados, design, documentação e testes.

O objetivo é impedir que conceitos tecnicamente semelhantes — como pontuação,
confiança e recomendação — sejam tratados como sinônimos. Novos termos de domínio
devem ser incorporados a este documento antes de serem usados como parte estável do
modelo.

Os nomes em inglês são os identificadores canônicos do modelo e do código. As
descrições em português expressam seu significado no negócio.

## 2. Bounded Context

O **Smart Decision Engine** é um **Bounded Context** responsável por avaliar
alternativas normalizadas, agregar avaliações e produzir resultados explicáveis.

Sua fronteira começa quando recebe dados independentes de plataforma e termina
quando entrega resultados de decisão. Coleta de dados, catálogo, marketplace,
interface, persistência, navegação, compra e apresentação visual pertencem a outros
contextos.

Fluxo conceitual:

```text
Dados normalizados
    → Candidate + Decision Context
    → Analyzers
    → Analyzer Results
    → Aggregation
    → Decision Results
    → Recommendation e Explanation (capacidades futuras)
```

O motor não conhece produtos, vendedores, lojas, categorias ou critérios concretos.
Esses significados entram no domínio por meio de dados normalizados e de
implementações de `Analyzer` criadas externamente.

## 3. Glossário oficial

### Decision

Processo de avaliar um conjunto de alternativas dentro de um contexto para produzir
resultados comparáveis. Uma `Decision` não é uma compra, ação automática ou escolha
irrevogável.

### Candidate

Alternativa elegível para avaliação. Um `Candidate` possui identidade estável, nome
legível e atributos normalizados. Ele não representa necessariamente um produto:
pode representar qualquer alternativa compatível com o contexto da decisão.

Um candidato é a unidade sobre a qual os analisadores operam. A mesma entidade
externa pode originar candidatos diferentes em decisões diferentes, desde que a
normalização ou o contexto sejam distintos.

**Não usar como sinônimo de:** oferta, produto, resultado ou recomendação.

### Candidate ID

Identificador estável de um `Candidate` dentro de uma decisão. É usado para
correlacionar o candidato, os resultados dos analisadores e o resultado agregado.
Não carrega significado de ranking.

### Attribute

Dado normalizado que descreve um `Candidate` e pode participar de uma análise. Seu
significado é definido pelo produtor dos dados e pelo analisador consumidor, não
pelo núcleo do motor.

Um atributo deve representar informação da alternativa. Informação operacional ou
de rastreabilidade que não participa da decisão deve ser tratada como `Metadata`.

### Metadata

Informação auxiliar para rastreabilidade, observabilidade, auditoria ou extensão.
`Metadata` não deve alterar implicitamente o significado de um resultado. Quando um
dado influencia uma análise, essa dependência deve ser explícita no contrato do
analisador.

### Decision Context

Conjunto completo de informações disponíveis para uma execução da decisão. Contém
os candidatos e pode conter preferências e condições ambientais.

O `Decision Context` define o universo daquela execução. Ele é imutável do ponto de
vista conceitual: analisadores podem consultá-lo, mas não devem modificá-lo.

**Não usar como sinônimo de:** estado React, contexto de interface, sessão ou
configuração global.

### Preference

Expressão normalizada de objetivos, prioridades, restrições ou tolerâncias do ator
para quem a decisão está sendo produzida. Uma preferência só influencia o resultado
quando uma estratégia ou um analisador declara como interpretá-la.

Preferência não é evidência sobre um candidato.

### Environment

Condição externa relevante para uma decisão específica, como tempo, localidade,
canal ou capacidade disponível. O ambiente descreve a situação da decisão, e não a
alternativa.

### Analyzer

Componente independente que avalia um `Candidate` sob um `Decision Context` e
produz um `Analyzer Result`. Cada analisador representa um critério ou uma dimensão
coerente de avaliação.

Um analisador:

- possui identidade estável;
- pode operar de forma síncrona ou assíncrona;
- não ordena o conjunto final;
- não produz sozinho uma recomendação global;
- deve explicar a contribuição que produz;
- não deve modificar o candidato nem o contexto recebidos.

### Analyzer ID

Identificador estável do tipo lógico de análise. Deve permanecer igual entre
execuções equivalentes e ser suficiente para atribuir um `Analyzer Result` ao seu
produtor. Não deve ser gerado aleatoriamente por execução.

### Analyzer Result

Avaliação produzida por um `Analyzer` para exatamente um `Candidate`. Contém
`Score`, `Confidence`, `Reasons`, `Warnings` e, opcionalmente, metadados.

É uma contribuição para a decisão, não o resultado final. Resultados de analisadores
diferentes só se tornam comparáveis no processo de `Aggregation` definido pela
estratégia vigente.

### Score

Medida normalizada de quão favorável é um candidato segundo um analisador ou uma
agregação. A escala oficial é de **0 a 100**, inclusive:

- `0`: contribuição ou resultado minimamente favorável;
- `100`: contribuição ou resultado maximamente favorável.

Um score não é porcentagem de certeza, probabilidade, nota de avaliação externa ou
posição no ranking. Valores maiores são sempre mais favoráveis dentro da semântica
declarada.

Valores ausentes, não numéricos ou infinitos não são scores válidos. A política de
normalização deve impedir sua propagação.

### Confidence

Medida normalizada da confiabilidade que o motor atribui ao `Score`, considerando a
qualidade, suficiência e consistência das evidências usadas. A escala oficial é de
**0 a 100**, inclusive:

- `0`: não há confiança utilizável na pontuação;
- `100`: confiança máxima segundo o método declarado.

`Confidence` não aumenta nem reduz automaticamente o `Score`. Qualquer interação
entre ambos deve ser definida explicitamente por uma `Strategy`.

**Não usar como sinônimo de:** score, probabilidade de escolha correta ou qualidade
do candidato.

### Reason

Afirmação explicativa que sustenta uma avaliação favorável, desfavorável ou neutra.
Uma `Reason` responde “por que esta avaliação foi produzida?” e deve ser compreensível
fora da implementação interna do analisador.

Reasons são fatos interpretados ou conclusões justificadas. Não devem ser usadas
para comunicar falhas operacionais ou riscos que exigem atenção; esses casos são
`Warnings`.

### Warning

Alerta sobre limitação, risco, inconsistência, ausência de dados ou condição que
deve acompanhar a interpretação do resultado. Um warning não invalida
necessariamente o resultado e não é, por si só, uma penalidade de score.

Se um warning afetar score ou confiança, essa relação deve ser aplicada e explicada
pelo analisador ou pela estratégia responsável.

### Evidence

Dado observável, derivado ou fornecido que sustenta uma análise, uma razão ou um
warning. Evidência é a base verificável de uma conclusão; `Reason` é a interpretação
explicativa dessa base.

Uma evidência deve, quando aplicável, registrar origem, atualidade e qualidade. A
existência do conceito não obriga o núcleo a armazenar evidências nesta fase.

**Exemplo da distinção:** “prazo informado: dois dias” é evidência; “atende à
preferência de entrega rápida” é razão.

### Weight

Valor que representa a influência relativa de um analisador, critério ou dimensão
na agregação. Pesos pertencem à política de decisão, não ao significado intrínseco
do candidato.

Um peso não é score nem confiança. Sua escala, valor padrão, regras de normalização
e tratamento de peso zero devem ser definidos pela `Aggregation Strategy` que o
utiliza.

Pesos são um conceito previsto para evolução; a agregação inicial por média simples
equivale conceitualmente a dar influência igual a todos os resultados.

### Strategy

Política explícita e substituível que define como uma etapa da decisão é executada.
Uma estratégia pode definir seleção de analisadores, normalização, pesos, agregação,
desempate ou formação de recomendação.

Estratégias coordenam regras; elas não representam dados de candidato. Toda
estratégia deve ser determinística para as mesmas entradas, salvo quando sua
dependência externa estiver declarada.

### Aggregation

Processo de consolidar múltiplos `Analyzer Results` do mesmo candidato em um único
`Decision Result`. A agregação combina scores e confianças segundo uma
`Aggregation Strategy` e preserva as explicações relevantes.

Na fundação atual, a política conceitual é média aritmética simples de scores e de
confianças. A agregação não cria evidências e não deve ocultar warnings.

### Aggregation Strategy

Tipo de `Strategy` que define a fórmula e as regras usadas pela `Aggregation`,
incluindo normalização, pesos, dados ausentes e comportamento quando não há
analisadores.

Alterar a estratégia pode alterar o ranking sem alterar nenhum candidato ou
analisador. Por isso, sua identidade e versão devem ser auditáveis quando essa
capacidade for implementada.

### Decision Result

Resultado agregado e explicável de exatamente um `Candidate`. Contém score e
confiança consolidados, resultados dos analisadores, reasons e warnings.

O `Decision Result` mede o candidato no contexto da execução. Ele não é uma
recomendação e não deve ser tratado como verdade permanente sobre a alternativa.

### Ranking

Ordenação dos `Decision Results` segundo uma regra explícita, normalmente do maior
para o menor score. Ranking é uma relação entre resultados da mesma decisão.

Posição no ranking não substitui score, confiança ou explicação. Empates devem ser
tratados por uma política determinística e documentada.

### Recommendation

Orientação derivada de um ou mais `Decision Results`, levando em conta estratégia,
restrições e confiança mínima. Pode indicar um candidato, um conjunto de candidatos
ou a decisão de não recomendar nenhuma alternativa.

A primeira posição do ranking não é automaticamente uma recomendação. Uma
recomendação exige política explícita e deve poder ser explicada. Esta capacidade
não faz parte da fundação atual.

### Explanation

Representação coerente e orientada ao consumidor de como e por que um resultado ou
uma recomendação foi produzido. Pode organizar reasons, warnings, evidências,
contribuições e política aplicada.

`Explanation` não é mera concatenação de textos. Ela deve preservar a origem das
contribuições, evitar contradições enganosas e permitir rastrear a conclusão até as
análises que a sustentam. Uma camada dedicada de explicação é capacidade futura.

### Constraint

Condição que limita a elegibilidade de candidatos ou a possibilidade de recomendar
um resultado. Restrições devem ser explícitas e não devem ser simuladas apenas por
scores muito baixos quando seu significado for eliminatório.

### Eligibility

Estado que indica se um candidato pode participar de determinada decisão ou
recomendação após aplicação das restrições. Elegibilidade é distinta de qualidade:
um candidato elegível pode ter score baixo, e um candidato forte pode ser
inelegível.

### Normalization

Transformação de dados externos ou métricas em formatos e escalas compreendidos
pelo domínio. Há duas operações distintas:

1. **normalização de entrada:** transforma dados de outros contextos em candidatos,
   preferências, ambiente ou evidências;
2. **normalização de métrica:** garante que score e confiança respeitem a escala de
   0 a 100 e não contenham valores inválidos.

Normalização não deve introduzir silenciosamente regras de recomendação.

### Decision Execution

Uma avaliação completa de um `Decision Context` por uma configuração específica do
motor. Resultados de execuções distintas não devem ser misturados sem declarar as
diferenças de contexto, dados, analisadores e estratégias.

### Engine Configuration

Conjunto de analisadores e, futuramente, estratégias e parâmetros usados em uma
execução. Configuração não é contexto: o contexto descreve a decisão; a configuração
descreve como o motor irá processá-la.

## 4. Relações entre os conceitos

- Uma `Decision Execution` recebe um `Decision Context`.
- Um `Decision Context` contém um ou mais `Candidates`.
- Cada `Analyzer` avalia cada candidato aplicável dentro desse contexto.
- Cada avaliação produz um `Analyzer Result` associado a um único candidato e a um
  único analisador.
- Um `Analyzer Result` contém um `Score`, uma `Confidence`, zero ou mais `Reasons` e
  zero ou mais `Warnings`.
- A `Aggregation` consolida os resultados de um candidato em um `Decision Result`.
- O `Ranking` ordena os resultados da mesma execução.
- Uma futura `Recommendation Strategy` poderá transformar resultados em uma
  `Recommendation`.
- Uma futura camada de `Explanation` poderá organizar razões, alertas e evidências
  para comunicar a decisão.

## 5. Distinções obrigatórias

| Conceitos | Distinção oficial |
|---|---|
| Candidate × Decision Result | O primeiro é entrada; o segundo é avaliação agregada. |
| Score × Confidence | Score mede favorabilidade; confidence mede confiabilidade do score. |
| Reason × Evidence | Reason interpreta; evidence sustenta e pode ser rastreada. |
| Reason × Warning | Reason explica a avaliação; warning alerta sobre sua interpretação. |
| Weight × Score | Weight controla influência relativa; score expressa avaliação. |
| Ranking × Recommendation | Ranking ordena; recommendation orienta segundo uma política. |
| Decision Context × Engine Configuration | Contexto descreve o problema; configuração descreve o processamento. |
| Attribute × Metadata | Attribute descreve e pode ser analisado; metadata auxilia rastreabilidade. |
| Aggregation × Explanation | Aggregation calcula e consolida; explanation comunica e organiza justificativas. |
| Constraint × Score | Constraint limita elegibilidade; score mede favorabilidade. |

## 6. Invariantes do domínio

1. Todo `Analyzer Result` deve identificar seu analisador e seu candidato.
2. Todo `Decision Result` deve identificar exatamente um candidato.
3. `Score` e `Confidence` válidos estão sempre entre 0 e 100, inclusive.
4. `NaN`, `Infinity` e `-Infinity` nunca são métricas válidas do domínio.
5. O núcleo não atribui significado específico de plataforma ou categoria aos
   atributos.
6. Uma execução não modifica seus candidatos nem seu contexto.
7. Agregação sem analisadores produz resultado neutro conforme a política vigente;
   na fundação atual, score e confiança são zero.
8. Warnings relevantes não devem desaparecer durante a agregação.
9. Ranking só compara resultados pertencentes ao mesmo universo de decisão.
10. Nenhuma recomendação deve ser inferida apenas da primeira posição sem uma
    estratégia de recomendação explícita.

## 7. Vocabulário de operações

Use os seguintes verbos de maneira consistente:

- **normalize:** converter ou sanear dados para um contrato ou escala do domínio;
- **analyze:** produzir a contribuição de um analisador para um candidato;
- **aggregate:** consolidar contribuições do mesmo candidato;
- **evaluate:** executar a avaliação de candidatos dentro de um contexto;
- **rank:** ordenar resultados comparáveis;
- **recommend:** produzir orientação por meio de política explícita;
- **explain:** apresentar a cadeia justificável de uma avaliação ou recomendação.

Evite usar **recommend** quando a operação apenas calcula scores ou ordena
resultados. Evite usar **confidence** para representar avaliação positiva.

## 8. Termos externos que não pertencem ao núcleo

Os termos abaixo podem existir em contextos consumidores, mas não integram a
linguagem interna do núcleo do Smart Decision Engine:

- produto, tênis, categoria e marca;
- oferta, preço, frete e vendedor;
- marketplace ou nomes de marketplaces;
- componente React, página, rota ou contexto de UI;
- localStorage, banco de dados ou API específica.

Adaptadores e analisadores externos podem traduzir esses conceitos para a linguagem
definida aqui. O núcleo nunca deve depender da tradução inversa.

## 9. Estado de implementação

A existência de um termo nesta linguagem não significa que sua capacidade já esteja
implementada. A fundação atual contempla candidatos, contexto, analisadores,
resultados, scores, confiança, reasons, warnings, agregação simples e ranking.

Evidence estruturada, weights configuráveis, constraints, strategies substituíveis,
recommendation e explanation dedicada são conceitos oficiais previstos para a
evolução do domínio, mas permanecem fora do escopo da fundação inicial.

## 10. Governança da linguagem

- Código, testes, ADRs, documentação e conversas de produto devem respeitar estas
  definições.
- Um novo conceito deve ter nome canônico, definição, fronteira e distinção em
  relação aos termos existentes.
- Mudanças semânticas devem atualizar este documento antes ou junto da mudança de
  arquitetura correspondente.
- Traduções podem ser usadas na interface, mas não devem alterar o significado do
  termo canônico.
- Termos ambíguos devem ser substituídos pelo conceito mais específico deste
  glossário.
