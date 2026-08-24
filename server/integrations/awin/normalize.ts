import { createHash } from "node:crypto";
import type { AwinFeedItem, AwinInvalidItem, AwinRawEnvelope, NormalizedAwinItem } from "./types";
import { AWIN_PROVIDER } from "./types";

const EMPTY = new Set(["", "null", "undefined", "n/a"]);
const TRUE_VALUES = new Set(["1", "true", "yes", "y", "sim"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "não", "nao"]);

const value = (raw: Record<string, string>, key: string): string | null => {
  const original = raw[key];
  return original == null || EMPTY.has(original.trim().toLowerCase()) ? null : original;
};
const normalizedText = (input: string | null) => input?.trim().toLocaleLowerCase("pt-BR").normalize("NFKC").replace(/\s+/g, " ") ?? "";
const hash = (input: string) => createHash("sha256").update(input).digest("hex");

export function parseAwinNumber(input: string | null): number | null {
  if (input == null) return null;
  const text = input.trim().replace(/\s/g, "");
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\d+(?:,\d+)?)$/.test(text)) return null;
  const result = Number(text.replace(",", "."));
  return Number.isFinite(result) ? result : null;
}

export function parseAwinBoolean(input: string | null): boolean | null {
  if (input == null) return null;
  const normalized = input.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

export function normalizeCurrency(input: string | null): string | null {
  const currency = input?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  try {
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(1);
    return currency;
  } catch {
    return null;
  }
}

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/** Accepts only structurally valid GTIN-8/UPC-12/EAN-13/GTIN-14 values. */
export function isValidAwinGtin(input: string | null | undefined): boolean {
  const candidate = input?.trim() ?? "";
  if (!candidate || !/^\d+$/.test(candidate) || /^0+$/.test(candidate) || !GTIN_LENGTHS.has(candidate.length)) return false;
  const digits = Array.from(candidate, Number);
  const checkDigit = digits.pop()!;
  let sum = 0;
  for (let index = digits.length - 1, position = 0; index >= 0; index--, position++) {
    sum += digits[index] * (position % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10 === checkDigit;
}

function urlIdentity(input: string | null): string | null {
  if (!input) return null;
  try {
    const parsed = new URL(input);
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

function uniqueUrls(raw: Record<string, string>): string[] {
  const names = ["merchant_image_url", "aw_image_url", "merchant_thumb_url", "large_image", "aw_thumb_url", ...Object.keys(raw).filter((key) => /^alternate_image/i.test(key))];
  return Array.from(new Set(names.map((key) => value(raw, key)).filter((item): item is string => Boolean(item))));
}

function rawEnvelope(item: AwinFeedItem, feedId: string, ingestedAt: string): AwinRawEnvelope {
  const merchantId = value(item.raw, "merchant_id") ?? "";
  const awProductId = value(item.raw, "aw_product_id");
  const merchantProductId = value(item.raw, "merchant_product_id");
  const identity = [AWIN_PROVIDER, feedId, merchantId, awProductId ?? merchantProductId ?? `row:${item.rowNumber}`].join(":");
  const canonicalPayload = Object.keys(item.raw).sort().map((key) => `${key}\0${item.raw[key]}`).join("\0");
  return { provider: AWIN_PROVIDER, feedId, merchantId, awProductId, merchantProductId, identityHash: hash(identity), contentHash: hash(canonicalPayload), ingestedAt, payload: { ...item.raw } };
}

export function normalizeAwinItem(item: AwinFeedItem, options: { feedId: string; ingestedAt?: string }): NormalizedAwinItem | AwinInvalidItem {
  const raw = item.raw;
  const merchantId = value(raw, "merchant_id");
  const name = value(raw, "product_name");
  const affiliateUrl = value(raw, "aw_deep_link");
  const priceText = value(raw, "search_price") ?? value(raw, "store_price");
  const currentPrice = parseAwinNumber(priceText);
  const currency = normalizeCurrency(value(raw, "currency"));
  const reasons: string[] = [];
  if (!merchantId) reasons.push("merchant_id ausente");
  if (!name) reasons.push("product_name ausente");
  if (!affiliateUrl) reasons.push("aw_deep_link ausente");
  if (currentPrice == null || currentPrice < 0) reasons.push("preço inválido");
  if (!currency) reasons.push("moeda inválida");
  if (reasons.length) return { rowNumber: item.rowNumber, reasons };

  const parentId = value(raw, "parent_product_id");
  const merchantProductId = value(raw, "merchant_product_id");
  const awProductId = value(raw, "aw_product_id");
  const ean = value(raw, "ean");
  const gtin = value(raw, "product_GTIN") ?? value(raw, "product_gtin");
  const validGtin = isValidAwinGtin(ean) ? ean!.trim() : isValidAwinGtin(gtin) ? gtin!.trim() : null;
  const brand = value(raw, "brand_name");
  const model = value(raw, "product_model") ?? value(raw, "model_number");
  const pageIdentity = urlIdentity(value(raw, "merchant_deep_link"));
  const conceptualIdentity = parentId
    ? `parent:${parentId}`
    : pageIdentity
      ? `page:${pageIdentity}`
      : `descriptor:${normalizedText(brand)}|${normalizedText(name)}|${normalizedText(model)}`;
  const productKey = hash(`${AWIN_PROVIDER}:${merchantId}:${conceptualIdentity}`);
  const size = value(raw, "size_stock_amount");
  const colour = value(raw, "colour");
  // Filled does not mean trustworthy: sentinels such as EAN "0" must not define identity.
  const merchantVariantAttributes = [
    size && `size:${normalizedText(size)}`,
    colour && `colour:${normalizedText(colour)}`,
    value(raw, "size_stock_status") && `size-status:${normalizedText(value(raw, "size_stock_status"))}`,
    value(raw, "model_number") && `model-number:${normalizedText(value(raw, "model_number"))}`,
    value(raw, "product_model") && `model:${normalizedText(value(raw, "product_model"))}`,
  ].filter(Boolean).join("|");
  const variantIdentity = validGtin
    ? `gtin:${validGtin}`
    : merchantProductId
      ? `merchant-product:${merchantProductId}${merchantVariantAttributes ? `|${merchantVariantAttributes}` : ""}`
      : awProductId
        ? `aw-product:${awProductId}`
        : "default";
  const variantKey = hash(`${productKey}:${variantIdentity}`);
  const offerIdentity = awProductId ?? merchantProductId ?? variantKey;
  const offerKey = hash(`${AWIN_PROVIDER}:${merchantId}:${offerIdentity}`);
  const ingestedAt = options.ingestedAt ?? new Date().toISOString();
  const merchantName = value(raw, "merchant_name");

  return {
    productKey, variantKey, offerKey,
    product: {
      name: name!, description: value(raw, "description"), shortDescription: value(raw, "product_short_description"), brand, colour,
      model: value(raw, "product_model"), modelNumber: value(raw, "model_number"), productType: value(raw, "product_type"),
      condition: value(raw, "condition"), specifications: value(raw, "specifications"), keywords: value(raw, "keywords"),
      identifiers: { awProductId, merchantProductId, parentProductId: parentId, ean, upc: value(raw, "upc"), mpn: value(raw, "mpn"), gtin },
      category: { merchantCategory: value(raw, "merchant_category"), name: value(raw, "category_name"), id: value(raw, "category_id"), path: value(raw, "merchant_product_category_path"), second: value(raw, "merchant_product_second_category"), third: value(raw, "merchant_product_third_category"), commissionGroup: value(raw, "commission_group") },
    },
    variant: { size, sizeStockStatus: value(raw, "size_stock_status"), colour, ean, gtin, validGtin },
    offer: {
      merchantId: merchantId!, merchantName, currentPrice: currentPrice!, currency: currency!, affiliateUrl: affiliateUrl!,
      merchantUrl: value(raw, "merchant_deep_link"), basketUrl: value(raw, "basket_link"),
      prices: { search: parseAwinNumber(value(raw, "search_price")), store: parseAwinNumber(value(raw, "store_price")), rrp: parseAwinNumber(value(raw, "rrp_price")), base: parseAwinNumber(value(raw, "base_price")), old: parseAwinNumber(value(raw, "product_price_old")), saving: parseAwinNumber(value(raw, "saving")), savingsPercent: parseAwinNumber(value(raw, "savings_percent")) },
      availability: { inStock: parseAwinBoolean(value(raw, "in_stock")), isForSale: parseAwinBoolean(value(raw, "is_for_sale")), stockQuantity: parseAwinNumber(value(raw, "stock_quantity")), stockStatus: value(raw, "stock_status"), validFrom: value(raw, "valid_from"), validTo: value(raw, "valid_to"), preOrder: parseAwinBoolean(value(raw, "pre_order")), webOffer: parseAwinBoolean(value(raw, "web_offer")) },
      delivery: { cost: parseAwinNumber(value(raw, "delivery_cost")), time: value(raw, "delivery_time"), restrictions: value(raw, "delivery_restrictions"), weight: parseAwinNumber(value(raw, "delivery_weight")) },
    },
    images: uniqueUrls(raw),
    provenance: { provider: AWIN_PROVIDER, merchantId: merchantId!, merchantName, feedId: options.feedId, dataFeedId: value(raw, "data_feed_id"), externalIds: { awProductId, merchantProductId, parentProductId: parentId }, sourceUpdatedAt: value(raw, "last_updated") },
    raw: rawEnvelope(item, options.feedId, ingestedAt),
  };
}

export function isInvalidAwinItem(item: NormalizedAwinItem | AwinInvalidItem): item is AwinInvalidItem {
  return "reasons" in item;
}
