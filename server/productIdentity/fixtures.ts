import type { ReconciledRow } from "./adapter";

/** Synthetic reconciled records, never presented as a live catalog sample. */
export function fixtureRow(id: string, name: string, merchantId = "merchant-a", providerId = "provider-1", brand = "Acme"): ReconciledRow {
  return {
    product: { id: `product-${id}`, mainName: name, brandId: `brand-${brand}`, updatedAt: "2026-09-29T00:00:00Z" },
    identity: { id: `identity-${id}`, productId: `product-${id}`, providerId, merchantId,
      feedId: `feed-${providerId}-${merchantId}`, externalProductKey: `external-${id}`,
      provenanceMethod: "merchant_provided", lastSeenAt: "2026-09-29T00:00:00Z" },
    provider: { id: providerId }, merchant: { id: merchantId, providerId },
    feed: { id: `feed-${providerId}-${merchantId}`, providerId, merchantId },
    brand: { id: `brand-${brand}`, name: brand }, variants: [],
  };
}
export function shadowFixture(): ReconciledRow[] {
  const rows = [
    fixtureRow("a", "Tênis Acme Comet V2 Preto"),
    fixtureRow("b", "Tênis Acme Comet V2 Preto", "merchant-b"),
    fixtureRow("c", "Tênis Acme Comet V2 Branco", "merchant-c", "provider-2"),
    fixtureRow("review", "Tênis Acme Comet V2 Woven Preto", "merchant-b"),
    fixtureRow("conflict", "Tênis Acme Comet V3 Preto", "merchant-c", "provider-2"),
    fixtureRow("solo", "Sandália Solitary Orbit", "merchant-c", "provider-2", "Solitary"),
    fixtureRow("evo-a", "Tênis Adidas Adizero EVO SL Masculino Branco", "merchant-a", "provider-1", "Adidas"),
    fixtureRow("evo-b", "Masculino Tênis Adidas EVO SL Adizero Branco", "merchant-b", "provider-1", "Adidas"),
    fixtureRow("evo-edition", "Tênis Adidas Adizero EVO SL Woven Audi Revolut F1 Team Branco", "merchant-c", "provider-2", "Adidas"),
    fixtureRow("numeric-a", "Tênis Fila Ride 2 Feminino Bege", "merchant-a", "provider-1", "Fila"),
    fixtureRow("numeric-b", "Tênis Feminino Fila Ride 2 1285710", "merchant-b", "provider-1", "Fila"),
    fixtureRow("missing", "Unknown object", "merchant-c", "provider-2"),
  ];
  rows[0].identity.externalProductKey = rows[2].identity.externalProductKey = "same-external-id";
  rows.at(-1)!.brand = null;
  rows.at(-1)!.product.brandId = null;
  return rows;
}
