import type { AnalyzerResult } from "./AnalyzerResult";

/** Aggregated, explainable outcome for one candidate. */
export interface DecisionResult {
  candidateId: string;
  score: number;
  confidence: number;
  analyzerResults: AnalyzerResult[];
  reasons: string[];
  warnings: string[];
}
