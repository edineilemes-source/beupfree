import type { DecisionCandidate } from "./DecisionCandidate";

/** All normalized data available for one decision. */
export interface DecisionContext<
  TCandidate extends DecisionCandidate = DecisionCandidate,
> {
  candidates: TCandidate[];
  preferences?: Record<string, unknown>;
  environment?: Record<string, unknown>;
}
