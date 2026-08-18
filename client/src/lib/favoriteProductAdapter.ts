import {
  brandNameOf,
  categoryNameOf,
  discountOf,
  priceOf,
  type CatalogProduct,
} from "@/lib/catalogFilters";
import type { FavoriteProduct } from "@/types/favorites";

export interface FavoriteProductCardSource {
  id: string;
  name: string;
  brand: string;
  price: number;
  oldPrice?: number;
  discount?: number;
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

export type FavoriteProductSource = CatalogProduct | FavoriteProductCardSource;

function isCatalogProduct(source: FavoriteProductSource): source is CatalogProduct {
  return "mainName" in source;
}

export function toFavoriteProduct(source: FavoriteProductSource): FavoriteProduct {
  if (isCatalogProduct(source)) {
    return {
      id: source.id,
      name: source.mainName,
      brand: brandNameOf(source),
      price: priceOf(source),
      oldPrice: source.bestOffer?.originalPrice
        ? parseFloat(source.bestOffer.originalPrice)
        : undefined,
      discount: discountOf(source),
      image: source.mainImageUrl || "",
      category: categoryNameOf(source),
      affiliateUrl: source.bestOffer?.affiliateUrl || "#",
      referenceUrl: source.bestOffer?.referenceUrl ?? undefined,
      marketplaceName: source.bestOffer?.marketplaceName ?? undefined,
      sellerName: source.bestOffer?.sellerName ?? undefined,
      freeShipping: source.bestOffer?.freeShipping ?? false,
      averageRating: source.averageRating,
      totalReviews: source.totalReviews,
    };
  }

  const safePrice = !Number.isNaN(source.price) ? source.price : 0;
  const safeOldPrice = source.oldPrice != null && !Number.isNaN(source.oldPrice)
    ? source.oldPrice
    : undefined;
  const discount = source.discount || (
    safeOldPrice && safeOldPrice > safePrice
      ? Math.round(((safeOldPrice - safePrice) / safeOldPrice) * 100)
      : 0
  );

  return {
    id: source.id,
    name: source.name,
    brand: source.brand,
    price: safePrice,
    oldPrice: safeOldPrice,
    discount,
    image: source.image,
    category: source.category,
    affiliateUrl: source.affiliateUrl,
    referenceUrl: source.referenceUrl,
    marketplaceName: source.marketplaceName,
    sellerName: source.sellerName,
    freeShipping: source.freeShipping,
    averageRating: source.averageRating,
    totalReviews: source.totalReviews,
    promotionType: source.promotionType,
    soldOut: source.soldOut,
  };
}
