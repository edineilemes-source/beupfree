export type AttributeProvenance =
  | "catalog"
  | "marketplace_attribute"
  | "marketplace_variation"
  | "title_inference"
  | "unknown";

export interface NormalizedAttribute<T> {
  value: T;
  label?: string;
  provenance: AttributeProvenance;
  confidence?: number;
}

export interface ProductAttributes {
  colors?: NormalizedAttribute<string>[];
  sizes?: NormalizedAttribute<string>[];
  gender?: NormalizedAttribute<string>;
  ageGroup?: NormalizedAttribute<string>;
  sports?: NormalizedAttribute<string>[];
  usageTypes?: NormalizedAttribute<string>[];
  extra?: Record<
    string,
    NormalizedAttribute<string | number | boolean | string[]>[]
  >;
}

export interface NamedEntitySummary {
  id?: string;
  name: string;
  slug?: string;
}

export interface ProductSummary {
  id: string;
  title: string;
  imageUrl?: string;
  brand?: NamedEntitySummary;
  category?: NamedEntitySummary;
  rating?: number;
  reviewCount?: number;
  attributes: ProductAttributes;
}

export type DiscountSource = "informed" | "calculated";

export type OfferAvailability =
  | "available"
  | "sold_out"
  | "expired"
  | "unknown";

export interface OfferSummary {
  id?: string;
  marketplaceId?: string;
  marketplaceName?: string;
  externalProductId?: string;
  sellerName?: string;
  currentPrice?: number;
  originalPrice?: number;
  discountPercent?: number;
  discountSource?: DiscountSource;
  currency?: string;
  freeShipping?: boolean;
  offerUrl?: string;
  availability: OfferAvailability;
  lastSeenAt?: string;
}
