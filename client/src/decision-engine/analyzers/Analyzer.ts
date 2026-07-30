import type { AnalyzerResult } from "../models/AnalyzerResult";
import type { DecisionCandidate } from "../models/DecisionCandidate";
import type { DecisionContext } from "../models/DecisionContext";

/** A single, composable decision criterion. */
export interface Analyzer<
  TCandidate extends DecisionCandidate = DecisionCandidate,
  TContext extends DecisionContext<TCandidate> = DecisionContext<TCandidate>,
> {
  readonly id: string;
  analyze(
    candidate: TCandidate,
    context: TContext,
  ): AnalyzerResult | Promise<AnalyzerResult>;
}
