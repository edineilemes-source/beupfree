import type { ComparableProduct } from "@/types/comparison";
import {
  SCORE_WEIGHTS,
  type Criterion,
  type CriterionScore,
  type ScoredProduct,
} from "./types";

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function validPrice(item: ComparableProduct): number | null {
  const value = item.selectedOffer?.currentPrice;
  return finite(value) && value > 0 ? value : null;
}

function normalizePrice(item: ComparableProduct, items: ComparableProduct[]): number | null {
  const price = validPrice(item);
  if (price == null) return null;
  const prices = items.map(validPrice).filter((value): value is number => value != null);
  if (prices.length < 2) return null;
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  return maximum === minimum ? 1 : (maximum - price) / (maximum - minimum);
}

function normalizeDiscount(item: ComparableProduct): number | null {
  const value = item.selectedOffer?.discountPercent;
  return finite(value) && value >= 0 ? clamp(value, 0, 100) / 100 : null;
}

function normalizeRating(item: ComparableProduct): number | null {
  const value = item.product.rating;
  return finite(value) && value >= 0 ? clamp(value, 0, 5) / 5 : null;
}

function normalizeReviews(item: ComparableProduct, items: ComparableProduct[]): number | null {
  const value = item.product.reviewCount;
  if (!finite(value) || value < 0) return null;
  const validValues = items
    .map((candidate) => candidate.product.reviewCount)
    .filter((candidate): candidate is number => finite(candidate) && candidate >= 0);
  if (validValues.length < 2) return null;
  const maximum = Math.max(...validValues);
  return maximum === 0 ? 1 : Math.log1p(value) / Math.log1p(maximum);
}

function normalizeShipping(item: ComparableProduct): number | null {
  const value = item.selectedOffer?.freeShipping;
  return typeof value === "boolean" ? (value ? 1 : 0) : null;
}

export function normalizedCriteria(
  item: ComparableProduct,
  items: ComparableProduct[],
): Record<Criterion, number | null> {
  return {
    price: normalizePrice(item, items),
    discount: normalizeDiscount(item),
    rating: normalizeRating(item),
    reviews: normalizeReviews(item, items),
    shipping: normalizeShipping(item),
  };
}

export function scoreProducts(items: ComparableProduct[]): ScoredProduct[] {
  const normalizedByProduct = items.map((item) => normalizedCriteria(item, items));
  const criteria = Object.keys(SCORE_WEIGHTS) as Criterion[];
  const comparableCriteria = criteria.filter((criterion) =>
    normalizedByProduct.every((normalized) => normalized[criterion] != null),
  );
  const comparableWeight = comparableCriteria.reduce(
    (total, criterion) => total + SCORE_WEIGHTS[criterion],
    0,
  );

  return items.map((item, index) => {
    const normalized = normalizedByProduct[index];

    const criterionScores = criteria.reduce(
      (result, criterion) => {
        const value = normalized[criterion];
        const effectiveWeight = value == null || comparableWeight === 0 || !comparableCriteria.includes(criterion)
          ? 0
          : SCORE_WEIGHTS[criterion] / comparableWeight;
        result[criterion] = {
          normalized: value,
          effectiveWeight,
          contribution: value == null ? 0 : value * effectiveWeight * 10,
        };
        return result;
      },
      {} as Record<Criterion, CriterionScore>,
    );

    const rawScore = criteria
      .reduce((total, criterion) => total + criterionScores[criterion].contribution, 0);

    return {
      ...item,
      label: `Produto ${String.fromCharCode(65 + index)}`,
      score: Number.isFinite(rawScore) ? rawScore : 0,
      criteria: criterionScores,
    };
  });
}
