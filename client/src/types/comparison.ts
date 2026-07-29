import type { OfferSummary, ProductSummary } from "@/types/products";

export interface ComparableProduct {
  product: ProductSummary;
  selectedOffer?: OfferSummary;
  selectedAt: string;
}
