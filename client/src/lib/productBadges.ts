export type ProductBadgeKind =
  | "lightning-offer"
  | "highly-rated"
  | "most-reviewed";

export interface ProductBadge {
  kind: ProductBadgeKind;
  label: string;
  priority: number;
}

export interface ProductBadgeInput {
  discount?: number | null;
  freeShipping?: boolean | null;
  averageRating?: number | null;
  totalReviews?: number | null;
  promotionType?: string | null;
}

const MAX_BADGES = 3;
const HIGH_RATING_MIN = 4.5;
const MOST_REVIEWED_MIN = 1_000;

export function getProductBadges(product: ProductBadgeInput): ProductBadge[] {
  const badges: ProductBadge[] = [];

  if (product.promotionType === "lightning") {
    badges.push({ kind: "lightning-offer", label: "Oferta Relâmpago", priority: 1 });
  }
  if ((product.averageRating ?? 0) >= HIGH_RATING_MIN) {
    badges.push({ kind: "highly-rated", label: "Muito Bem Avaliado", priority: 4 });
  }
  if ((product.totalReviews ?? 0) >= MOST_REVIEWED_MIN) {
    badges.push({ kind: "most-reviewed", label: "Muito Avaliado", priority: 5 });
  }

  return badges.sort((a, b) => a.priority - b.priority).slice(0, MAX_BADGES);
}
