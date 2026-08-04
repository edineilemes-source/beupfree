import {
  SCORE_TIE_TOLERANCE,
  type Criterion,
  type CriterionLeader,
  type ScoredProduct,
  type WorthPayingAnalysis,
} from "./types";

const RAW_TOLERANCE = 0.000001;

function priceOf(item: ScoredProduct): number | null {
  const price = item.selectedOffer?.currentPrice;
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
}

export function selectScoreLeaders(products: ScoredProduct[]) {
  const highest = Math.max(...products.map((product) => product.score));
  const leaders = products.filter((product) => highest - product.score <= SCORE_TIE_TOLERANCE);
  return { leaders, winner: leaders.length === 1 ? leaders[0] : null, tied: leaders.length > 1 };
}

export function selectLeader(
  products: ScoredProduct[],
  valueOf: (product: ScoredProduct) => number | null,
  lowerIsBetter = false,
): CriterionLeader {
  const available = products.map((product) => ({ product, value: valueOf(product) }))
    .filter((entry): entry is { product: ScoredProduct; value: number } => entry.value != null && Number.isFinite(entry.value));
  if (available.length === 0) return { products: [], tied: false };
  const best = lowerIsBetter
    ? Math.min(...available.map(({ value }) => value))
    : Math.max(...available.map(({ value }) => value));
  const leaders = available.filter(({ value }) => Math.abs(value - best) <= RAW_TOLERANCE).map(({ product }) => product);
  return { products: leaders, tied: leaders.length > 1 };
}

function compareCriterion(
  preferred: ScoredProduct,
  baseline: ScoredProduct,
  criterion: Exclude<Criterion, "price">,
): 1 | 0 | -1 | null {
  const left = preferred.criteria[criterion].normalized;
  const right = baseline.criteria[criterion].normalized;
  if (left == null || right == null) return null;
  if (Math.abs(left - right) <= RAW_TOLERANCE) return 0;
  return left > right ? 1 : -1;
}

export function analyzeWorthPaying(
  preferred: ScoredProduct | null,
  cheapest: ScoredProduct | null,
): WorthPayingAnalysis {
  const unavailable = (explanation: string): WorthPayingAnalysis => ({
    verdict: "DEPENDS", absoluteDifference: null, percentageDifference: null,
    advantages: [], disadvantages: [], comparableCriteria: 0, explanation,
  });
  if (!preferred) return unavailable("Há empate na Nota UpPulse; não existe uma única opção para comparar ao menor preço.");
  if (!cheapest) return unavailable("Não há preços suficientes para calcular a diferença com segurança.");

  const preferredPrice = priceOf(preferred);
  const cheapestPrice = priceOf(cheapest);
  if (preferredPrice == null || cheapestPrice == null) return unavailable("Não há preços suficientes para calcular a diferença com segurança.");

  const absoluteDifference = Math.max(0, preferredPrice - cheapestPrice);
  const percentageDifference = cheapestPrice > 0 ? absoluteDifference / cheapestPrice * 100 : null;
  const comparisons = (["discount", "rating", "reviews", "shipping"] as const)
    .map((criterion) => ({ criterion, result: compareCriterion(preferred, cheapest, criterion) }))
    .filter((entry): entry is { criterion: typeof entry.criterion; result: 1 | 0 | -1 } => entry.result != null);
  const advantages = comparisons.filter(({ result }) => result === 1).map(({ criterion }) => criterion);
  const disadvantages = comparisons.filter(({ result }) => result === -1).map(({ criterion }) => criterion);
  const comparableCriteria = comparisons.length;

  if (preferred.product.id === cheapest.product.id || absoluteDifference <= RAW_TOLERANCE) {
    return { verdict: "NO", absoluteDifference, percentageDifference, advantages, disadvantages, comparableCriteria,
      explanation: `${preferred.label} já tem o menor preço; não é necessário pagar uma diferença.` };
  }
  if (percentageDifference == null || comparableCriteria < 2) {
    return { verdict: "DEPENDS", absoluteDifference, percentageDifference, advantages, disadvantages, comparableCriteria,
      explanation: "Há poucos dados comparáveis para afirmar que a diferença de preço compensa." };
  }

  const scoreAdvantage = preferred.score - cheapest.score;
  const cautiousYes = disadvantages.length === 0 && scoreAdvantage >= 0.5 && (
    (absoluteDifference <= 50 && percentageDifference <= 15 && advantages.length >= 3) ||
    (absoluteDifference <= 100 && percentageDifference <= 10 && advantages.length >= 2)
  );
  if (cautiousYes) {
    return { verdict: "YES", absoluteDifference, percentageDifference, advantages, disadvantages, comparableCriteria,
      explanation: `${preferred.label} custa ${Math.round(percentageDifference)}% a mais, mas tem vantagem em ${advantages.length} critérios comparáveis sem desvantagens conhecidas.` };
  }

  const clearlyNotWorthIt = (absoluteDifference > 200 || percentageDifference > 30) && advantages.length <= 1;
  if (clearlyNotWorthIt) {
    return { verdict: "NO", absoluteDifference, percentageDifference, advantages, disadvantages, comparableCriteria,
      explanation: `A diferença de ${Math.round(percentageDifference)}% é alta para as vantagens disponíveis.` };
  }
  return { verdict: "DEPENDS", absoluteDifference, percentageDifference, advantages, disadvantages, comparableCriteria,
    explanation: `${preferred.label} tem a melhor Nota UpPulse, mas preço e vantagens não atendem aos limites conservadores para uma recomendação direta.` };
}

export function recommendationReason(winner: ScoredProduct | null): string {
  return winner
    ? "Melhor equilíbrio entre os critérios disponíveis de preço, desconto, avaliação, confiança e frete."
    : "As opções líderes estão tecnicamente empatadas dentro da tolerância da Nota UpPulse.";
}
