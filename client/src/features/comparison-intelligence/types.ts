import type { ComparableProduct } from "@/types/comparison";

export const SCORE_WEIGHTS = {
  price: 0.3,
  discount: 0.25,
  rating: 0.25,
  reviews: 0.1,
  shipping: 0.1,
} as const;

export const SCORE_TIE_TOLERANCE = 0.1;

export type Criterion = keyof typeof SCORE_WEIGHTS;
export type WorthPayingVerdict = "YES" | "NO" | "DEPENDS";

export interface CriterionScore {
  normalized: number | null;
  effectiveWeight: number;
  contribution: number;
}

export interface ScoredProduct extends ComparableProduct {
  label: string;
  score: number;
  criteria: Record<Criterion, CriterionScore>;
}

export interface CriterionLeader {
  products: ScoredProduct[];
  tied: boolean;
}

export interface WorthPayingAnalysis {
  verdict: WorthPayingVerdict;
  absoluteDifference: number | null;
  percentageDifference: number | null;
  advantages: Criterion[];
  disadvantages: Criterion[];
  comparableCriteria: number;
  explanation: string;
}

export interface ComparisonIntelligenceResult {
  products: ScoredProduct[];
  winner: ScoredProduct | null;
  scoreLeaders: ScoredProduct[];
  isScoreTie: boolean;
  cheapest: CriterionLeader;
  biggestDiscount: CriterionLeader;
  bestRated: CriterionLeader;
  worthPaying: WorthPayingAnalysis;
  recommendationReason: string;
}
