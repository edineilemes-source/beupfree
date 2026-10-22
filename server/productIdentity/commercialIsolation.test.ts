import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogSearchProjection, type ProjectionSourceRow } from "../catalogSearchProjection/builder";
import { createOperationalPublicCatalogHandlers } from "../publicCatalog/operational";
import type { CatalogSearchProjectionRepository } from "../catalogSearchProjection/repository";
import { runReconciledShadow } from "./shadow";
import { shadowFixture, fixtureRow } from "./fixtures";

const now = "2026-09-29T00:00:00Z";
const identityRows = [...shadowFixture(), fixtureRow("no-promotion", "Tênis Acme Comet V2 Preto", "merchant-b")];
const commercialRows: ProjectionSourceRow[] = identityRows.map((r, i) => ({
  productId: r.product.id, providerId: r.provider.id, merchantId: r.merchant.id,
  productName: r.product.mainName, brandRaw: r.brand?.name ?? "Observed commercial brand",
  audienceRaw: null, catalogState: "CATALOG_ELIGIBLE", universe: "SNEAKER_CONFIRMED",
  style: "PERFORMANCE", activities: ["RUNNING"], classifierVersion: "tax-v1",
  variantId: `variant-${i}`, sizeNormalized: 40, sizeStatus: "NORMALIZED_SAFE",
  colorNormalized: ["preto"], colorStatus: "NORMALIZED_SAFE", normalizerVersion: "norm-v1",
  offerId: `offer-${i}`, currentPrice: 100 + i, previousPrice: 200 + 2 * i,
  discountPercent: 50, currency: "BRL", inStock: true,
  promotionStatus: i === identityRows.length - 1 ? "NOT_CONFIRMED" : "PROMOTION_CONFIRMED",
  primaryImageUrl: "https://images.example.test/item", feedId: r.feed!.id, sourceUpdatedAt: now,
}));
// Same product with a second, less attractive offer verifies representative choice as well.
commercialRows.push({ ...commercialRows[0], offerId: "less-discount", discountPercent: 10, currentPrice: 180 });
function response() {
  return { body: undefined as any, headers: {} as Record<string, string>, redirectUrl: "", statusCode: 200,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    redirect(url: string) { this.redirectUrl = url; return this; },
  };
}
async function publicOutput() {
  const projection = buildCatalogSearchProjection(commercialRows, now);
  const rows = projection.rows.map(r => ({
    product_id: r.productId, provider_id: r.providerId, merchant_id: r.merchantId,
    product_name: r.productName, representative_offer_id: r.representativeOfferId,
    current_price: r.currentPrice, previous_price: r.previousPrice, discount_percent: r.discountPercent,
    affiliate_url: `https://offers.example.test/${r.representativeOfferId}`, available: r.available,
    brand_raw: r.brandRaw, brand_normalized: r.brandNormalized, universe: r.universe,
    normalized_colors: r.normalizedColors, source_updated_at: r.sourceUpdatedAt,
    primary_image_url: r.primaryImageUrl, merchant_name: r.merchantId,
  }));
  const requests: unknown[] = [];
  const repository: CatalogSearchProjectionRepository = {
    async listProducts(filters) { requests.push(structuredClone(filters)); return rows.slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize); },
    async countProducts(filters) { requests.push(structuredClone(filters)); return rows.length; },
    async getFacets(filters) { requests.push(structuredClone(filters)); return { brands: [{ value: "Acme", count: rows.filter(r => r.brand_raw === "Acme").length }], priceMin: 100, priceMax: 112 }; },
    async getProduct(id) { return rows.filter(r => r.product_id === id); },
    async getOffer(id) { return rows.find(r => r.representative_offer_id === id) ?? null; },
  };
  const handlers = createOperationalPublicCatalogHandlers(() => repository);
  const pages = [];
  for (const offset of [0, 4, 8]) {
    const res = response();
    await handlers.list({ query: { limit: "4", offset: String(offset), sort: "discount-desc" } } as any, res as any, () => assert.fail());
    pages.push(res.body);
  }
  const detail = response(), click = response();
  await handlers.detail({ params: { id: "product-a" } } as any, detail as any, () => assert.fail());
  await handlers.click({ params: { offerId: "offer-0" } } as any, click as any, () => assert.fail());
  return { projection, pages, detail: detail.body, redirect: click.redirectUrl, requests };
}

test("Identity OFF = SHADOW ON for full commercial projection, public pages, counts, facets and URLs", async () => {
  const variables = ["UPPULSE_PUBLIC_CATALOG_SOURCE", "UPPULSE_PUBLIC_CATALOG_APPROVED", "AWIN_CURATOR_DATABASE_URL"];
  const original = variables.map(k => process.env[k]);
  process.env.UPPULSE_PUBLIC_CATALOG_SOURCE = "operational";
  process.env.UPPULSE_PUBLIC_CATALOG_APPROVED = "true";
  process.env.AWIN_CURATOR_DATABASE_URL = "unused-test-config"; // injected repository; no connection
  try {
    const before = structuredClone(commercialRows);
    const off = await publicOutput();
    const shadow = runReconciledShadow(identityRows);
    assert.equal(shadow.status, "COMPLETE");
    if (shadow.status !== "COMPLETE") assert.fail();
    assert.ok(shadow.logical.pairs.some(p => p.result.masterDecision === "AUTO_MATCH"));
    assert.ok(shadow.logical.pairs.some(p => p.result.masterDecision === "REVIEW"));
    assert.ok(shadow.logical.pairs.some(p => p.result.masterDecision === "NO_MATCH"));
    assert.ok(shadow.logical.withoutCandidate.length > 0);
    assert.ok(shadow.logical.pairs.some(p => (p.left.includes("identity-no-promotion") || p.right.includes("identity-no-promotion")) && p.result.masterDecision === "AUTO_MATCH"));
    assert.deepEqual(await publicOutput(), off);
    assert.equal(off.projection.rows.length, identityRows.length - 1);
    assert.ok(off.projection.rows.every(r => r.productId !== "product-no-promotion"));
    assert.equal(off.projection.rows.find(r => r.productId === "product-a")!.representativeOfferId, "offer-0");
    assert.equal(off.redirect, "https://offers.example.test/offer-0");
    assert.ok(off.projection.rows.find(r => r.productId === "product-solo"));
    assert.ok(off.projection.rows.find(r => r.productId === "product-review"));
    assert.ok(off.projection.rows.find(r => r.productId === "product-conflict"));
    // Exceptions, invalid inputs, no candidates and exhausted budgets are shadow-local.
    const throwingInput = new Proxy([], { get() { throw new Error("private-source-error"); } });
    for (const result of [
      runReconciledShadow(throwingInput), runReconciledShadow(null),
      runReconciledShadow(identityRows, { maxCandidatesPerProduct: 0 }),
      runReconciledShadow(identityRows, { maxEvaluatedPairs: 0 }),
      runReconciledShadow(identityRows, { maxRetrievalComparisons: 0 }),
    ]) {
      assert.ok(["FAILED", "COMPLETE"].includes(result.status));
      assert.equal(JSON.stringify(result).includes("private-source-error"), false);
      assert.deepEqual(await publicOutput(), off);
    }
    assert.deepEqual(commercialRows, before);
  } finally {
    variables.forEach((k, i) => original[i] === undefined ? delete process.env[k] : process.env[k] = original[i]);
  }
});
