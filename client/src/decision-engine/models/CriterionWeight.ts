/** Configurable influence of a criterion in a future aggregation strategy. */
export interface CriterionWeight {
  criterionId: string;
  /** Must be greater than or equal to zero. */
  weight: number;
}
