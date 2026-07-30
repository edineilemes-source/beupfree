/** A platform- and domain-independent alternative evaluated by the engine. */
export interface DecisionCandidate {
  id: string;
  name: string;
  attributes: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
