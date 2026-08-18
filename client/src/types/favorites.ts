export interface FavoriteReference {
  productId: string;
  savedAt: string;
}

export interface FavoriteProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  oldPrice?: number;
  discount: number;
  image: string;
  category: string;
  affiliateUrl: string;
  referenceUrl?: string;
  marketplaceName?: string;
  sellerName?: string;
  freeShipping?: boolean;
  averageRating?: number | null;
  totalReviews?: number;
  promotionType?: string;
  soldOut?: boolean;
}
