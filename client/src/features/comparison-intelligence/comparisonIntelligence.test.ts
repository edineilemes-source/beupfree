import assert from "node:assert/strict";
import test from "node:test";
import type { ComparableProduct } from "@/types/comparison";
import { analyzeComparison } from "./comparisonIntelligence";
import { scoreProducts } from "./comparisonScoring";

function product(
  id: string,
  values: { price?: number; discount?: number; rating?: number; reviews?: number; shipping?: boolean } = {},
): ComparableProduct {
  return {
    product: { id, title: id, attributes: {}, rating: values.rating, reviewCount: values.reviews },
    selectedOffer: {
      availability: "available",
      currentPrice: values.price,
      discountPercent: values.discount,
      freeShipping: values.shipping,
    },
    selectedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("calcula a Nota UpPulse V1 exata para dois produtos", () => {
  const [a, b] = scoreProducts([
    product("a", { price: 100, discount: 20, rating: 4, reviews: 99, shipping: true }),
    product("b", { price: 200, discount: 40, rating: 5, reviews: 999, shipping: false }),
  ]);

  // A = (1*0,30 + 0,2*0,25 + 0,8*0,25 + log(100)/log(1000)*0,10 + 1*0,10)*10
  assert.ok(Math.abs(a.score - 7.166666666666667) < 1e-12);
  // B = (0 + 0,4*0,25 + 1*0,25 + 1*0,10 + 0)*10
  assert.equal(b.score, 4.5);
});

test("compara três produtos e preserva a ordem de entrada", () => {
  const result = analyzeComparison([
    product("a", { price: 100, discount: 10, rating: 4, reviews: 10, shipping: true }),
    product("b", { price: 110, discount: 20, rating: 4.5, reviews: 20, shipping: true }),
    product("c", { price: 120, discount: 30, rating: 5, reviews: 30, shipping: false }),
  ]);
  assert.deepEqual(result.products.map(({ product: item }) => item.id), ["a", "b", "c"]);
  assert.deepEqual(result.products.map(({ label }) => label), ["Produto A", "Produto B", "Produto C"]);
});

test("normaliza preço relativamente e dá vantagem ao menor preço", () => {
  const [a, b, c] = scoreProducts([product("a", { price: 100 }), product("b", { price: 150 }), product("c", { price: 200 })]);
  assert.deepEqual([a.criteria.price.normalized, b.criteria.price.normalized, c.criteria.price.normalized], [1, 0.5, 0]);
});

test("normaliza desconto, avaliação, avaliações e frete", () => {
  const [a, b] = scoreProducts([
    product("a", { price: 100, discount: 25, rating: 4, reviews: 9, shipping: true }),
    product("b", { price: 200, discount: 50, rating: 5, reviews: 99, shipping: false }),
  ]);
  assert.equal(a.criteria.discount.normalized, 0.25);
  assert.equal(a.criteria.rating.normalized, 0.8);
  assert.equal(a.criteria.reviews.normalized, 0.5);
  assert.equal(a.criteria.shipping.normalized, 1);
  assert.equal(b.criteria.shipping.normalized, 0);
});

test("usa a mesma base de critérios comparáveis para todos os produtos", () => {
  const [complete, partial] = scoreProducts([
    product("complete", { price: 100, discount: 20, rating: 5, reviews: 10, shipping: true }),
    product("partial", { price: 200, rating: 4 }),
  ]);
  assert.equal(partial.criteria.discount.normalized, null);
  assert.equal(partial.criteria.shipping.normalized, null);
  assert.equal(partial.criteria.reviews.normalized, null);
  assert.equal(complete.criteria.discount.effectiveWeight, 0);
  assert.equal(complete.criteria.reviews.effectiveWeight, 0);
  assert.equal(complete.criteria.shipping.effectiveWeight, 0);
  assert.equal(partial.criteria.price.effectiveWeight, 0.3 / 0.55);
  assert.equal(partial.criteria.rating.effectiveWeight, 0.25 / 0.55);
  assert.equal(complete.criteria.price.effectiveWeight, partial.criteria.price.effectiveWeight);
  assert.equal(complete.criteria.rating.effectiveWeight, partial.criteria.rating.effectiveWeight);
});

test("não produz NaN ou Infinity mesmo sem nenhum dado válido", () => {
  const [empty] = scoreProducts([product("empty")]);
  assert.equal(empty.score, 0);
  for (const criterion of Object.values(empty.criteria)) {
    assert.ok(Number.isFinite(criterion.effectiveWeight));
    assert.ok(Number.isFinite(criterion.contribution));
  }
});

test("declara empate técnico dentro da tolerância sem escolher vencedor", () => {
  const result = analyzeComparison([
    product("a", { price: 100, discount: 20, rating: 4.5, reviews: 100, shipping: true }),
    product("b", { price: 100, discount: 20, rating: 4.5, reviews: 100, shipping: true }),
  ]);
  assert.equal(result.isScoreTie, true);
  assert.equal(result.winner, null);
  assert.deepEqual(result.scoreLeaders.map(({ product: item }) => item.id), ["a", "b"]);
});

test("aplica a tolerância de empate à nota interna antes do arredondamento", () => {
  const tied = analyzeComparison([
    product("a", { price: 100, discount: 22 }),
    product("b", { price: 100, discount: 20 }),
  ]);
  assert.ok(Math.abs(tied.products[0].score - tied.products[1].score) <= 0.1);
  assert.equal(tied.isScoreTie, true);

  const notTied = analyzeComparison([
    product("a", { price: 100, discount: 22.42 }),
    product("b", { price: 100, discount: 20 }),
  ]);
  assert.ok(Math.abs(
    Number(notTied.products[0].score.toFixed(1)) - Number(notTied.products[1].score.toFixed(1)),
  ) <= 0.1);
  assert.ok(Math.abs(notTied.products[0].score - notTied.products[1].score) > 0.1);
  assert.equal(notTied.isScoreTie, false);
  assert.equal(notTied.winner?.product.id, "a");
});

test("mantém líderes por critério empatados explicitamente", () => {
  const result = analyzeComparison([product("a", { price: 100 }), product("b", { price: 100 })]);
  assert.equal(result.cheapest.tied, true);
  assert.deepEqual(result.cheapest.products.map(({ product: item }) => item.id), ["a", "b"]);
});

test("explicações são determinísticas", () => {
  const items = [
    product("a", { price: 100, discount: 10, rating: 4, reviews: 10, shipping: false }),
    product("b", { price: 110, discount: 30, rating: 5, reviews: 100, shipping: true }),
  ];
  assert.deepEqual(analyzeComparison(items), analyzeComparison(items));
});

test("Vale pagar retorna SIM para diferença conservadora e três vantagens", () => {
  const result = analyzeComparison([
    product("a", { price: 300, discount: 0, rating: 3, reviews: 1, shipping: false }),
    product("b", { price: 340, discount: 100, rating: 5, reviews: 1000, shipping: true }),
  ]);
  assert.equal(result.winner?.product.id, "b");
  assert.equal(result.worthPaying.verdict, "YES");
  assert.equal(result.worthPaying.absoluteDifference, 40);
  assert.ok(Math.abs((result.worthPaying.percentageDifference ?? 0) - 13.3333) < 0.001);
});

test("Vale pagar retorna NÃO quando o vencedor já é o mais barato", () => {
  const result = analyzeComparison([
    product("a", { price: 100, discount: 50, rating: 5, reviews: 1000, shipping: true }),
    product("b", { price: 200, discount: 0, rating: 1, reviews: 1, shipping: false }),
  ]);
  assert.equal(result.worthPaying.verdict, "NO");
  assert.equal(result.worthPaying.absoluteDifference, 0);
});

test("Vale pagar retorna DEPENDE com dados insuficientes ou prêmio intermediário", () => {
  const insufficient = analyzeComparison([product("a", { price: 100 }), product("b", { price: 100 })]);
  assert.equal(insufficient.worthPaying.verdict, "DEPENDS");

  const intermediate = analyzeComparison([
    product("a", { price: 100, discount: 0, rating: 3, reviews: 1, shipping: false }),
    product("b", { price: 120, discount: 100, rating: 5, reviews: 1000, shipping: true }),
  ]);
  assert.equal(intermediate.worthPaying.verdict, "DEPENDS");
});
