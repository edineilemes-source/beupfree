import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

export type EvidenceOrigin = "LIST_PAGE" | "PRODUCT_PAGE" | "STRUCTURED_DATA" | "OFFICIAL_API" | "AFFILIATE_TOOL" | "DERIVED";
export type PromotionStatus = "PROMOTION_CONFIRMED" | "PROMOTION_UNCERTAIN" | "NOT_PROMOTIONAL";
export type SourceEvidence = { field: string; origin: EvidenceOrigin; value?: string | number | boolean };

export type MercadoLivreCandidate = {
  externalProductId: string | null;
  title: string | null;
  brand: string | null;
  currentPrice: number | null;
  oldPrice: number | null;
  discountPercentSource: number | null;
  discountPercentCalculated: number | null;
  discountPercentDivergence: number | null;
  promotionStatus: PromotionStatus;
  affiliateUrl: string | null;
  merchantUrl: string | null;
  imageUrl: string | null;
  currency: string | null;
  availability: string | null;
  sourceEvidence: SourceEvidence[];
  identityHash: string;
  contentHash: string;
};

const finitePositive = (value: unknown): number | null => {
  const number = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export function extractMercadoLivreItemId(value: string | null | undefined): string | null {
  const match = value?.match(/\b(MLB(?:U)?)[-_]?(\d{6,})\b/i);
  return match ? `${match[1]!.toUpperCase()}${match[2]}` : null;
}

export function calculateDiscountPercent(oldPrice: unknown, currentPrice: unknown): number | null {
  const oldValue = finitePositive(oldPrice), currentValue = finitePositive(currentPrice);
  return oldValue != null && currentValue != null && oldValue > currentValue
    ? Number((((oldValue - currentValue) / oldValue) * 100).toFixed(2)) : null;
}

export function classifyPromotion(input: { currentPrice?: unknown; oldPrice?: unknown; discountPercent?: unknown; explicitNotPromotional?: boolean }): PromotionStatus {
  const current = finitePositive(input.currentPrice), old = finitePositive(input.oldPrice);
  const percent = finitePositive(input.discountPercent);
  if ((old != null && current != null && old > current) || percent != null) return "PROMOTION_CONFIRMED";
  if (input.explicitNotPromotional || (old != null && current != null && old <= current)) return "NOT_PROMOTIONAL";
  return "PROMOTION_UNCERTAIN";
}

/** Removes credentials, fragments and all parameter values before logging. */
export function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = ""; url.password = ""; url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) url.searchParams.set(key, "[redacted]");
    return url.toString();
  } catch { return "[invalid-url]"; }
}

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const first = <T>(value: T | T[] | undefined): T | undefined => Array.isArray(value) ? value[0] : value;

function productsFromJsonLd(value: unknown): Record<string, any>[] {
  if (Array.isArray(value)) return value.flatMap(productsFromJsonLd);
  if (!value || typeof value !== "object") return [];
  const node = value as Record<string, any>;
  if (node["@type"] === "Product") return [node];
  if (node["@type"] === "ItemList") return (node.itemListElement ?? []).flatMap((entry: any) => productsFromJsonLd(entry?.item ?? entry));
  return productsFromJsonLd(node["@graph"]);
}

/**
 * Parses only official JSON-LD. It never executes scripts, follows links, accesses
 * a database, or treats a discovered product URL as an affiliate URL.
 */
export function parseAffiliateListHtml(html: string): MercadoLivreCandidate[] {
  const $ = cheerio.load(html);
  const nodes: Record<string, any>[] = [];
  $('script[type="application/ld+json"]').each((_index, element) => {
    try { nodes.push(...productsFromJsonLd(JSON.parse($(element).text()))); } catch { /* malformed structured data is ignored */ }
  });
  const unique = new Map<string, MercadoLivreCandidate>();
  for (const product of nodes) {
    const offer = first(product.offers);
    const merchantUrl = typeof product.url === "string" ? product.url : typeof offer?.url === "string" ? offer.url : null;
    const externalProductId = extractMercadoLivreItemId(String(product.sku ?? product.productID ?? merchantUrl ?? ""));
    const currentPrice = finitePositive(offer?.price ?? offer?.lowPrice);
    const oldPrice = finitePositive(offer?.highPrice ?? product.originalPrice);
    const discountPercentSource = finitePositive(product.discountPercent ?? offer?.discountPercent);
    const discountPercentCalculated = calculateDiscountPercent(oldPrice, currentPrice);
    const evidence: SourceEvidence[] = [];
    const add = (field: string, value: unknown) => { if (value !== null && value !== undefined && value !== "") evidence.push({ field, origin: "STRUCTURED_DATA", value: value as any }); };
    add("externalProductId", externalProductId); add("title", product.name); add("brand", product.brand?.name ?? product.brand);
    add("currentPrice", currentPrice); add("oldPrice", oldPrice); add("discountPercentSource", discountPercentSource);
    add("merchantUrl", merchantUrl); add("imageUrl", first(product.image)); add("currency", offer?.priceCurrency); add("availability", offer?.availability);
    if (discountPercentCalculated != null) evidence.push({ field: "discountPercentCalculated", origin: "DERIVED", value: discountPercentCalculated });
    const normalized = {
      externalProductId, title: typeof product.name === "string" ? product.name : null,
      brand: typeof product.brand === "string" ? product.brand : product.brand?.name ?? null,
      currentPrice, oldPrice, discountPercentSource, discountPercentCalculated,
      discountPercentDivergence: discountPercentSource != null && discountPercentCalculated != null ? Number((discountPercentSource - discountPercentCalculated).toFixed(2)) : null,
      promotionStatus: classifyPromotion({ currentPrice, oldPrice, discountPercent: discountPercentSource }),
      affiliateUrl: null, merchantUrl, imageUrl: typeof first(product.image) === "string" ? first(product.image)! : null,
      currency: typeof offer?.priceCurrency === "string" ? offer.priceCurrency : null,
      availability: typeof offer?.availability === "string" ? offer.availability : null, sourceEvidence: evidence,
    };
    const identityMaterial = externalProductId ?? merchantUrl ?? product.name ?? product;
    const candidate = { ...normalized, identityHash: hash(identityMaterial), contentHash: hash(normalized) };
    unique.set(candidate.identityHash, candidate);
  }
  return Array.from(unique.values());
}

export function summarizeCandidates(products: MercadoLivreCandidate[]) {
  const count = (status: PromotionStatus) => products.filter((item) => item.promotionStatus === status).length;
  return { provider: "mercadolivre" as const, sourceType: "affiliate_list" as const, productsSeen: products.length,
    promotionConfirmed: count("PROMOTION_CONFIRMED"), promotionUncertain: count("PROMOTION_UNCERTAIN"), notPromotional: count("NOT_PROMOTIONAL") };
}
