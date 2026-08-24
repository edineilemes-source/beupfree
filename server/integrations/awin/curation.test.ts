import assert from "node:assert/strict";
import test from "node:test";
import { AWIN_CURATION_HTTP_ENABLED, classifyPromotion, filterCurationProducts, type CurationProduct } from "./curation";

test("classificação promocional exige evidência estruturada objetiva", () => {
  assert.deepEqual(classifyPromotion({ currentPrice: 80, oldPrice: 100 }), { status: "PROMOTION_CONFIRMED", evidence: "current_price_below_regular_price", regularPrice: 100, percent: 20 });
  assert.equal(classifyPromotion({ currentPrice: 100, saving: 10 }).status, "PROMOTION_CONFIRMED");
  assert.equal(classifyPromotion({ currentPrice: 100, savingsPercent: 5 }).status, "PROMOTION_CONFIRMED");
  assert.equal(classifyPromotion({ currentPrice: 100 }).status, "PROMOTION_UNCERTAIN");
  assert.equal(classifyPromotion({ currentPrice: 100, oldPrice: 90 }).status, "NOT_PROMOTIONAL");
});

const product = (overrides: Partial<CurationProduct> = {}): CurationProduct => ({
  id: "p1", name: "Tênis Azul", brand: "Marca", description: "Descrição", merchant: "Lauri Esporte", provider: "awin", feed: "109288", publicationState: "staging", active: false, images: ["https://img.test/a"],
  variants: [{ gtin: "4006381333931", size: "40" }, { gtin: "7894900011517", size: "41" }],
  offers: [{ currentPrice: 99, inStock: true, isForSale: true }], ...overrides,
});

test("filtros privados combinam merchant, busca, faixa, descrição, GTIN, variantes, estoque e estado", () => {
  const catalog = [product(), product({ id: "p2", name: "Outro", brand: null, description: null, variants: [{ gtin: null }], offers: [{ currentPrice: 200, inStock: false, isForSale: false }] })];
  assert.equal(filterCurationProducts(catalog, { merchant: "Lauri Esporte", search: "azul", minPrice: 90, maxPrice: 100, hasDescription: true, hasValidGtin: true, minVariants: 2, available: true, publicationState: "staging" }).length, 1);
  assert.equal(filterCurationProducts(catalog, { hasDescription: false, hasValidGtin: false, available: false }).length, 1);
});

test("preview HTTP permanece desabilitado sem papel administrativo seguro", () => {
  assert.equal(AWIN_CURATION_HTTP_ENABLED, false);
});
