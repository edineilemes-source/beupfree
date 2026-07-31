import type { CriterionEvaluation } from "./CriterionEvaluation";

/** The contribution produced by one analyzer for one criterion and candidate. */
export interface AnalyzerResult extends CriterionEvaluation {
  analyzerId: string;
}
