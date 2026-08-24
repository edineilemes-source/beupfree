import assert from "node:assert/strict";
import test from "node:test";
import { calculateDiscountPercent, classifyPromotion, extractMercadoLivreItemId, parseAffiliateListHtml, sanitizeUrl, summarizeCandidates } from "./affiliateList";

const html = `<!doctype html><script type="application/ld+json">${JSON.stringify({
  "@type": "ItemList", itemListElement: [
    { item: { "@type": "Product", sku: "MLB-1234567890", name: "Tênis Exemplo 40", brand: { name: "Marca" }, image: "https://img.example/a.jpg", url: "https://produto.mercadolivre.com.br/MLB-1234567890-item?tracking=secret", offers: { price: "337.49", highPrice: "499.99", priceCurrency: "BRL", availability: "https://schema.org/InStock" } } },
    { item: { "@type": "Product", productID: "MLB2345678901", name: "Tênis Só Preço", offers: { price: 200, priceCurrency: "BRL" } } },
    { item: { "@type": "Product", productID: "MLBU3456789012", name: "Tênis Sem Desconto", offers: { price: 300, highPrice: 300 } } }
  ]
})}</script>`;

test("IDs MLB e MLBU são normalizados", () => {
  assert.equal(extractMercadoLivreItemId("/MLB-1234567890-x"), "MLB1234567890");
  assert.equal(extractMercadoLivreItemId("MLBU_3456789012"), "MLBU3456789012");
  assert.equal(extractMercadoLivreItemId("sem-id"), null);
});
test("preços e promoção são classificados deterministicamente", () => {
  assert.equal(calculateDiscountPercent(499.99, 337.49), 32.5);
  assert.equal(classifyPromotion({ currentPrice: 10, oldPrice: 20 }), "PROMOTION_CONFIRMED");
  assert.equal(classifyPromotion({ currentPrice: 10, discountPercent: 32 }), "PROMOTION_CONFIRMED");
  assert.equal(classifyPromotion({ currentPrice: 10 }), "PROMOTION_UNCERTAIN");
  assert.equal(classifyPromotion({ currentPrice: 20, oldPrice: 20 }), "NOT_PROMOTIONAL");
  assert.equal(classifyPromotion({}), "PROMOTION_UNCERTAIN");
});
test("parser é idempotente, tolera ausência e nunca reconstrói affiliateUrl", () => {
  const first = parseAffiliateListHtml(html), second = parseAffiliateListHtml(html);
  assert.deepEqual(first, second); assert.equal(first.length, 3);
  assert.equal(first[0]!.currentPrice, 337.49); assert.equal(first[0]!.oldPrice, 499.99);
  assert.equal(first[0]!.promotionStatus, "PROMOTION_CONFIRMED");
  assert.equal(first[1]!.promotionStatus, "PROMOTION_UNCERTAIN");
  assert.equal(first[2]!.promotionStatus, "NOT_PROMOTIONAL");
  assert.ok(first.every((item) => item.affiliateUrl === null));
  assert.deepEqual(summarizeCandidates(first), { provider: "mercadolivre", sourceType: "affiliate_list", productsSeen: 3, promotionConfirmed: 1, promotionUncertain: 1, notPromotional: 1 });
  assert.deepEqual(parseAffiliateListHtml("<html></html>"), []);
});
test("URLs e redirects são sanitizados para logs", () => {
  assert.equal(sanitizeUrl("https://user:pass@example.com/a?token=secret&x=1#private"), "https://example.com/a?token=%5Bredacted%5D&x=%5Bredacted%5D");
  assert.equal(sanitizeUrl("not a url"), "[invalid-url]");
});
