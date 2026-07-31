/** The evaluation produced for one criterion and one candidate. */
export interface CriterionEvaluation {
  criterionId: string;
  candidateId: string;
  /** Normalized score from 0 to 100. */
  score: number;
  /** Normalized confidence from 0 to 100. */
  confidence: number;
  reasons: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}
