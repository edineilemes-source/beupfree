import { createHash } from "node:crypto";
import { z } from "zod";

export const VERSIONS = {
  adapter: "reconciled-entities-v1", snapshot: "identity-input-v1",
  candidates: "brand-type-token-dice-v1", parser: "product-identity-v1.2",
  matcher: "product-identity-v1.2", grouping: "complete-pair-check-v1",
} as const;
export const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value)
    .filter(([, v]) => v !== undefined).sort(([a], [b]) => compare(a, b))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
export const digest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const id = z.string().min(1).max(256);
const text = z.string().max(4096);
export const identityInputSchema = z.object({
  name: text, brand: text.nullish(), gtin: text.optional(), mpn: text.optional(),
  size: z.object({ value: text, system: text }).optional(),
});
const provenanceSchema = z.object({
  entity: z.enum(["products", "brands", "external_product_identities", "product_variants"]),
  recordId: id, field: id, method: text.optional(),
});
export const merchantProductSchema = z.object({
  productId: id, externalIdentityId: id, providerId: id, merchantId: id,
  feedId: id.nullish(), externalProductKey: id,
  input: identityInputSchema,
  scope: z.discriminatedUnion("kind", [z.object({ kind: z.literal("PRODUCT_TITLE") }),
    z.object({ kind: z.literal("SELECTED_VARIANT"), variantId: id })]),
  observedVariants: z.array(z.object({
    id, externalVariantKey: id.nullish(), updatedAt: text.nullish(), lastSeenAt: text.nullish(),
    size: text.nullish(), colour: text.nullish(), gtin: text.nullish(),
    ean: text.nullish(), upc: text.nullish(), mpn: text.nullish(),
  })).max(1000),
  provenance: z.array(provenanceSchema),
  timestamps: z.object({ updatedAt: text.nullish(), lastSeenAt: text.nullish() }),
  diagnostics: z.array(z.string()),
});
export type MerchantProduct = z.infer<typeof merchantProductSchema>;
export function snapshot(raw: MerchantProduct) {
  const item = merchantProductSchema.parse(raw); // Allowlist; never retain commercial payloads.
  item.observedVariants.sort((a, b) => compare(a.id, b.id));
  item.provenance.sort((a, b) => compare(canonical(a), canonical(b)));
  item.diagnostics.sort(compare);
  const key = canonical([item.providerId, item.merchantId, item.externalIdentityId]);
  return { ...item, key, inputHash: digest({ version: VERSIONS.snapshot, input: item.input }) };
}
export type Snapshot = ReturnType<typeof snapshot>;
export const pairKey = (a: string, b: string) => canonical([a, b].sort(compare));
