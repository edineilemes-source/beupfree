import { z } from "zod";
import { compare, merchantProductSchema, type MerchantProduct } from "./contracts";

const id = z.string().min(1).max(256);
const text = z.string().max(4096).nullish();
const timestamp = z.union([z.date().transform(value => value.toISOString()),
  z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString())]).nullish();
const variant = z.object({ id, productId: id, providerId: id, merchantId: id,
  externalVariantKey: id.nullish(), size: text, colour: text, gtin: text, ean: text, upc: text, mpn: text,
  provenanceMethod: text, updatedAt: timestamp, lastSeenAt: timestamp });
/** Read projection of reconciled entities, with camelCase matching Drizzle fields.
 * Unknown fields (offers, URLs, arbitrary raw attributes) are stripped at this boundary.
 */
export const reconciledRowSchema = z.object({
  product: z.object({ id, mainName: z.string().max(4096), brandId: id.nullish(), updatedAt: timestamp }),
  identity: z.object({ id, productId: id, providerId: id, merchantId: id, feedId: id.nullish(),
    externalProductKey: id, provenanceMethod: text, lastSeenAt: timestamp }),
  provider: z.object({ id }), merchant: z.object({ id, providerId: id }),
  feed: z.object({ id, providerId: id, merchantId: id.nullish() }).nullish(),
  brand: z.object({ id, name: z.string().max(4096) }).nullish(),
  variants: z.array(variant).max(1000),
  // Explicit caller selection only; never choose the first variant or infer a size system.
  selectedVariantId: id.optional(),
});
export type ReconciledRow = z.infer<typeof reconciledRowSchema>;
export function adaptReconciledRows(raw: unknown): MerchantProduct[] {
  const rows = z.array(reconciledRowSchema).max(2000).parse(raw);
  const unique = new Set<string>();
  for (const r of rows) {
    const e = r.identity;
    if (unique.has(e.id)) throw new Error("DUPLICATE_EXTERNAL_IDENTITY");
    unique.add(e.id);
    if (e.productId !== r.product.id || e.providerId !== r.provider.id ||
      e.merchantId !== r.merchant.id || r.merchant.providerId !== e.providerId ||
      (e.feedId && (!r.feed || r.feed.id !== e.feedId)) ||
      (r.feed && (r.feed.id !== e.feedId || r.feed.providerId !== e.providerId ||
        (r.feed.merchantId != null && r.feed.merchantId !== e.merchantId))) ||
      (r.brand && r.brand.id !== r.product.brandId)) throw new Error("SOURCE_RELATION_CONFLICT");
    const variantIds = new Set<string>();
    for (const v of r.variants) {
      if (v.productId !== e.productId || v.providerId !== e.providerId || v.merchantId !== e.merchantId || variantIds.has(v.id)) {
        throw new Error("VARIANT_RELATION_CONFLICT");
      }
      variantIds.add(v.id);
    }
  }
  return rows.map(r => {
    const e = r.identity;
    const ambiguous = rows.filter(other => other.identity.productId === e.productId &&
      other.identity.providerId === e.providerId && other.identity.merchantId === e.merchantId).length > 1;
    const selected = r.selectedVariantId ? r.variants.find(v => v.id === r.selectedVariantId) : undefined;
    if (r.selectedVariantId && (!selected || ambiguous)) throw new Error("VARIANT_SELECTION_AMBIGUOUS");
    const provenance: MerchantProduct["provenance"] = [
      { entity: "products", recordId: r.product.id, field: "main_name" },
      { entity: "external_product_identities", recordId: e.id, field: "external_product_key",
        ...(e.provenanceMethod ? { method: e.provenanceMethod } : {}) },
    ];
    if (r.brand) provenance.push({ entity: "brands", recordId: r.brand.id, field: "name" });
    if (!ambiguous) for (const v of r.variants) {
      for (const field of ["size", "colour", "gtin", "ean", "upc", "mpn"] as const) if (v[field] != null) {
        provenance.push({ entity: "product_variants", recordId: v.id, field,
          ...(v.provenanceMethod ? { method: v.provenanceMethod } : {}) });
      }
    }
    const input: MerchantProduct["input"] = { name: r.product.mainName, ...(r.brand ? { brand: r.brand.name } : {}) };
    // GTIN and MPN are scoped to an explicitly selected variant. No rollup across SKUs.
    for (const field of ["gtin", "mpn"] as const) if (selected?.[field]) {
      input[field] = selected[field];
    }
    return merchantProductSchema.parse({
      productId: e.productId, externalIdentityId: e.id, providerId: e.providerId,
      merchantId: e.merchantId, feedId: e.feedId, externalProductKey: e.externalProductKey,
      input, scope: selected ? { kind: "SELECTED_VARIANT", variantId: selected.id } : { kind: "PRODUCT_TITLE" },
      observedVariants: ambiguous ? [] : r.variants.map(({ id, externalVariantKey, size, colour, gtin, ean, upc, mpn, updatedAt, lastSeenAt }) =>
        ({ id, externalVariantKey, size, colour, gtin, ean, upc, mpn, updatedAt, lastSeenAt })),
      provenance, timestamps: { updatedAt: r.product.updatedAt, lastSeenAt: e.lastSeenAt },
      diagnostics: ambiguous ? ["VARIANT_ASSOCIATION_AMBIGUOUS"] : [],
    });
  }).sort((a, b) => compare(a.externalIdentityId, b.externalIdentityId));
}
