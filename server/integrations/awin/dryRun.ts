import type { Readable } from "node:stream";
import { parseAwinCsv } from "./csv";
import { isInvalidAwinItem, isValidAwinGtin, normalizeAwinItem } from "./normalize";

export type AwinDryRunReport = {
  provider: "awin";
  merchants: Array<{ id: string; name: string | null; rows: number }>;
  rawRows: number; validRows: number; invalidRows: number;
  candidateProducts: number; candidateVariants: number; candidateOffers: number;
  brands: number; withEan: number; withEanRaw: number; withValidEan: number; withInvalidEan: number;
  withAffiliateLink: number; withImage: number; withDescription: number;
  variantCollisions: { differentSizes: number; differentValidGtins: number; acrossProducts: number; acrossMerchants: number };
  priceMin: number | null; priceMax: number | null;
  mostPopulatedFields: Array<{ field: string; count: number; percent: number }>;
  relevantEmptyFields: Array<{ field: string; empty: number; percent: number }>;
  invalidReasons: Record<string, number>;
};

const RELEVANT = ["description", "brand_name", "ean", "aw_deep_link", "merchant_image_url", "parent_product_id", "size_stock_amount", "merchant_deep_link", "currency"];

export async function analyzeAwinFeed(input: Readable, feedId: string): Promise<AwinDryRunReport> {
  const products = new Set<string>(), variants = new Set<string>(), offers = new Set<string>(), brands = new Set<string>();
  const merchants = new Map<string, { name: string | null; rows: number }>();
  const fieldCounts = new Map<string, number>(), invalidReasons: Record<string, number> = {};
  const variantsAudit = new Map<string, { sizes: Set<string>; gtins: Set<string>; products: Set<string>; merchants: Set<string> }>();
  let rawRows = 0, validRows = 0, invalidRows = 0, withEanRaw = 0, withValidEan = 0, withInvalidEan = 0, withAffiliateLink = 0, withImage = 0, withDescription = 0;
  let priceMin: number | null = null, priceMax: number | null = null;
  for await (const row of parseAwinCsv(input)) {
    rawRows++;
    for (const [field, fieldValue] of Object.entries(row.raw)) if (fieldValue.trim()) fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
    const normalized = normalizeAwinItem(row, { feedId, ingestedAt: "dry-run" });
    if (isInvalidAwinItem(normalized)) {
      invalidRows++;
      for (const reason of normalized.reasons) invalidReasons[reason] = (invalidReasons[reason] ?? 0) + 1;
      continue;
    }
    validRows++;
    products.add(normalized.productKey); variants.add(normalized.variantKey); offers.add(normalized.offerKey);
    if (normalized.product.brand) brands.add(normalized.product.brand.trim().toLocaleLowerCase("pt-BR"));
    if (normalized.variant.ean) {
      withEanRaw++;
      if (isValidAwinGtin(normalized.variant.ean)) withValidEan++;
      else withInvalidEan++;
    }
    if (normalized.offer.affiliateUrl) withAffiliateLink++;
    if (normalized.images.length) withImage++;
    if (normalized.product.description) withDescription++;
    priceMin = priceMin == null ? normalized.offer.currentPrice : Math.min(priceMin, normalized.offer.currentPrice);
    priceMax = priceMax == null ? normalized.offer.currentPrice : Math.max(priceMax, normalized.offer.currentPrice);
    const merchant = merchants.get(normalized.offer.merchantId) ?? { name: normalized.offer.merchantName, rows: 0 };
    merchant.rows++;
    if (!merchant.name) merchant.name = normalized.offer.merchantName;
    merchants.set(normalized.offer.merchantId, merchant);
    const audit = variantsAudit.get(normalized.variantKey) ?? { sizes: new Set(), gtins: new Set(), products: new Set(), merchants: new Set() };
    if (normalized.variant.size) audit.sizes.add(normalized.variant.size);
    if (normalized.variant.validGtin) audit.gtins.add(normalized.variant.validGtin);
    audit.products.add(normalized.productKey);
    audit.merchants.add(normalized.offer.merchantId);
    variantsAudit.set(normalized.variantKey, audit);
  }
  const percent = (count: number) => rawRows ? Number((count * 100 / rawRows).toFixed(2)) : 0;
  return {
    provider: "awin", merchants: Array.from(merchants).map(([id, data]) => ({ id, ...data })), rawRows, validRows, invalidRows,
    candidateProducts: products.size, candidateVariants: variants.size, candidateOffers: offers.size, brands: brands.size,
    withEan: withEanRaw, withEanRaw, withValidEan, withInvalidEan, withAffiliateLink, withImage, withDescription, priceMin, priceMax,
    variantCollisions: {
      differentSizes: Array.from(variantsAudit.values()).filter((entry) => entry.sizes.size > 1).length,
      differentValidGtins: Array.from(variantsAudit.values()).filter((entry) => entry.gtins.size > 1).length,
      acrossProducts: Array.from(variantsAudit.values()).filter((entry) => entry.products.size > 1).length,
      acrossMerchants: Array.from(variantsAudit.values()).filter((entry) => entry.merchants.size > 1).length,
    },
    mostPopulatedFields: Array.from(fieldCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([field, count]) => ({ field, count, percent: percent(count) })),
    relevantEmptyFields: RELEVANT.map((field) => ({ field, empty: rawRows - (fieldCounts.get(field) ?? 0), percent: percent(rawRows - (fieldCounts.get(field) ?? 0)) })).sort((a, b) => b.empty - a.empty),
    invalidReasons,
  };
}
