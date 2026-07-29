import {
  ageOf,
  genderOf,
  modalityOf,
  normalizeColor,
  sizeOf,
  type CatalogBestOffer,
  type CatalogProduct,
} from "@/lib/catalogFilters";
import type { ComparableProduct } from "@/types/comparison";
import type {
  AttributeProvenance,
  NormalizedAttribute,
  OfferSummary,
  ProductAttributes,
  ProductSummary,
} from "@/types/products";

export interface ComparisonProductCardSource {
  id: string;
  name: string;
  image: string;
  brand: string;
  category: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  affiliateUrl: string;
  marketplaceName?: string;
  sellerName?: string;
  freeShipping?: boolean;
  averageRating?: number | null;
  totalReviews?: number;
  soldOut?: boolean;
}

export type ComparisonProductSource = CatalogProduct | ComparisonProductCardSource;

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.trim() === "") return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  const parsed = finiteNumber(value);
  return parsed != null && parsed > 0 ? parsed : undefined;
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function confidenceOf(value: unknown): number | undefined {
  const confidence = finiteNumber(value);
  return confidence != null && confidence >= 0 && confidence <= 1
    ? confidence
    : undefined;
}

type CatalogColorSource = NonNullable<CatalogProduct["colors"]>[number]["source"];

function colorProvenance(source: CatalogColorSource): AttributeProvenance {
  return source ?? "unknown";
}

function colorAttributes(product: CatalogProduct): NormalizedAttribute<string>[] | undefined {
  const colors = new Map<string, NormalizedAttribute<string>>();

  for (const color of product.colors ?? []) {
    const normalized = normalizeColor(color.name || color.normalized);
    if (!normalized || colors.has(normalized.value)) continue;

    colors.set(normalized.value, {
      value: normalized.value,
      label: normalized.label,
      provenance: colorProvenance(color.source),
      confidence: confidenceOf(color.confidence),
    });
  }

  if (colors.size === 0) {
    const primaryColor = normalizeColor(product.primaryColor);
    if (primaryColor) {
      colors.set(primaryColor.value, {
        value: primaryColor.value,
        label: primaryColor.label,
        provenance: "catalog",
      });
    }
  }

  return colors.size > 0 ? Array.from(colors.values()) : undefined;
}

function inferredAttribute(value: string | null): NormalizedAttribute<string> | undefined {
  return value
    ? { value, label: value, provenance: "title_inference" }
    : undefined;
}

function productAttributes(product: CatalogProduct): ProductAttributes {
  const colors = colorAttributes(product);
  const gender = inferredAttribute(genderOf(product));
  const size = inferredAttribute(sizeOf(product));
  const ageGroup = ageOf(product) === "Infantil"
    ? inferredAttribute("Infantil")
    : undefined;
  const modality = modalityOf(product);
  const sports = modality && modality !== "Casual"
    ? [inferredAttribute(modality)!]
    : undefined;
  const usageTypes = modality === "Casual"
    ? [inferredAttribute(modality)!]
    : undefined;

  return {
    colors,
    sizes: size ? [size] : undefined,
    gender,
    ageGroup,
    sports,
    usageTypes,
  };
}

function productSummary(product: CatalogProduct): ProductSummary {
  const rating = positiveNumber(product.averageRating);
  const reviewCount = finiteNumber(product.totalReviews);
  const brandName = nonEmpty(product.brand?.name);
  const categoryName = nonEmpty(product.category?.name);

  return {
    id: product.id,
    title: product.mainName,
    imageUrl: nonEmpty(product.mainImageUrl),
    brand: brandName
      ? { name: brandName, slug: nonEmpty(product.brand?.slug) }
      : undefined,
    category: categoryName
      ? { name: categoryName, slug: nonEmpty(product.category?.slug) }
      : undefined,
    rating,
    reviewCount: reviewCount != null && reviewCount >= 0
      ? Math.trunc(reviewCount)
      : undefined,
    attributes: productAttributes(product),
  };
}

function offerSummary(offer: CatalogBestOffer): OfferSummary {
  const currentPrice = positiveNumber(offer.currentPrice);
  const originalPrice = positiveNumber(offer.originalPrice);
  const informedDiscount = finiteNumber(offer.discountPercent);
  const validInformedDiscount = informedDiscount != null &&
    informedDiscount >= 0 && informedDiscount <= 100
    ? informedDiscount
    : undefined;
  const calculatedDiscount = validInformedDiscount == null &&
    currentPrice != null && originalPrice != null && originalPrice > currentPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : undefined;
  const discountPercent = validInformedDiscount ?? calculatedDiscount;

  return {
    id: nonEmpty(offer.id),
    marketplaceName: nonEmpty(offer.marketplaceName),
    sellerName: nonEmpty(offer.sellerName),
    currentPrice,
    originalPrice,
    discountPercent,
    discountSource: validInformedDiscount != null
      ? "informed"
      : calculatedDiscount != null
        ? "calculated"
        : undefined,
    freeShipping: typeof offer.freeShipping === "boolean"
      ? offer.freeShipping
      : undefined,
    offerUrl: nonEmpty(offer.affiliateUrl),
    availability: "unknown",
    lastSeenAt: nonEmpty(offer.lastSeenAt),
  };
}

function cardProductSummary(source: ComparisonProductCardSource): ProductSummary {
  const rating = positiveNumber(source.averageRating);
  const reviewCount = finiteNumber(source.totalReviews);
  const brandName = nonEmpty(source.brand);
  const categoryName = nonEmpty(source.category);

  return {
    id: source.id,
    title: source.name,
    imageUrl: nonEmpty(source.image),
    brand: brandName ? { name: brandName } : undefined,
    category: categoryName ? { name: categoryName } : undefined,
    rating,
    reviewCount: reviewCount != null && reviewCount >= 0
      ? Math.trunc(reviewCount)
      : undefined,
    attributes: {},
  };
}

function cardOfferSummary(source: ComparisonProductCardSource): OfferSummary | undefined {
  const currentPrice = positiveNumber(source.price);
  const originalPrice = positiveNumber(source.oldPrice);
  const informedDiscount = finiteNumber(source.discount);
  const validInformedDiscount = informedDiscount != null &&
    informedDiscount >= 0 && informedDiscount <= 100
    ? informedDiscount
    : undefined;
  const calculatedDiscount = validInformedDiscount == null &&
    currentPrice != null && originalPrice != null && originalPrice > currentPrice
    ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
    : undefined;
  const offerUrl = nonEmpty(source.affiliateUrl);
  const validOfferUrl = offerUrl === "#" ? undefined : offerUrl;
  const marketplaceName = nonEmpty(source.marketplaceName);
  const sellerName = nonEmpty(source.sellerName);
  const hasOffer = currentPrice != null || originalPrice != null ||
    validInformedDiscount != null || calculatedDiscount != null ||
    validOfferUrl != null || marketplaceName != null || sellerName != null ||
    source.soldOut === true;

  if (!hasOffer) return undefined;

  return {
    marketplaceName,
    sellerName,
    currentPrice,
    originalPrice,
    discountPercent: validInformedDiscount ?? calculatedDiscount,
    discountSource: validInformedDiscount != null
      ? "informed"
      : calculatedDiscount != null
        ? "calculated"
        : undefined,
    freeShipping: typeof source.freeShipping === "boolean"
      ? source.freeShipping
      : undefined,
    offerUrl: validOfferUrl,
    availability: source.soldOut ? "sold_out" : "unknown",
  };
}

function isCatalogProduct(source: ComparisonProductSource): source is CatalogProduct {
  return "mainName" in source;
}

export function toComparableProduct(
  source: ComparisonProductSource,
  selectedAt = new Date().toISOString(),
): ComparableProduct {
  if (!isCatalogProduct(source)) {
    return {
      product: cardProductSummary(source),
      selectedOffer: cardOfferSummary(source),
      selectedAt,
    };
  }

  return {
    product: productSummary(source),
    selectedOffer: source.bestOffer ? offerSummary(source.bestOffer) : undefined,
    selectedAt,
  };
}
