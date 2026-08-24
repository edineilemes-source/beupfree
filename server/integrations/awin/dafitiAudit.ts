import { performance } from "node:perf_hooks";
import type { Readable } from "node:stream";
import { parseAwinCsv } from "./csv";
import { isInvalidAwinItem, isValidAwinGtin, normalizeAwinItem, parseAwinBoolean } from "./normalize";

export type SneakerClassification = "FOOTWEAR_SNEAKER_CONFIRMED" | "FOOTWEAR_SNEAKER_UNCERTAIN" | "NOT_SNEAKER";
export type PromotionClassification = "PROMOTION_CONFIRMED" | "PROMOTION_UNCERTAIN" | "NOT_PROMOTIONAL";

const STRUCTURED_CATEGORY_FIELDS = [
  "merchant_category", "merchant_product_category_path", "merchant_product_second_category",
  "merchant_product_third_category", "category_name", "product_type", "Fashion:category",
] as const;
const IMAGE_FIELDS = ["merchant_image_url", "aw_image_url", "merchant_thumb_url", "large_image", "aw_thumb_url", "alternate_image", "alternate_image_two", "alternate_image_three", "alternate_image_four"];
const RELEVANT_FIELDS = ["product_name", "merchant_product_id", "aw_product_id", "merchant_deep_link", "aw_deep_link", "search_price", "product_price_old", "brand_name", "merchant_image_url", "description", "ean", "parent_product_id", "colour", "Fashion:size", "in_stock", "stock_status"];

const clean = (value: string | null | undefined) => (value ?? "").trim();
const fold = (value: string | null | undefined) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const percent = (count: number, total: number) => total ? round(count * 100 / total) : 0;
const unique = (values: Array<string | null | undefined>) => Array.from(new Set(values.map(clean).filter(Boolean)));

export function parseDafitiMoney(input: string | null | undefined): number | null {
  let text = clean(input).replace(/\s+/g, " ").replace(/^(?:R\$|BRL)\s*/i, "").replace(/\s*(?:BRL|R\$)$/i, "").trim();
  if (!text) return null;
  if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^[+-]?\d+(?:,\d+)?$/.test(text)) text = text.replace(",", ".");
  else if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function classifyDafitiSneaker(raw: Record<string, string>): { classification: SneakerClassification; evidence: string[]; use: string } {
  const evidence = STRUCTURED_CATEGORY_FIELDS.flatMap((field) => {
    const observed = fold(raw[field]);
    return observed ? [`${field}:${observed}`] : [];
  });
  const categories = evidence.map((item) => item.slice(item.indexOf(":") + 1));
  const structuredSneaker = categories.some((item) => /(^|[>\/|;, -])(?:tenis|sneaker)(?:$|[>\/|;, -])/.test(` ${item} `));
  const name = fold(raw.product_name);
  const genericFootwear = categories.some((item) => /calcados?|footwear|sapatos?/.test(item));
  const nameSneaker = /(^|\s)(?:tenis|sneaker)(?:\s|$)/.test(name);
  const classification: SneakerClassification = structuredSneaker
    ? "FOOTWEAR_SNEAKER_CONFIRMED"
    : nameSneaker || (genericFootwear && /sapateni|running|corrida/.test(name))
      ? "FOOTWEAR_SNEAKER_UNCERTAIN" : "NOT_SNEAKER";
  const useText = `${categories.join(" ")} ${name}`;
  const use = /futsal/.test(useText) ? "futsal"
    : /futebol|chuteira/.test(useText) ? "futebol"
      : /corrida|running/.test(useText) ? "corrida"
        : /caminhada|walking/.test(useText) ? "caminhada"
          : /academia|treino|training|fitness/.test(useText) ? "academia/treino"
            : /skate/.test(useText) ? "skate"
              : /casual|sapateni/.test(useText) ? "casual"
                : /performance|esportivo/.test(useText) ? "performance" : "outros usos";
  return { classification, evidence, use };
}

export function classifyDafitiPromotion(raw: Record<string, string>) {
  const current = parseDafitiMoney(raw.search_price);
  const old = parseDafitiMoney(raw.product_price_old);
  let classification: PromotionClassification = "PROMOTION_UNCERTAIN";
  if (current != null && old != null && current > 0 && old > current) classification = "PROMOTION_CONFIRMED";
  else if (current != null && old != null && current > 0 && old === current) classification = "NOT_PROMOTIONAL";
  else if (current != null && old != null && current > 0 && old < current) classification = "PROMOTION_UNCERTAIN";
  return { classification, current, old, discountPercent: classification === "PROMOTION_CONFIRMED" ? (old! - current!) / old! * 100 : null };
}

function canonicalMerchantUrl(input: string | undefined): string | null {
  try {
    const url = new URL(clean(input));
    return `${url.hostname.toLowerCase().replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "") || "/"}`;
  } catch { return null; }
}

function host(input: string | undefined): string | null {
  try { return new URL(clean(input)).hostname.toLowerCase(); } catch { return null; }
}

function validUrl(input: string | undefined): boolean {
  try { const url = new URL(clean(input)); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
}

function productIdentity(raw: Record<string, string>): { key: string | null; basis: string; reliable: boolean } {
  const merchant = clean(raw.merchant_id);
  const parent = clean(raw.parent_product_id);
  if (merchant && parent) return { key: `${merchant}:parent:${parent}`, basis: "parent_product_id", reliable: true };
  const page = canonicalMerchantUrl(raw.merchant_deep_link);
  if (merchant && page) return { key: `${merchant}:url:${page}`, basis: "canonical_merchant_url", reliable: true };
  const model = clean(raw.product_model) || clean(raw.model_number) || clean(raw.mpn);
  if (merchant && model) return { key: `${merchant}:model:${fold(raw.brand_name)}:${fold(model)}`, basis: "brand_model_fallback", reliable: false };
  return { key: null, basis: "none", reliable: false };
}

function variantIdentity(raw: Record<string, string>, productKey: string | null): { key: string | null; basis: string } {
  if (!productKey) return { key: null, basis: "none" };
  const gtin = [raw.ean, raw.product_GTIN, raw.product_gtin, raw.upc].map(clean).find(isValidAwinGtin);
  if (gtin) return { key: `${productKey}:gtin:${gtin}`, basis: "valid_gtin" };
  const merchantProduct = clean(raw.merchant_product_id);
  if (merchantProduct) return { key: `${productKey}:merchant-product:${merchantProduct}`, basis: "merchant_product_id" };
  const awProduct = clean(raw.aw_product_id);
  return awProduct ? { key: `${productKey}:aw-product:${awProduct}`, basis: "aw_product_id" } : { key: null, basis: "none" };
}

function offerIdentity(raw: Record<string, string>): string | null {
  const merchant = clean(raw.merchant_id), external = clean(raw.aw_product_id) || clean(raw.merchant_product_id);
  return merchant && external ? `${merchant}:${external}` : null;
}

function inStock(raw: Record<string, string>): boolean {
  const parsed = parseAwinBoolean(clean(raw.in_stock) || null);
  if (parsed != null) return parsed;
  return [raw.stock_status, raw.size_stock_status].some((value) => /^(?:in stock|available|em estoque)$/i.test(clean(value)));
}

type CandidateVariant = { key: string; size: string | null; colour: string | null; gtin: string | null; offerKey: string | null };
type CandidateProduct = {
  key: string; name: string; brand: string; oldPrice: number; currentPrice: number; discount: number; use: string;
  variants: Map<string, CandidateVariant>; offerKeys: Set<string>; sizes: Set<string>; colours: Set<string>; images: Set<string>;
  description: string; affiliate: boolean; available: boolean;
};

type Distribution = { bucket: string; products: number; variants: number };

function stats(values: number[]) {
  if (!values.length) return { min: null, mean: null, median: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { min: round(sorted[0]), mean: round(sorted.reduce((sum, item) => sum + item, 0) / sorted.length), median: round(median), max: round(sorted.at(-1)!) };
}

function distributions(products: CandidateProduct[], buckets: Array<{ bucket: string; accepts: (value: number) => boolean }>, field: "discount" | "currentPrice"): Distribution[] {
  return buckets.map(({ bucket, accepts }) => {
    const selected = products.filter((product) => accepts(product[field]));
    return { bucket, products: selected.length, variants: selected.reduce((sum, product) => sum + product.variants.size, 0) };
  });
}

export async function auditDafitiFeed(input: Readable, metadata: { file: string; compressedBytes: number; gzipValid: boolean; encoding: string; delimiter: string }) {
  const started = performance.now();
  const fieldCounts = new Map<string, number>(), categories = new Map<string, number>(), brandsAll = new Set<string>();
  const merchantCounts = new Map<string, { names: Set<string>; feedIds: Set<string>; rows: number }>();
  const sneakerClasses = new Map<SneakerClassification, number>(), promotionClasses = new Map<PromotionClassification, number>();
  const sneakerUses = new Map<string, number>(), invalidReasons = new Map<string, number>(), imageHosts = new Map<string, number>(), affiliateHosts = new Map<string, number>(), merchantHosts = new Map<string, number>();
  const candidateProducts = new Map<string, CandidateProduct>(), candidateVariants = new Set<string>(), candidateOffers = new Set<string>();
  const confirmedSneakerProducts = new Set<string>(), confirmedSneakerVariants = new Set<string>(), confirmedSneakerOffers = new Set<string>();
  const rawNameCounts = new Map<string, number>(), descriptionCounts = new Map<string, number>(), imageUrlCounts = new Map<string, number>();
  const eanProducts = new Map<string, Set<string>>(), productUrls = new Map<string, Set<string>>(), variantCounts = new Map<string, number>(), offerCounts = new Map<string, number>();
  const distinctSizes = new Map<string, number>(), distinctColours = new Map<string, number>();
  const candidateSizeRows = new Map<string, number>(), candidateColourRows = new Map<string, number>();
  const productBasis = new Map<string, number>(), variantBasis = new Map<string, number>();
  const priceIssues: Record<string, number> = { currentZero: 0, currentNegative: 0, oldZero: 0, oldNegative: 0, oldBelowCurrent: 0, discountOver100: 0, currentOver100000: 0, oldOver100000: 0 };
  let headers: string[] = [], rawRows = 0, validRows = 0, invalidRows = 0, replacementCharacters = 0;
  let sneakerConfirmedPromotion = 0, sneakerConfirmedPromotionInStock = 0, funnelAffiliate = 0, funnelImage = 0, funnelBrand = 0, minimumValidRows = 0;
  let withEanRaw = 0, withValidGtin = 0, withImages = 0, withDescription = 0, descriptionsWithHtml = 0, descriptionLengthTotal = 0, affiliateLinks = 0, merchantLinks = 0;
  let normalizationMs = 0;

  for await (const row of parseAwinCsv(input)) {
    rawRows++;
    if (!headers.length) headers = Object.keys(row.raw);
    for (const [field, observed] of Object.entries(row.raw)) {
      if (clean(observed)) fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
      replacementCharacters += (observed.match(/\uFFFD/g) ?? []).length;
    }
    const merchantId = clean(row.raw.merchant_id) || "[missing]";
    const merchant = merchantCounts.get(merchantId) ?? { names: new Set(), feedIds: new Set(), rows: 0 };
    merchant.rows++; if (clean(row.raw.merchant_name)) merchant.names.add(clean(row.raw.merchant_name)); if (clean(row.raw.data_feed_id)) merchant.feedIds.add(clean(row.raw.data_feed_id)); merchantCounts.set(merchantId, merchant);
    for (const field of STRUCTURED_CATEGORY_FIELDS) if (clean(row.raw[field])) categories.set(`${field}:${clean(row.raw[field])}`, (categories.get(`${field}:${clean(row.raw[field])}`) ?? 0) + 1);
    if (clean(row.raw.brand_name)) brandsAll.add(fold(row.raw.brand_name));
    const normalizedStarted = performance.now();
    const normalized = normalizeAwinItem(row, { feedId: metadata.file, ingestedAt: "audit" });
    normalizationMs += performance.now() - normalizedStarted;
    if (isInvalidAwinItem(normalized)) { invalidRows++; for (const reason of normalized.reasons) invalidReasons.set(reason, (invalidReasons.get(reason) ?? 0) + 1); }
    else validRows++;

    const sneaker = classifyDafitiSneaker(row.raw);
    sneakerClasses.set(sneaker.classification, (sneakerClasses.get(sneaker.classification) ?? 0) + 1);
    if (sneaker.classification === "FOOTWEAR_SNEAKER_CONFIRMED") sneakerUses.set(sneaker.use, (sneakerUses.get(sneaker.use) ?? 0) + 1);
    const promo = classifyDafitiPromotion(row.raw);
    promotionClasses.set(promo.classification, (promotionClasses.get(promo.classification) ?? 0) + 1);
    if (promo.current === 0) priceIssues.currentZero++; if (promo.current != null && promo.current < 0) priceIssues.currentNegative++;
    if (promo.old === 0) priceIssues.oldZero++; if (promo.old != null && promo.old < 0) priceIssues.oldNegative++;
    if (promo.old != null && promo.current != null && promo.old < promo.current) priceIssues.oldBelowCurrent++;
    if (promo.discountPercent != null && promo.discountPercent > 100) priceIssues.discountOver100++;
    if (promo.current != null && promo.current > 100000) priceIssues.currentOver100000++; if (promo.old != null && promo.old > 100000) priceIssues.oldOver100000++;
    const identity = productIdentity(row.raw), variant = variantIdentity(row.raw, identity.key), offer = offerIdentity(row.raw);
    productBasis.set(identity.basis, (productBasis.get(identity.basis) ?? 0) + 1); variantBasis.set(variant.basis, (variantBasis.get(variant.basis) ?? 0) + 1);
    if (identity.key) { const urls = productUrls.get(identity.key) ?? new Set(); const url = canonicalMerchantUrl(row.raw.merchant_deep_link); if (url) urls.add(url); productUrls.set(identity.key, urls); }
    if (variant.key) variantCounts.set(variant.key, (variantCounts.get(variant.key) ?? 0) + 1); if (offer) offerCounts.set(offer, (offerCounts.get(offer) ?? 0) + 1);
    const ean = clean(row.raw.ean) || clean(row.raw.product_GTIN) || clean(row.raw.upc);
    if (ean) { withEanRaw++; if (isValidAwinGtin(ean)) { withValidGtin++; if (identity.key) { const ids = eanProducts.get(ean) ?? new Set(); ids.add(identity.key); eanProducts.set(ean, ids); } } }
    const name = fold(row.raw.product_name); if (name) rawNameCounts.set(name, (rawNameCounts.get(name) ?? 0) + 1);
    const description = clean(row.raw.description);
    if (description) { withDescription++; descriptionLengthTotal += description.length; if (/<[a-z][\s\S]*>/i.test(description)) descriptionsWithHtml++; descriptionCounts.set(description, (descriptionCounts.get(description) ?? 0) + 1); }
    const images = unique(IMAGE_FIELDS.map((field) => row.raw[field]));
    if (images.length) withImages++;
    for (const url of images) { imageUrlCounts.set(url, (imageUrlCounts.get(url) ?? 0) + 1); const observedHost = host(url); if (observedHost) imageHosts.set(observedHost, (imageHosts.get(observedHost) ?? 0) + 1); }
    if (clean(row.raw.aw_deep_link)) { affiliateLinks++; const observedHost = host(row.raw.aw_deep_link); if (observedHost) affiliateHosts.set(observedHost, (affiliateHosts.get(observedHost) ?? 0) + 1); }
    if (clean(row.raw.merchant_deep_link)) { merchantLinks++; const observedHost = host(row.raw.merchant_deep_link); if (observedHost) merchantHosts.set(observedHost, (merchantHosts.get(observedHost) ?? 0) + 1); }
    const size = clean(row.raw["Fashion:size"]) || clean(row.raw.size_stock_amount); if (size) distinctSizes.set(size, (distinctSizes.get(size) ?? 0) + 1);
    const colour = clean(row.raw.colour); if (colour) distinctColours.set(colour, (distinctColours.get(colour) ?? 0) + 1);

    if (sneaker.classification !== "FOOTWEAR_SNEAKER_CONFIRMED") continue;
    if (identity.key) confirmedSneakerProducts.add(identity.key); if (variant.key) confirmedSneakerVariants.add(variant.key); if (offer) confirmedSneakerOffers.add(offer);
    if (promo.classification !== "PROMOTION_CONFIRMED") continue;
    sneakerConfirmedPromotion++;
    if (!inStock(row.raw)) continue;
    sneakerConfirmedPromotionInStock++;
    const affiliateOk = validUrl(row.raw.aw_deep_link); if (!affiliateOk) continue; funnelAffiliate++;
    const validImages = images.filter(validUrl); if (!validImages.length) continue; funnelImage++;
    const brand = clean(row.raw.brand_name); if (!brand) continue; funnelBrand++;
    const merchantUrlOk = validUrl(row.raw.merchant_deep_link);
    const minimumOk = !isInvalidAwinItem(normalized) && identity.reliable && Boolean(identity.key && variant.key && offer) && merchantUrlOk && promo.current! > 0 && promo.old! > promo.current!;
    if (!minimumOk) continue;
    minimumValidRows++;
    if (size) candidateSizeRows.set(size, (candidateSizeRows.get(size) ?? 0) + 1);
    if (colour) candidateColourRows.set(colour, (candidateColourRows.get(colour) ?? 0) + 1);
    candidateVariants.add(variant.key!); candidateOffers.add(offer!);
    const product = candidateProducts.get(identity.key!) ?? {
      key: identity.key!, name: clean(row.raw.product_name), brand, oldPrice: promo.old!, currentPrice: promo.current!, discount: promo.discountPercent!, use: sneaker.use,
      variants: new Map(), offerKeys: new Set(), sizes: new Set(), colours: new Set(), images: new Set(), description, affiliate: true, available: true,
    };
    if (promo.discountPercent! > product.discount || (promo.discountPercent === product.discount && promo.current! < product.currentPrice)) {
      product.oldPrice = promo.old!; product.currentPrice = promo.current!; product.discount = promo.discountPercent!;
    }
    product.variants.set(variant.key!, { key: variant.key!, size: size || null, colour: colour || null, gtin: isValidAwinGtin(ean) ? ean : null, offerKey: offer });
    product.offerKeys.add(offer!); if (size) product.sizes.add(size); if (colour) product.colours.add(colour); for (const image of validImages) product.images.add(image);
    candidateProducts.set(identity.key!, product);
  }

  const elapsedMs = performance.now() - started;
  const products = Array.from(candidateProducts.values());
  const byBrand = new Map<string, CandidateProduct[]>();
  for (const product of products) { const key = product.brand; const list = byBrand.get(key) ?? []; list.push(product); byBrand.set(key, list); }
  const brandRanking = Array.from(byBrand, ([brand, list]) => ({
    brand, products: list.length, variants: list.reduce((sum, item) => sum + item.variants.size, 0), offers: list.reduce((sum, item) => sum + item.offerKeys.size, 0), promotions: list.length,
    averageDiscountPercent: round(list.reduce((sum, item) => sum + item.discount, 0) / list.length), maximumDiscountPercent: round(Math.max(...list.map((item) => item.discount))),
    minimumPrice: round(Math.min(...list.map((item) => item.currentPrice))), maximumPrice: round(Math.max(...list.map((item) => item.currentPrice))),
  })).sort((a, b) => b.products - a.products || a.brand.localeCompare(b.brand, "pt-BR"));
  const discountBuckets = [
    { bucket: "0–9%", accepts: (v: number) => v < 10 }, { bucket: "10–19%", accepts: (v: number) => v >= 10 && v < 20 }, { bucket: "20–29%", accepts: (v: number) => v >= 20 && v < 30 },
    { bucket: "30–39%", accepts: (v: number) => v >= 30 && v < 40 }, { bucket: "40–49%", accepts: (v: number) => v >= 40 && v < 50 }, { bucket: "50–59%", accepts: (v: number) => v >= 50 && v < 60 },
    { bucket: "60–69%", accepts: (v: number) => v >= 60 && v < 70 }, { bucket: "70%+", accepts: (v: number) => v >= 70 },
  ];
  const priceBuckets = [
    { bucket: "até R$199", accepts: (v: number) => v < 200 }, { bucket: "R$200–299", accepts: (v: number) => v >= 200 && v < 300 }, { bucket: "R$300–399", accepts: (v: number) => v >= 300 && v < 400 },
    { bucket: "R$400–499", accepts: (v: number) => v >= 400 && v < 500 }, { bucket: "R$500–699", accepts: (v: number) => v >= 500 && v < 700 }, { bucket: "R$700–999", accepts: (v: number) => v >= 700 && v < 1000 }, { bucket: "R$1.000+", accepts: (v: number) => v >= 1000 },
  ];
  const memory = process.memoryUsage(), resources = process.resourceUsage();
  const duplicates = {
    productsWithMultipleCanonicalUrls: Array.from(productUrls.values()).filter((urls) => urls.size > 1).length,
    validGtinsAcrossProducts: Array.from(eanProducts.values()).filter((ids) => ids.size > 1).length,
    repeatedNormalizedNames: Array.from(rawNameCounts.values()).filter((count) => count > 1).length,
    repeatedDescriptions: Array.from(descriptionCounts.values()).filter((count) => count > 1).length,
    repeatedVariants: Array.from(variantCounts.values()).filter((count) => count > 1).length,
    repeatedOffers: Array.from(offerCounts.values()).filter((count) => count > 1).length,
  };
  return {
    audit: "DAFITI001", generatedAt: new Date().toISOString(), file: metadata,
    format: { encoding: metadata.encoding, replacementCharacters, delimiter: metadata.delimiter, lines: rawRows + 1, columns: headers.length, fields: headers },
    merchants: Array.from(merchantCounts, ([merchantId, item]) => ({ merchantId, merchantNames: Array.from(item.names), dataFeedIds: Array.from(item.feedIds), rows: item.rows })),
    rows: { raw: rawRows, valid: validRows, invalid: invalidRows, invalidReasons: Object.fromEntries(invalidReasons) },
    candidatesGeneral: { products: productUrls.size, variants: variantCounts.size, offers: offerCounts.size },
    coverage: {
      brandsDistinct: brandsAll.size, withEanRaw, withValidGtin, withImages, withDescription, affiliateLinks, merchantLinks,
      mostPopulatedFields: Array.from(fieldCounts).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([field, count]) => ({ field, count, percent: percent(count, rawRows) })),
      relevantEmptyFields: RELEVANT_FIELDS.map((field) => ({ field, empty: rawRows - (fieldCounts.get(field) ?? 0), percent: percent(rawRows - (fieldCounts.get(field) ?? 0), rawRows) })).sort((a, b) => b.empty - a.empty),
    },
    categories: Array.from(categories, ([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    sneakerClassification: { counts: Object.fromEntries(sneakerClasses), confirmedProducts: confirmedSneakerProducts.size, confirmedVariants: confirmedSneakerVariants.size, confirmedOffers: confirmedSneakerOffers.size, uses: Object.fromEntries(Array.from(sneakerUses).sort((a, b) => b[1] - a[1])) },
    promotionClassification: { counts: Object.fromEntries(promotionClasses), priceIssues },
    funnel: {
      feedTotal: rawRows, sneakerConfirmed: sneakerClasses.get("FOOTWEAR_SNEAKER_CONFIRMED") ?? 0, sneakerPromotionConfirmed: sneakerConfirmedPromotion,
      inStock: sneakerConfirmedPromotionInStock, withAffiliateUrl: funnelAffiliate, withImage: funnelImage, withBrand: funnelBrand,
      candidatesUpPulseRows: minimumValidRows, uniqueProducts: products.length, variants: candidateVariants.size, offers: candidateOffers.size,
    },
    identity: { productBasisRows: Object.fromEntries(productBasis), variantBasisRows: Object.fromEntries(variantBasis), candidateProducts: products.length, candidateVariants: candidateVariants.size, candidateOffers: candidateOffers.size },
    brands: brandRanking,
    discountDistribution: distributions(products, discountBuckets, "discount"), priceDistribution: distributions(products, priceBuckets, "currentPrice"),
    discountStats: stats(products.map((item) => item.discount)), priceStats: stats(products.map((item) => item.currentPrice)),
    gtin: { raw: withEanRaw, valid: withValidGtin, invalid: withEanRaw - withValidGtin, candidatesWithValidGtin: products.reduce((sum, item) => sum + Number(Array.from(item.variants.values()).some((variant) => variant.gtin)), 0) },
    sizes: { feedDistinct: distinctSizes.size, candidateDistinct: candidateSizeRows.size, candidateDistribution: Array.from(candidateSizeRows, ([size, count]) => ({ size, count })).sort((a, b) => b.count - a.count), candidateProductsMultipleSizes: products.filter((item) => item.sizes.size > 1).length, candidateProductsSingleVariant: products.filter((item) => item.variants.size === 1).length },
    colours: { feedDistinct: distinctColours.size, candidateDistinct: candidateColourRows.size, candidateDistribution: Array.from(candidateColourRows, ([colour, count]) => ({ colour, count })).sort((a, b) => b.count - a.count) },
    images: { rowsWithImage: withImages, rowsWithoutImage: rawRows - withImages, distinctUrls: imageUrlCounts.size, duplicatedUrls: Array.from(imageUrlCounts.values()).filter((count) => count > 1).length, hosts: Object.fromEntries(Array.from(imageHosts).sort((a, b) => b[1] - a[1])), candidateProductsWithoutImage: products.filter((item) => !item.images.size).length, imagesPerCandidateProduct: stats(products.map((item) => item.images.size)) },
    descriptions: { filled: withDescription, empty: rawRows - withDescription, html: descriptionsWithHtml, averageLength: withDescription ? round(descriptionLengthTotal / withDescription) : null, distinct: descriptionCounts.size, repeatedValues: duplicates.repeatedDescriptions, candidateProductsSharingAcrossVariants: products.filter((item) => item.variants.size > 1 && item.description).length },
    links: { affiliate: { filled: affiliateLinks, empty: rawRows - affiliateLinks, hosts: Object.fromEntries(Array.from(affiliateHosts).sort((a, b) => b[1] - a[1])) }, merchant: { filled: merchantLinks, empty: rawRows - merchantLinks, hosts: Object.fromEntries(Array.from(merchantHosts).sort((a, b) => b[1] - a[1])) }, fullUrlsExposed: false },
    duplicates,
    top50CommercialOpportunities: products.sort((a, b) => b.discount - a.discount || a.currentPrice - b.currentPrice || Number(b.available) - Number(a.available) || a.name.localeCompare(b.name, "pt-BR")).slice(0, 50).map((item) => ({ brand: item.brand, name: item.name, oldPrice: round(item.oldPrice), currentPrice: round(item.currentPrice), discountPercent: round(item.discount), variants: item.variants.size, sizes: Array.from(item.sizes).sort(), imageAvailable: item.images.size > 0, affiliateLinkAvailable: item.affiliate })),
    performance: { elapsedMs: round(elapsedMs), normalizationMs: round(normalizationMs), rowsPerSecond: round(rawRows / (elapsedMs / 1000)), compressedMegabytesPerSecond: round(metadata.compressedBytes / 1024 / 1024 / (elapsedMs / 1000)), peakRssApproxBytes: resources.maxRSS * 1024, rssBytesAtEnd: memory.rss, heapUsedBytesAtEnd: memory.heapUsed, architecture: "single-pass stream; bounded aggregate maps; no raw-row retention" },
  };
}
