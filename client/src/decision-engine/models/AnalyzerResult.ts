/** The contribution produced by one analyzer for one candidate. */
export interface AnalyzerResult {
  analyzerId: string;
  candidateId: string;
  /** Normalized score from 0 to 100. */
  score: number;
  /** Normalized confidence from 0 to 100. */
  confidence: number;
  reasons: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}
