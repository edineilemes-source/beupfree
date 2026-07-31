/** A named decision dimension that can be evaluated by an analyzer. */
export interface Criterion {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
}
