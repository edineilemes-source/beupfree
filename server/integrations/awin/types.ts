export const AWIN_PROVIDER = "awin" as const;

export type AwinFeedItem = {
  /** Exact CSV values keyed by the feed's dynamic header. */
  raw: Record<string, string>;
  rowNumber: number;
};

export type AwinProvenance = {
  provider: typeof AWIN_PROVIDER;
  merchantId: string;
  merchantName: string | null;
  feedId: string;
  dataFeedId: string | null;
  externalIds: {
    awProductId: string | null;
    merchantProductId: string | null;
    parentProductId: string | null;
  };
  sourceUpdatedAt: string | null;
};

export type AwinRawEnvelope = {
  provider: typeof AWIN_PROVIDER;
  feedId: string;
  merchantId: string;
  awProductId: string | null;
  merchantProductId: string | null;
  identityHash: string;
  contentHash: string;
  ingestedAt: string;
  payload: Record<string, string>;
};

export type NormalizedAwinItem = {
  productKey: string;
  variantKey: string;
  offerKey: string;
  product: {
    name: string;
    description: string | null;
    shortDescription: string | null;
    brand: string | null;
    colour: string | null;
    model: string | null;
    modelNumber: string | null;
    productType: string | null;
    condition: string | null;
    specifications: string | null;
    keywords: string | null;
    identifiers: Record<string, string | null>;
    category: Record<string, string | null>;
  };
  variant: {
    size: string | null;
    sizeStockStatus: string | null;
    colour: string | null;
    ean: string | null;
    gtin: string | null;
    validGtin: string | null;
  };
  offer: {
    merchantId: string;
    merchantName: string | null;
    currentPrice: number;
    prices: Record<string, number | null>;
    currency: string;
    availability: Record<string, string | number | boolean | null>;
    affiliateUrl: string;
    merchantUrl: string | null;
    basketUrl: string | null;
    delivery: Record<string, string | number | null>;
  };
  images: string[];
  provenance: AwinProvenance;
  raw: AwinRawEnvelope;
};

export type AwinInvalidItem = { rowNumber: number; reasons: string[] };
