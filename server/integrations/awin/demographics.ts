import type { DemographicEvidence } from "@shared/demographicTaxonomy";
/** Only documented destination fields: preserve raw rather than guessing other headers. */
export function awinDemographicEvidence(raw: Record<string, string>): DemographicEvidence[] {
  const suitableFor = raw["Fashion:suitable_for"];
  return suitableFor?.trim() ? [{ raw: suitableFor, field: "Fashion:suitable_for", source: "adapter" }] : [];
}
