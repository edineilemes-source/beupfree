import type { Pool } from "pg";

/** HTTP stays disabled until sessions carry a verifiable administrative role. */
export const AWIN_CURATION_HTTP_ENABLED = false as const;

export type PromotionStatus = "PROMOTION_CONFIRMED" | "PROMOTION_UNCERTAIN" | "NOT_PROMOTIONAL";
export type PromotionEvidence = { status: PromotionStatus; evidence: string; regularPrice: number | null; percent: number | null };

const numberOrNull = (value: unknown): number | null => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);

export function classifyPromotion(offer: { currentPrice: unknown; oldPrice?: unknown; rrpPrice?: unknown; saving?: unknown; savingsPercent?: unknown }): PromotionEvidence {
  const current = numberOrNull(offer.currentPrice);
  const old = numberOrNull(offer.oldPrice);
  const rrp = numberOrNull(offer.rrpPrice);
  const saving = numberOrNull(offer.saving);
  const suppliedPercent = numberOrNull(offer.savingsPercent);
  const regular = [old, rrp].filter((value): value is number => value != null && value > 0).sort((a, b) => b - a)[0] ?? null;
  const calculatedPercent = current != null && regular != null && regular > current ? Number((((regular - current) / regular) * 100).toFixed(2)) : null;
  if (current != null && regular != null && current < regular) return { status: "PROMOTION_CONFIRMED", evidence: "current_price_below_regular_price", regularPrice: regular, percent: calculatedPercent };
  if (saving != null && saving > 0) return { status: "PROMOTION_CONFIRMED", evidence: "saving_positive", regularPrice: regular, percent: suppliedPercent ?? calculatedPercent };
  if (suppliedPercent != null && suppliedPercent > 0) return { status: "PROMOTION_CONFIRMED", evidence: "savings_percent_positive", regularPrice: regular, percent: suppliedPercent };
  if ((saving != null && saving <= 0) || (suppliedPercent != null && suppliedPercent <= 0) || (current != null && regular != null && current >= regular)) return { status: "NOT_PROMOTIONAL", evidence: "structured_fields_show_no_saving", regularPrice: regular, percent: suppliedPercent ?? calculatedPercent };
  return { status: "PROMOTION_UNCERTAIN", evidence: "no_reliable_structured_promotion_evidence", regularPrice: regular, percent: null };
}

export type CurationFilters = { merchant?: string; brand?: string; search?: string; minPrice?: number; maxPrice?: number; hasDescription?: boolean; hasValidGtin?: boolean; minVariants?: number; available?: boolean; publicationState?: string };

type CatalogRow = Record<string, any>;
export type CurationProduct = {
  id: string; name: string; brand: string | null; description: string | null; merchant: string; provider: string; feed: string;
  publicationState: string; active: boolean; images: string[]; variants: Array<Record<string, any>>; offers: Array<Record<string, any>>;
};

export function filterCurationProducts(products: CurationProduct[], filters: CurationFilters): CurationProduct[] {
  const text = filters.search?.trim().toLocaleLowerCase("pt-BR");
  return products.filter((product) => {
    const prices = product.offers.map((offer) => Number(offer.currentPrice)).filter(Number.isFinite);
    const available = product.offers.some((offer) => offer.inStock === true || offer.isForSale === true);
    if (filters.merchant && product.merchant !== filters.merchant) return false;
    if (filters.brand && product.brand?.toLocaleLowerCase("pt-BR") !== filters.brand.toLocaleLowerCase("pt-BR")) return false;
    if (text && !product.name.toLocaleLowerCase("pt-BR").includes(text)) return false;
    if (filters.minPrice != null && !prices.some((price) => price >= filters.minPrice!)) return false;
    if (filters.maxPrice != null && !prices.some((price) => price <= filters.maxPrice!)) return false;
    if (filters.hasDescription != null && Boolean(product.description?.trim()) !== filters.hasDescription) return false;
    if (filters.hasValidGtin != null && product.variants.some((variant) => Boolean(variant.gtin)) !== filters.hasValidGtin) return false;
    if (filters.minVariants != null && product.variants.length < filters.minVariants) return false;
    if (filters.available != null && available !== filters.available) return false;
    if (filters.publicationState && product.publicationState !== filters.publicationState) return false;
    return true;
  });
}

export class AwinCurationService {
  constructor(private readonly pool: Pick<Pool, "query">) {}

  async products(filters: CurationFilters = {}): Promise<CurationProduct[]> {
    const [rows, imageRows] = await Promise.all([
      this.pool.query(`SELECT p.id,p.main_name,p.detailed_description,e.publication_state,e.active,cp.code provider,cm.name merchant,cf.external_feed_id feed,
        v.id variant_id,v.external_variant_key,v.ean,v.gtin,v.size,v.colour,v.attributes,
        o.id offer_id,o.current_price,o.original_price,o.rrp_price,o.saving,o.savings_percent,o.currency,o.in_stock,o.is_for_sale,o.stock_status,o.status,o.active offer_active,
        o.affiliate_url IS NOT NULL affiliate_available,o.original_url IS NOT NULL merchant_url_available,
        COALESCE(r.raw_payload->>'brand_name','') brand
        FROM external_product_identities e JOIN products p ON p.id=e.product_id JOIN commerce_providers cp ON cp.id=e.provider_id
        JOIN commerce_merchants cm ON cm.id=e.merchant_id LEFT JOIN commerce_feeds cf ON cf.id=e.feed_id
        JOIN product_variants v ON v.product_id=p.id AND v.provider_id=e.provider_id AND v.merchant_id=e.merchant_id
        LEFT JOIN offers o ON o.variant_id=v.id
        LEFT JOIN LATERAL (SELECT raw_payload FROM commerce_raw_feed_items rr WHERE rr.feed_id=e.feed_id AND (rr.external_product_id=v.aw_product_id OR rr.merchant_product_id=v.merchant_product_id) LIMIT 1) r ON true
        WHERE cp.code='awin' ORDER BY p.id,v.id`),
      this.pool.query(`SELECT pi.product_id,pi.url,pi.is_primary,pi.sort_order FROM product_images pi JOIN commerce_providers cp ON cp.id=pi.provider_id WHERE cp.code='awin' ORDER BY pi.product_id,pi.sort_order,pi.url`),
    ]);
    const images = new Map<string, string[]>();
    for (const row of imageRows.rows) images.set(row.product_id, [...(images.get(row.product_id) ?? []), row.url]);
    const grouped = new Map<string, CurationProduct>();
    for (const row of rows.rows as CatalogRow[]) {
      const product: CurationProduct = grouped.get(row.id) ?? { id: row.id, name: row.main_name, brand: row.brand || null, description: row.detailed_description, merchant: row.merchant, provider: row.provider, feed: row.feed, publicationState: row.publication_state, active: row.active, images: images.get(row.id) ?? [], variants: [], offers: [] };
      product.variants.push({ id: row.variant_id, externalKey: row.external_variant_key, ean: row.ean, gtin: row.gtin, size: row.size, colour: row.colour, attributes: row.attributes });
      if (row.offer_id) product.offers.push({ id: row.offer_id, currentPrice: Number(row.current_price), oldPrice: numberOrNull(row.original_price), rrpPrice: numberOrNull(row.rrp_price), saving: numberOrNull(row.saving), savingsPercent: numberOrNull(row.savings_percent), currency: row.currency, inStock: row.in_stock, isForSale: row.is_for_sale, stockStatus: row.stock_status, status: row.status, active: row.offer_active, affiliateAvailable: row.affiliate_available, merchantUrlAvailable: row.merchant_url_available, promotion: classifyPromotion({ currentPrice: row.current_price, oldPrice: row.original_price, rrpPrice: row.rrp_price, saving: row.saving, savingsPercent: row.savings_percent }) });
      grouped.set(row.id, product);
    }
    return filterCurationProducts(Array.from(grouped.values()), filters);
  }

  async qualityReport() {
    const products = await this.products();
    const variants = products.flatMap((product) => product.variants);
    const offers = products.flatMap((product) => product.offers);
    const descriptions = products.map((product) => product.description?.trim() ?? "");
    const imageUrls = products.flatMap((product) => product.images);
    const imageHosts = new Map<string, number>(); let invalidImageUrls = 0;
    for (const url of imageUrls) { try { const host = new URL(url).hostname; imageHosts.set(host, (imageHosts.get(host) ?? 0) + 1); } catch { invalidImageUrls++; } }
    const duplicateNames = new Map<string, number>(); const duplicateDescriptions = new Map<string, number>();
    for (const product of products) { const name=product.name.trim().toLocaleLowerCase("pt-BR"); duplicateNames.set(name,(duplicateNames.get(name)??0)+1); const description=product.description?.trim(); if(description) duplicateDescriptions.set(description,(duplicateDescriptions.get(description)??0)+1); }
    const prices = offers.map((offer) => offer.currentPrice).filter(Number.isFinite);
    const promotion = { PROMOTION_CONFIRMED: 0, PROMOTION_UNCERTAIN: 0, NOT_PROMOTIONAL: 0 };
    for (const offer of offers) promotion[offer.promotion.status as PromotionStatus]++;
    const variantDistribution = new Map<number, number>(); for (const product of products) variantDistribution.set(product.variants.length,(variantDistribution.get(product.variants.length)??0)+1);
    return {
      totals: { products: products.length, variants: variants.length, offers: offers.length, brands: new Set(products.map((p) => p.brand).filter(Boolean)).size, images: imageUrls.length },
      descriptions: { withDescription: descriptions.filter(Boolean).length, empty: descriptions.filter((d) => !d).length, averageLength: descriptions.filter(Boolean).length ? Number((descriptions.filter(Boolean).reduce((sum,d)=>sum+d.length,0)/descriptions.filter(Boolean).length).toFixed(2)) : 0, veryShort: descriptions.filter((d)=>d.length>0&&d.length<40).length, withHtml: descriptions.filter((d)=>/<[^>]+>/.test(d)).length, withUrl: descriptions.filter((d)=>/https?:\/\//i.test(d)).length, withOddCharacters: descriptions.filter((d)=>/[\uFFFD\u0000-\u0008]/.test(d)).length, repeatedTexts: Array.from(duplicateDescriptions.values()).filter((count)=>count>1).length },
      images: { productsWithoutImage: products.filter((p)=>!p.images.length).length, productsWithMultipleImages: products.filter((p)=>p.images.length>1).length, duplicateUrlsAcrossProducts: imageUrls.length-new Set(imageUrls).size, invalidUrls: invalidImageUrls, perProduct: Object.fromEntries(Array.from(new Set(products.map((p)=>p.images.length))).sort((a,b)=>a-b).map((count)=>[count,products.filter((p)=>p.images.length===count).length])), hosts: Object.fromEntries(Array.from(imageHosts).sort((a,b)=>b[1]-a[1])) },
      variants: { productsWithVariants: products.filter((p)=>p.variants.length>0).length, singleVariantProducts: products.filter((p)=>p.variants.length===1).length, maxVariants: Math.max(...products.map((p)=>p.variants.length)), withoutReliableGtin: products.filter((p)=>!p.variants.some((v)=>v.gtin)).length, distinctSizes: new Set(variants.map((v)=>v.size).filter(Boolean)).size, distinctColours: new Set(variants.map((v)=>v.colour).filter(Boolean)).size, distribution: Object.fromEntries(Array.from(variantDistribution).sort((a,b)=>a[0]-b[0])) },
      offers: { priceMin: Math.min(...prices), priceMax: Math.max(...prices), priceAverage: Number((prices.reduce((a,b)=>a+b,0)/prices.length).toFixed(2)), withoutStock: offers.filter((o)=>o.inStock===false||o.isForSale===false).length, inconsistent: offers.filter((o)=>!Number.isFinite(o.currentPrice)||o.currentPrice<0||o.currency!=="BRL"||o.status!=="paused"||o.active).length, promotion, productsWithConfirmedPromotion: products.filter((p)=>p.offers.some((o)=>o.promotion.status==="PROMOTION_CONFIRMED")).length },
      possibleDuplicates: { repeatedNormalizedNames: Array.from(duplicateNames.values()).filter((count)=>count>1).length, productsInRepeatedNameGroups: Array.from(duplicateNames.values()).filter((count)=>count>1).reduce((a,b)=>a+b,0) },
    };
  }
}
