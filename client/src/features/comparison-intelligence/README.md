# Nota UpPulse V1

A nota usa cinco critérios, em escala normalizada de `0` a `1`: preço relativo
30%, desconto 25%, avaliação 25%, quantidade de avaliações 10% e frete grátis
10%. O resultado ponderado é multiplicado por 10 e mantido internamente com
precisão completa; o arredondamento para uma casa ocorre somente na apresentação.

- Preço: `(maior preço válido - preço) / (maior - menor)`. Preços iguais recebem
  `1`. É inválido quando há menos de dois preços válidos.
- Desconto: percentual limitado a `0..100`, dividido por 100.
- Avaliação: valor limitado a `0..5`, dividido por 5.
- Avaliações: `log1p(quantidade) / log1p(maior quantidade válida)`. Quantidades
  iguais a zero em todo o conjunto recebem `1`. É inválido com menos de dois
  valores válidos.
- Frete: `1` quando grátis e `0` quando explicitamente não grátis.

Valores desconhecidos são `null`, nunca zero. Uma comparação usa uma única base
comum: um critério só participa da Nota UpPulse quando possui dados suficientes
para ser aplicado a todos os produtos comparados. Se faltar o dado de um candidato,
o critério inteiro é excluído das notas de todos, embora os dados individuais
continuem disponíveis para apresentação. Os pesos dos critérios comuns são
divididos pela mesma soma para todos os produtos, preservando uma nota de 0 a 10
sem dar vantagem matemática à ausência de informação.

Há empate técnico quando a diferença entre as notas internas dos líderes é menor
ou igual a `0,10` ponto, antes de qualquer arredondamento de apresentação.

## Vale pagar a diferença

A análise compara o vencedor único ao produto de menor preço único. Sem vencedor,
preço ou pelo menos dois outros critérios comparáveis, o resultado é `DEPENDE`.
É `NÃO` quando não existe diferença a pagar. É `SIM` somente se a vantagem de
nota for ao menos 0,5, não houver desvantagem conhecida e ocorrer um destes casos:

- até R$ 50 e 15%, com vantagem em pelo menos três critérios; ou
- até R$ 100 e 10%, com vantagem em pelo menos dois critérios.

É `NÃO` para diferença acima de R$ 200 ou 30% quando existe no máximo uma
vantagem. Os demais casos são `DEPENDE`.
