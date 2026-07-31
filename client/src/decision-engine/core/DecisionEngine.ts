import type { Analyzer } from "../analyzers/Analyzer";
import type { AnalyzerResult } from "../models/AnalyzerResult";
import type { DecisionCandidate } from "../models/DecisionCandidate";
import type { DecisionContext } from "../models/DecisionContext";
import type { DecisionResult } from "../models/DecisionResult";

function normalizeMetric(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function normalizeAnalyzerResult(result: AnalyzerResult): AnalyzerResult {
  return {
    ...result,
    criterionId: result.criterionId,
    score: normalizeMetric(result.score),
    confidence: normalizeMetric(result.confidence),
    reasons: [...result.reasons],
    warnings: [...result.warnings],
    metadata: result.metadata == null ? undefined : { ...result.metadata },
  };
}

/** Executes independent analyzers and aggregates their contributions. */
export class DecisionEngine<
  TCandidate extends DecisionCandidate = DecisionCandidate,
  TContext extends DecisionContext<TCandidate> = DecisionContext<TCandidate>,
> {
  private readonly analyzers: readonly Analyzer<TCandidate, TContext>[];

  constructor(analyzers: readonly Analyzer<TCandidate, TContext>[] = []) {
    this.analyzers = [...analyzers];
  }

  async evaluate(context: TContext): Promise<DecisionResult[]> {
    const results = await Promise.all(
      context.candidates.map((candidate) => this.evaluateCandidate(candidate, context)),
    );

    return results.sort((left, right) => right.score - left.score);
  }

  private async evaluateCandidate(
    candidate: TCandidate,
    context: TContext,
  ): Promise<DecisionResult> {
    const analyzerResults = await Promise.all(
      this.analyzers.map(async (analyzer) =>
        normalizeAnalyzerResult(await analyzer.analyze(candidate, context))),
    );

    return {
      candidateId: candidate.id,
      score: normalizeMetric(average(analyzerResults.map((result) => result.score))),
      confidence: normalizeMetric(
        average(analyzerResults.map((result) => result.confidence)),
      ),
      analyzerResults,
      reasons: analyzerResults.flatMap((result) => result.reasons),
      warnings: analyzerResults.flatMap((result) => result.warnings),
    };
  }
}
