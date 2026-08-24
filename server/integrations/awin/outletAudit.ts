import * as cheerio from "cheerio";
import type { Pool } from "pg";

export const LAURI_OUTLET_URL = "https://www.lauriesporte.com.br/outlet?sort_by=lowest_price";
export const OUTLET_EVIDENCE_SOURCE = "LAURI_OUTLET_PAGE" as const;
export const PRICE_TOLERANCE_BRL = 0.05;
export const PRICE_TOLERANCE_PERCENT = 0.1;

export type PromotionStatus = "PROMOTION_CONFIRMED" | "PROMOTION_UNCERTAIN" | "NOT_PROMOTIONAL";
export type MatchMethod = "MATCH_URL" | "MATCH_MERCHANT_ID" | "MATCH_GTIN" | "MATCH_REVIEW_REQUIRED" | "NO_MATCH";
export type PriceComparison = "PRICE_MATCH" | "PRICE_DIFFERENCE_MINOR" | "PRICE_DIFFERENCE_MATERIAL" | "PRICE_NOT_COMPARABLE";

export type LauriOutletItem = {
  productUrl: string;
  canonicalUrl: string;
  productName: string;
  brand: string | null;
  merchantProductId: string | null;
  merchantSkuIds: string[];
  gtins: string[];
  oldPrice: number | null;
  currentPrice: number | null;
  pixPrice: number | null;
  currency: "BRL" | null;
  imageUrl: string | null;
  availability: boolean | null;
  outletEvidence: {
    source: typeof OUTLET_EVIDENCE_SOURCE;
    status: PromotionStatus;
    discountPercentCalculated: number | null;
  };
  sourceObservedAt: string;
};

export type AwinAuditProduct = {
  id: string;
  key: string;
  name: string;
  brand: string | null;
  merchantUrl: string | null;
  merchantProductIds: string[];
  gtins: string[];
  variants: Array<{ id: string; merchantProductId: string | null; gtin: string | null }>;
  offers: Array<{ id: string; currentPrice: number | null; capturedAt: string | null; variantId: string | null }>;
};

type EmbeddedProduct = {
  id?: unknown; name?: unknown; url?: unknown; url_path?: unknown; sku?: unknown; blocked_sale?: unknown;
  brand?: { data?: { name?: unknown } }; images?: { data?: Array<{ url?: unknown }> };
  prices?: { data?: { currency?: unknown; price?: unknown; price_discount?: unknown; price_sale?: unknown; pix?: { price?: unknown } } };
  skus?: { data?: Array<{ id?: unknown; sku?: unknown; ean?: unknown; gtin?: unknown; blocked_sale?: unknown }> };
};

const finitePositive = (value: unknown): number | null => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const textOrNull = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : value == null ? null : String(value);

export function canonicalizeMerchantUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, "https://www.lauriesporte.com.br");
    if (!/^https?:$/.test(url.protocol)) return null;
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.search = ""; url.hash = "";
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
    return url.toString();
  } catch { return null; }
}

export function classifyOutletPromotion(oldPrice: unknown, currentPrice: unknown): LauriOutletItem["outletEvidence"] {
  const oldValue = finitePositive(oldPrice);
  const currentValue = finitePositive(currentPrice);
  if (oldValue != null && currentValue != null && oldValue > currentValue) return {
    source: OUTLET_EVIDENCE_SOURCE, status: "PROMOTION_CONFIRMED",
    discountPercentCalculated: Number((((oldValue - currentValue) / oldValue) * 100).toFixed(2)),
  };
  if (oldValue != null && currentValue != null && oldValue <= currentValue) return { source: OUTLET_EVIDENCE_SOURCE, status: "NOT_PROMOTIONAL", discountPercentCalculated: null };
  return { source: OUTLET_EVIDENCE_SOURCE, status: "PROMOTION_UNCERTAIN", discountPercentCalculated: null };
}

export function parseLauriOutletHtml(html: string, observedAt = new Date().toISOString()): LauriOutletItem[] {
  const $ = cheerio.load(html);
  const products = new Map<string, LauriOutletItem>();
  $("[\\:product]").each((_index, element) => {
    const encoded = $(element).attr(":product");
    if (!encoded) return;
    let product: EmbeddedProduct;
    try { product = JSON.parse(encoded); } catch { return; }
    const productUrl = textOrNull(product.url) ?? textOrNull(product.url_path);
    const canonicalUrl = canonicalizeMerchantUrl(productUrl);
    const productName = textOrNull(product.name);
    if (!productUrl || !canonicalUrl || !productName) return;
    const prices = product.prices?.data;
    const oldPrice = finitePositive(prices?.price_sale);
    const currentPrice = finitePositive(prices?.price_discount) ?? finitePositive(prices?.price);
    const merchantSkuIds = [textOrNull(product.sku), ...(product.skus?.data ?? []).flatMap((sku) => [textOrNull(sku.id), textOrNull(sku.sku)])]
      .filter((value): value is string => Boolean(value)).flatMap((value) => value.split(",").map((part) => part.trim()).filter(Boolean));
    const gtins = (product.skus?.data ?? []).flatMap((sku) => [textOrNull(sku.ean), textOrNull(sku.gtin)]).filter((value): value is string => Boolean(value));
    products.set(textOrNull(product.id) ?? canonicalUrl, {
      productUrl, canonicalUrl, productName, brand: textOrNull(product.brand?.data?.name), merchantProductId: textOrNull(product.id),
      merchantSkuIds: Array.from(new Set(merchantSkuIds)), gtins: Array.from(new Set(gtins)), oldPrice, currentPrice,
      pixPrice: finitePositive(prices?.pix?.price), currency: prices?.currency === "R$" || prices?.currency === "BRL" ? "BRL" : null,
      imageUrl: textOrNull(product.images?.data?.[0]?.url), availability: typeof product.blocked_sale === "boolean" ? !product.blocked_sale : null,
      outletEvidence: classifyOutletPromotion(oldPrice, currentPrice), sourceObservedAt: observedAt,
    });
  });
  return Array.from(products.values());
}

const normalizedName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function matchOutletItem(item: LauriOutletItem, awin: AwinAuditProduct[]): { method: MatchMethod; product: AwinAuditProduct | null } {
  const byUrl = awin.filter((p) => canonicalizeMerchantUrl(p.merchantUrl) === item.canonicalUrl);
  if (byUrl.length === 1) return { method: "MATCH_URL", product: byUrl[0] };
  const outletIds = new Set([item.merchantProductId, ...item.merchantSkuIds].filter(Boolean));
  const byId = awin.filter((p) => p.merchantProductIds.some((id) => outletIds.has(id)));
  if (byId.length === 1) return { method: "MATCH_MERCHANT_ID", product: byId[0] };
  const gtins = new Set(item.gtins);
  const byGtin = awin.filter((p) => p.gtins.some((gtin) => gtins.has(gtin)));
  if (byGtin.length === 1) return { method: "MATCH_GTIN", product: byGtin[0] };
  const name = normalizedName(item.productName);
  const candidates = awin.filter((p) => normalizedName(p.name) === name && (!item.brand || !p.brand || normalizedName(p.brand) === normalizedName(item.brand)));
  return candidates.length ? { method: "MATCH_REVIEW_REQUIRED", product: candidates.length === 1 ? candidates[0] : null } : { method: "NO_MATCH", product: null };
}

export function comparePrices(awinPrice: unknown, outletPrice: unknown) {
  const awin = finitePositive(awinPrice), outlet = finitePositive(outletPrice);
  if (awin == null || outlet == null) return { status: "PRICE_NOT_COMPARABLE" as PriceComparison, absoluteDifference: null, percentDifference: null };
  const absoluteDifference = Number(Math.abs(awin - outlet).toFixed(2));
  const percentDifference = Number(((absoluteDifference / outlet) * 100).toFixed(2));
  const status: PriceComparison = absoluteDifference === 0 ? "PRICE_MATCH" : absoluteDifference <= PRICE_TOLERANCE_BRL || percentDifference <= PRICE_TOLERANCE_PERCENT ? "PRICE_DIFFERENCE_MINOR" : "PRICE_DIFFERENCE_MATERIAL";
  return { status, absoluteDifference, percentDifference };
}

export async function loadAwinAuditProducts(pool: Pick<Pool, "query">): Promise<AwinAuditProduct[]> {
  await pool.query("BEGIN READ ONLY");
  try {
    const result = await pool.query(`SELECT p.id,e.external_product_key,p.main_name,
      COALESCE(r.raw_payload->>'brand_name','') brand,e.merchant_product_page_url,
      v.id variant_id,v.merchant_product_id,v.gtin,o.id offer_id,o.current_price,o.captured_at
      FROM external_product_identities e JOIN products p ON p.id=e.product_id
      JOIN commerce_providers cp ON cp.id=e.provider_id JOIN commerce_merchants cm ON cm.id=e.merchant_id
      LEFT JOIN product_variants v ON v.product_id=p.id AND v.provider_id=e.provider_id AND v.merchant_id=e.merchant_id
      LEFT JOIN offers o ON o.variant_id=v.id
      LEFT JOIN LATERAL (SELECT raw_payload FROM commerce_raw_feed_items rr WHERE rr.feed_id=e.feed_id AND (rr.external_product_id=v.aw_product_id OR rr.merchant_product_id=v.merchant_product_id) LIMIT 1) r ON true
      WHERE cp.code='awin' AND cm.external_merchant_id='118977' ORDER BY p.id,v.id,o.id`);
    const grouped = new Map<string, AwinAuditProduct>();
    for (const row of result.rows) {
      const product: AwinAuditProduct = grouped.get(row.id) ?? { id: row.id, key: row.external_product_key, name: row.main_name, brand: row.brand || null, merchantUrl: row.merchant_product_page_url, merchantProductIds: [], gtins: [], variants: [], offers: [] };
      if (row.variant_id && !product.variants.some((v) => v.id === row.variant_id)) product.variants.push({ id: row.variant_id, merchantProductId: row.merchant_product_id, gtin: row.gtin });
      if (row.merchant_product_id) product.merchantProductIds.push(String(row.merchant_product_id));
      if (row.gtin) product.gtins.push(String(row.gtin));
      if (row.offer_id && !product.offers.some((o) => o.id === row.offer_id)) product.offers.push({ id: row.offer_id, currentPrice: finitePositive(row.current_price), capturedAt: row.captured_at?.toISOString?.() ?? textOrNull(row.captured_at), variantId: row.variant_id });
      grouped.set(row.id, product);
    }
    await pool.query("COMMIT");
    return Array.from(grouped.values()).map((p) => ({ ...p, merchantProductIds: Array.from(new Set(p.merchantProductIds)), gtins: Array.from(new Set(p.gtins)) }));
  } catch (error) { await pool.query("ROLLBACK"); throw error; }
}

const stats = (values: number[]) => {
  if (!values.length) return { min: null, average: null, median: null, max: null };
  const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2);
  return { min: sorted[0], average: Number((sorted.reduce((a,b)=>a+b,0)/sorted.length).toFixed(2)), median: sorted.length % 2 ? sorted[middle] : Number(((sorted[middle-1]+sorted[middle])/2).toFixed(2)), max: sorted.at(-1)! };
};

export function buildOutletAudit(items: LauriOutletItem[], awin: AwinAuditProduct[]) {
  const matches = items.map((outlet) => ({ outlet, ...matchOutletItem(outlet, awin) }));
  const finalMatches = matches.filter((m) => m.product && m.method !== "MATCH_REVIEW_REQUIRED");
  const matchedIds = new Set(finalMatches.map((m) => m.product!.id));
  const confirmed = items.filter((i) => i.outletEvidence.status === "PROMOTION_CONFIRMED");
  const eligible = finalMatches.filter((m) => m.outlet.outletEvidence.status === "PROMOTION_CONFIRMED");
  const comparisons = finalMatches.flatMap((m) => m.product!.offers.map((offer) => ({ productId: m.product!.id, offerId: offer.id, ...comparePrices(offer.currentPrice, m.outlet.currentPrice), awinObservedAt: offer.capturedAt, outletObservedAt: m.outlet.sourceObservedAt })));
  return {
    outlet: { observed: items.length, promotionConfirmed: confirmed.length, promotionUncertain: items.filter((i)=>i.outletEvidence.status==="PROMOTION_UNCERTAIN").length, notPromotional: items.filter((i)=>i.outletEvidence.status==="NOT_PROMOTIONAL").length, currentPrice: stats(items.map((i)=>i.currentPrice).filter((v): v is number=>v!=null)), confirmedDiscount: stats(confirmed.map((i)=>i.outletEvidence.discountPercentCalculated).filter((v): v is number=>v!=null)) },
    matching: { matchedToAwin: finalMatches.length, unmatchedOutlet: matches.length-finalMatches.length, awinProductsMatched: matchedIds.size, awinProductsNotInOutlet: awin.length-matchedIds.size, byMethod: Object.fromEntries((["MATCH_URL","MATCH_MERCHANT_ID","MATCH_GTIN","MATCH_REVIEW_REQUIRED","NO_MATCH"] as MatchMethod[]).map((method)=>[method,matches.filter((m)=>m.method===method).length])) },
    evidence: { matchedWithOldAndCurrentPrice: finalMatches.filter((m)=>m.outlet.oldPrice!=null&&m.outlet.currentPrice!=null).length, matchedWithOnlyCurrentPrice: finalMatches.filter((m)=>m.outlet.oldPrice==null&&m.outlet.currentPrice!=null).length, matchedWithPixPrice: finalMatches.filter((m)=>m.outlet.pixPrice!=null).length, discount: stats(eligible.map((m)=>m.outlet.outletEvidence.discountPercentCalculated!).filter((v)=>v!=null)) },
    publicationReadiness: { awinProductsPotentiallyEligible: new Set(eligible.map((m)=>m.product!.id)).size, variants: eligible.reduce((n,m)=>n+m.product!.variants.length,0), offers: eligible.reduce((n,m)=>n+m.product!.offers.length,0), awinProductsStillWithoutConfirmedPromotion: awin.length-new Set(eligible.map((m)=>m.product!.id)).size },
    priceComparison: Object.fromEntries((["PRICE_MATCH","PRICE_DIFFERENCE_MINOR","PRICE_DIFFERENCE_MATERIAL","PRICE_NOT_COMPARABLE"] as PriceComparison[]).map((status)=>[status,comparisons.filter((c)=>c.status===status).length])),
    multivariant: { matchedProducts: finalMatches.length, samePriceAcrossVariants: finalMatches.filter((m)=>new Set(m.product!.offers.map((o)=>o.currentPrice).filter((p)=>p!=null)).size<=1).length, differentPricesAcrossVariants: finalMatches.filter((m)=>new Set(m.product!.offers.map((o)=>o.currentPrice).filter((p)=>p!=null)).size>1).length },
    matches: matches.map((m) => ({ brand: m.outlet.brand ?? m.product?.brand ?? null, productName: m.outlet.productName, awinProductId: m.product?.id ?? null, awinProductKey: m.product?.key ?? null, merchantUrl: m.product ? canonicalizeMerchantUrl(m.product.merchantUrl) : null, outletUrl: m.outlet.canonicalUrl, matchMethod: m.method, oldPrice: m.outlet.oldPrice, currentPrice: m.outlet.currentPrice, pixPrice: m.outlet.pixPrice, discountPercent: m.outlet.outletEvidence.discountPercentCalculated, promotionStatus: m.outlet.outletEvidence.status, variantsCount: m.product?.variants.length ?? 0, offersCount: m.product?.offers.length ?? 0 })), comparisons,
  };
}
