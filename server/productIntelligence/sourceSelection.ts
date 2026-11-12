import type { ResearchHit } from "./research";

export function pickIndependentSources(hits: readonly ResearchHit[], limit = 3): ResearchHit[] {
  const seen = new Set<string>();
  const selected: ResearchHit[] = [];
  for (const hit of hits) {
    let host: string;
    try {
      const url = new URL(hit.url);
      if (url.protocol !== "https:" || url.username || url.password) continue;
      host = url.hostname.toLowerCase().replace(/^www\./, "");
    } catch { continue; }
    if (seen.has(host)) continue;
    seen.add(host);
    selected.push(hit);
    if (selected.length >= limit) break;
  }
  return selected;
}

export type ResearchCoverage = {
  selectedSources: number;
  targetSources: number;
  distinctDomains: number;
  meetsTarget: boolean;
};
export function researchCoverage(hits: readonly ResearchHit[], targetSources = 3): ResearchCoverage {
  const independent = pickIndependentSources(hits, targetSources);
  return {selectedSources: independent.length,targetSources,distinctDomains: independent.length,meetsTarget: independent.length>=targetSources};
}
