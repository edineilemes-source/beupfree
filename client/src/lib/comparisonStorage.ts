import type {
  ComparableProduct,
  ComparisonStorageDocument,
  ComparisonStorageItem,
} from "@/types/comparison";
import type {
  AttributeProvenance,
  NamedEntitySummary,
  NormalizedAttribute,
  OfferAvailability,
  OfferSummary,
  ProductAttributes,
  ProductSummary,
} from "@/types/products";

export const COMPARISON_STORAGE_KEY = "beupfree:comparison:v1";
export const COMPARISON_STORAGE_VERSION = 1 as const;
export const MAX_COMPARISON_ITEMS = 3;

type UnknownRecord = Record<string, unknown>;

const ATTRIBUTE_PROVENANCES = new Set<AttributeProvenance>([
  "catalog",
  "marketplace_attribute",
  "marketplace_variation",
  "title_inference",
  "unknown",
]);
const OFFER_AVAILABILITIES = new Set<OfferAvailability>([
  "available",
  "sold_out",
  "expired",
  "unknown",
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return value === undefined ? undefined : requiredString(value);
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return value === undefined
    ? undefined
    : typeof value === "number" && Number.isFinite(value)
      ? value
      : undefined;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function sanitizeNamedEntity(value: unknown): NamedEntitySummary | undefined {
  if (!isRecord(value)) return undefined;
  const name = requiredString(value.name);
  if (!name) return undefined;

  return {
    id: optionalString(value.id),
    name,
    slug: optionalString(value.slug),
  };
}

function sanitizeAttributeValue(value: unknown): string | number | boolean | string[] | undefined {
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return [...value];
  }
  return undefined;
}

function sanitizeAttribute(value: unknown): NormalizedAttribute<string | number | boolean | string[]> | undefined {
  if (!isRecord(value)) return undefined;
  const attributeValue = sanitizeAttributeValue(value.value);
  const provenance = value.provenance;
  if (
    attributeValue === undefined ||
    typeof provenance !== "string" ||
    !ATTRIBUTE_PROVENANCES.has(provenance as AttributeProvenance)
  ) {
    return undefined;
  }

  const confidence = optionalFiniteNumber(value.confidence);
  if (value.confidence !== undefined && (confidence == null || confidence < 0 || confidence > 1)) {
    return undefined;
  }

  return {
    value: attributeValue,
    label: optionalString(value.label),
    provenance: provenance as AttributeProvenance,
    confidence,
  };
}

function sanitizeStringAttribute(value: unknown): NormalizedAttribute<string> | undefined {
  const attribute = sanitizeAttribute(value);
  return attribute && typeof attribute.value === "string"
    ? { ...attribute, value: attribute.value }
    : undefined;
}

function sanitizeStringAttributeArray(value: unknown): NormalizedAttribute<string>[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;

  const attributes = value.map(sanitizeStringAttribute);
  return attributes.every((attribute): attribute is NormalizedAttribute<string> => Boolean(attribute))
    ? attributes
    : undefined;
}

function sanitizeExtraAttributes(
  value: unknown,
): ProductAttributes["extra"] | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return undefined;

  const result: NonNullable<ProductAttributes["extra"]> = {};
  for (const [key, rawAttributes] of Object.entries(value)) {
    if (!key.trim() || !Array.isArray(rawAttributes)) return undefined;
    const attributes = rawAttributes.map(sanitizeAttribute);
    if (!attributes.every((attribute): attribute is NonNullable<typeof attribute> => Boolean(attribute))) {
      return undefined;
    }
    result[key] = attributes;
  }
  return result;
}

function sanitizeProductAttributes(value: unknown): ProductAttributes | undefined {
  if (!isRecord(value)) return undefined;

  const colors = sanitizeStringAttributeArray(value.colors);
  const sizes = sanitizeStringAttributeArray(value.sizes);
  const sports = sanitizeStringAttributeArray(value.sports);
  const usageTypes = sanitizeStringAttributeArray(value.usageTypes);
  const gender = value.gender === undefined ? undefined : sanitizeStringAttribute(value.gender);
  const ageGroup = value.ageGroup === undefined ? undefined : sanitizeStringAttribute(value.ageGroup);
  const extra = sanitizeExtraAttributes(value.extra);

  if (
    (value.colors !== undefined && colors === undefined) ||
    (value.sizes !== undefined && sizes === undefined) ||
    (value.sports !== undefined && sports === undefined) ||
    (value.usageTypes !== undefined && usageTypes === undefined) ||
    (value.gender !== undefined && gender === undefined) ||
    (value.ageGroup !== undefined && ageGroup === undefined) ||
    (value.extra !== undefined && extra === undefined)
  ) {
    return undefined;
  }

  return { colors, sizes, gender, ageGroup, sports, usageTypes, extra };
}

function sanitizeProductSummary(value: unknown): ProductSummary | undefined {
  if (!isRecord(value)) return undefined;
  const id = requiredString(value.id);
  const title = requiredString(value.title);
  const attributes = sanitizeProductAttributes(value.attributes);
  if (!id || !title || !attributes) return undefined;

  const rating = optionalFiniteNumber(value.rating);
  const reviewCount = optionalFiniteNumber(value.reviewCount);
  if (
    (value.rating !== undefined && (rating == null || rating <= 0)) ||
    (value.reviewCount !== undefined && (reviewCount == null || reviewCount < 0))
  ) {
    return undefined;
  }

  const brand = value.brand === undefined ? undefined : sanitizeNamedEntity(value.brand);
  const category = value.category === undefined ? undefined : sanitizeNamedEntity(value.category);
  if (
    (value.brand !== undefined && !brand) ||
    (value.category !== undefined && !category)
  ) {
    return undefined;
  }

  return {
    id,
    title,
    imageUrl: optionalString(value.imageUrl),
    brand,
    category,
    rating,
    reviewCount,
    attributes,
  };
}

function sanitizeOfferSummary(value: unknown): OfferSummary | undefined {
  if (!isRecord(value)) return undefined;
  const availability = value.availability;
  if (
    typeof availability !== "string" ||
    !OFFER_AVAILABILITIES.has(availability as OfferAvailability)
  ) {
    return undefined;
  }

  const currentPrice = optionalFiniteNumber(value.currentPrice);
  const originalPrice = optionalFiniteNumber(value.originalPrice);
  const discountPercent = optionalFiniteNumber(value.discountPercent);
  if (
    (value.currentPrice !== undefined && (currentPrice == null || currentPrice <= 0)) ||
    (value.originalPrice !== undefined && (originalPrice == null || originalPrice <= 0)) ||
    (value.discountPercent !== undefined && (
      discountPercent == null || discountPercent < 0 || discountPercent > 100
    )) ||
    (value.freeShipping !== undefined && typeof value.freeShipping !== "boolean") ||
    (value.discountSource !== undefined &&
      value.discountSource !== "informed" && value.discountSource !== "calculated") ||
    (value.lastSeenAt !== undefined && !isValidDate(value.lastSeenAt))
  ) {
    return undefined;
  }

  return {
    id: optionalString(value.id),
    marketplaceId: optionalString(value.marketplaceId),
    marketplaceName: optionalString(value.marketplaceName),
    externalProductId: optionalString(value.externalProductId),
    sellerName: optionalString(value.sellerName),
    currentPrice,
    originalPrice,
    discountPercent,
    discountSource: value.discountSource as OfferSummary["discountSource"],
    currency: optionalString(value.currency),
    freeShipping: value.freeShipping as boolean | undefined,
    offerUrl: optionalString(value.offerUrl),
    availability: availability as OfferAvailability,
    lastSeenAt: value.lastSeenAt as string | undefined,
  };
}

export function sanitizeComparableProduct(value: unknown): ComparableProduct | undefined {
  if (!isRecord(value) || !isValidDate(value.selectedAt)) return undefined;
  const product = sanitizeProductSummary(value.product);
  if (!product) return undefined;

  const selectedOffer = value.selectedOffer === undefined
    ? undefined
    : sanitizeOfferSummary(value.selectedOffer);
  if (value.selectedOffer !== undefined && !selectedOffer) return undefined;

  return { product, selectedOffer, selectedAt: value.selectedAt };
}

function sanitizeStorageItem(value: unknown): ComparisonStorageItem | undefined {
  if (!isRecord(value) || !isValidDate(value.selectedAt)) return undefined;
  const productId = requiredString(value.productId);
  const selectedOfferId = optionalString(value.selectedOfferId);
  const snapshot = sanitizeComparableProduct(value.snapshot);
  if (
    !productId ||
    !snapshot ||
    productId !== snapshot.product.id ||
    value.selectedAt !== snapshot.selectedAt ||
    (selectedOfferId !== undefined && selectedOfferId !== snapshot.selectedOffer?.id)
  ) {
    return undefined;
  }

  return { productId, selectedOfferId, selectedAt: value.selectedAt, snapshot };
}

export function parseComparisonDocument(raw: string | null): ComparableProduct[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== COMPARISON_STORAGE_VERSION || !Array.isArray(parsed.items)) {
      return [];
    }

    const unique = new Map<string, ComparableProduct>();
    for (const value of parsed.items) {
      const item = sanitizeStorageItem(value);
      if (item && !unique.has(item.productId)) {
        unique.set(item.productId, item.snapshot);
      }
      if (unique.size === MAX_COMPARISON_ITEMS) break;
    }
    return Array.from(unique.values());
  } catch {
    return [];
  }
}

export function readComparison(): ComparableProduct[] {
  if (typeof window === "undefined") return [];
  try {
    return parseComparisonDocument(window.localStorage.getItem(COMPARISON_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function writeComparison(items: ComparableProduct[]): void {
  if (typeof window === "undefined") return;

  const document: ComparisonStorageDocument = {
    version: COMPARISON_STORAGE_VERSION,
    items: items.slice(0, MAX_COMPARISON_ITEMS).map((snapshot) => ({
      productId: snapshot.product.id,
      selectedOfferId: snapshot.selectedOffer?.id,
      selectedAt: snapshot.selectedAt,
      snapshot,
    })),
  };

  try {
    window.localStorage.setItem(COMPARISON_STORAGE_KEY, JSON.stringify(document));
  } catch {
    // O estado em memória continua funcional quando o armazenamento falha.
  }
}

export function clearComparisonStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(COMPARISON_STORAGE_KEY);
  } catch {
    // O estado em memória continua funcional quando o armazenamento falha.
  }
}
