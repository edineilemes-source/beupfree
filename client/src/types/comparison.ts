import type { OfferSummary, ProductSummary } from "@/types/products";

export interface ComparableProduct {
  product: ProductSummary;
  selectedOffer?: OfferSummary;
  selectedAt: string;
}

export type ComparisonActionStatus =
  | "added"
  | "already_exists"
  | "limit_reached"
  | "invalid_item";

export interface ComparisonActionResult {
  status: ComparisonActionStatus;
}

export interface ComparisonStorageItem {
  productId: string;
  selectedOfferId?: string;
  selectedAt: string;
  snapshot: ComparableProduct;
}

export interface ComparisonStorageDocument {
  version: 1;
  items: ComparisonStorageItem[];
}
