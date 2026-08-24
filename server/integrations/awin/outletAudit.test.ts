import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildOutletAudit, canonicalizeMerchantUrl, classifyOutletPromotion, comparePrices, matchOutletItem, parseLauriOutletHtml, type AwinAuditProduct } from "./outletAudit";

const fixture = readFileSync(new URL("./fixtures/outlet.html", import.meta.url), "utf8");
const items = parseLauriOutletHtml(fixture, "2026-08-22T00:00:00.000Z");
const awin = (overrides: Partial<AwinAuditProduct> = {}): AwinAuditProduct => ({ id: "p-1", key: "safe-key", name: "Tênis Exemplo Promo", brand: "Marca A", merchantUrl: "https://lauriesporte.com.br/tenis-exemplo-promo/p?awc=secret", merchantProductIds: ["SKU-41"], gtins: ["7894900011517"], variants: [{ id: "v-1", merchantProductId: "SKU-41", gtin: "7894900011517" }, { id: "v-2", merchantProductId: "SKU-42", gtin: null }], offers: [{ id: "o-1", currentPrice: 719, capturedAt: "2026-08-21T00:00:00Z", variantId: "v-1" }, { id: "o-2", currentPrice: 720, capturedAt: "2026-08-21T00:00:00Z", variantId: "v-2" }], ...overrides });

test("extrai preço anterior/atual e mantém Pix separado", () => {
  assert.equal(items.length, 3); assert.equal(items[0].oldPrice, 1049); assert.equal(items[0].currentPrice, 719); assert.equal(items[0].pixPrice, 647.1);
  assert.equal(items[0].outletEvidence.status, "PROMOTION_CONFIRMED"); assert.equal(items[0].outletEvidence.discountPercentCalculated, 31.46);
});

test("Outlet sem preço anterior é incerto e preços iguais não são promocionais", () => {
  assert.equal(items[1].outletEvidence.status, "PROMOTION_UNCERTAIN"); assert.equal(items[2].outletEvidence.status, "NOT_PROMOTIONAL");
  assert.equal(classifyOutletPromotion(null, 10).status, "PROMOTION_UNCERTAIN");
});

test("sanitiza URL e prioriza match URL", () => {
  assert.equal(canonicalizeMerchantUrl("http://WWW.lauriesporte.com.br/x/?awc=secret#x"), "https://lauriesporte.com.br/x");
  assert.equal(matchOutletItem(items[0], [awin()]).method, "MATCH_URL");
});

test("faz match por merchant ID e GTIN quando observáveis", () => {
  assert.equal(matchOutletItem(items[0], [awin({ merchantUrl: "https://lauriesporte.com.br/outro/p" })]).method, "MATCH_MERCHANT_ID");
  const withGtin = { ...items[0], merchantProductId: null, merchantSkuIds: [], gtins: ["7894900011517"] };
  assert.equal(matchOutletItem(withGtin, [awin({ merchantUrl: null, merchantProductIds: [] })]).method, "MATCH_GTIN");
});

test("nome é apenas candidato de revisão; produto desconhecido não casa", () => {
  const nameOnly = { ...items[0], canonicalUrl: "https://lauriesporte.com.br/nao-casa", merchantProductId: null, merchantSkuIds: [], gtins: [] };
  assert.equal(matchOutletItem(nameOnly, [awin({ merchantUrl: null, merchantProductIds: [], gtins: [] })]).method, "MATCH_REVIEW_REQUIRED");
  assert.equal(matchOutletItem({ ...nameOnly, productName: "Sem relação" }, [awin()]).method, "NO_MATCH");
});

test("classifica divergência com tolerância monetária de cinco centavos", () => {
  assert.equal(comparePrices(719, 719).status, "PRICE_MATCH"); assert.equal(comparePrices(719.04, 719).status, "PRICE_DIFFERENCE_MINOR");
  assert.equal(comparePrices(720, 719).status, "PRICE_DIFFERENCE_MATERIAL"); assert.equal(comparePrices(null, 719).status, "PRICE_NOT_COMPARABLE");
});

test("relatório preserva multivariante e produto fora do Outlet", () => {
  const report = buildOutletAudit(items, [awin(), awin({ id: "p-outside", key: "outside", name: "Produto fora", merchantUrl: null, merchantProductIds: [], gtins: [], variants: [], offers: [] })]);
  assert.equal(report.matching.matchedToAwin, 1); assert.equal(report.matching.awinProductsNotInOutlet, 1);
  assert.equal(report.publicationReadiness.variants, 2); assert.equal(report.publicationReadiness.offers, 2);
  assert.equal(report.multivariant.differentPricesAcrossVariants, 1);
});
