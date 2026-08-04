import type { ComparableProduct } from "@/types/comparison";
import { analyzeWorthPaying, recommendationReason, selectLeader, selectScoreLeaders } from "./comparisonInsights";
import { scoreProducts } from "./comparisonScoring";
import type { ComparisonIntelligenceResult } from "./types";

function validValue(value: unknown, maximum?: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return maximum == null ? value : Math.min(value, maximum);
}

export function analyzeComparison(items: ComparableProduct[]): ComparisonIntelligenceResult {
  const products = scoreProducts(items);
  const score = selectScoreLeaders(products);
  const cheapest = selectLeader(products, (item) => {
    const price = validValue(item.selectedOffer?.currentPrice);
    return price != null && price > 0 ? price : null;
  }, true);
  const biggestDiscount = selectLeader(products, (item) => validValue(item.selectedOffer?.discountPercent, 100));
  const bestRated = selectLeader(products, (item) => validValue(item.product.rating, 5));
  const cheapestProduct = cheapest.products.length === 1 ? cheapest.products[0] : null;

  return {
    products,
    winner: score.winner,
    scoreLeaders: score.leaders,
    isScoreTie: score.tied,
    cheapest,
    biggestDiscount,
    bestRated,
    worthPaying: analyzeWorthPaying(score.winner, cheapestProduct),
    recommendationReason: recommendationReason(score.winner),
  };
}

export * from "./types";
