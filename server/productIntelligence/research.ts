import { createSuperCatalogCard, type IdentityDescriptor, type TechnicalEvidence, type KnowledgeCard } from "./superCatalog";

/** Provider-neutral research contract. Search and extraction are supplied by a
 * separately configured provider; no secret, crawler or paid API is hardcoded.
 */
export interface ResearchHit {
  url: string;
  title: string;
  snippet: string;
  sourceType: TechnicalEvidence["sourceType"];
}
export interface ResearchProvider {
  search(query: string, limit: number): Promise<ResearchHit[]>;
  extract(identity: IdentityDescriptor, hit: ResearchHit): Promise<TechnicalEvidence[]>;
}
export interface ResearchResult {
  card: KnowledgeCard;
  state: "ENRICHED" | "NO_EVIDENCE" | "RESEARCH_FAILED";
  queried: boolean;
  warnings: string[];
}
export interface ResearchCache {
  get(key: string): Promise<ResearchResult | null>;
  set(key: string, result: ResearchResult): Promise<void>;
}
export type ResearchOptions = { maxSources?: number; maxFieldsPerSource?: number };
/** Diagnostic codes only: never propagate raw API errors or credentials. */
function failureCode(error: unknown, stage: "SEARCH" | "EXTRACTION"): string {
  const message = error instanceof Error ? error.message : "";
  const match = /^RESEARCH_PROVIDER_HTTP_(\d{3})(_(?:MISSING_SCOPE|INVALID_API_KEY|INSUFFICIENT_QUOTA|MODEL_NOT_FOUND|RATE_LIMIT_EXCEEDED|ORGANIZATION_NOT_FOUND))?$/.exec(message);
  if (match) return stage + "_HTTP_" + match[1] + (match[2] ?? "");
  if (message === "RESEARCH_EXTRACTION_INVALID_JSON") return stage + "_INVALID_JSON";
  if (error instanceof Error && error.name === "TimeoutError") return stage + "_TIMEOUT";
  return stage + "_FAILED";
}
const safeUrl = (url: string) => {
  try { const parsed = new URL(url); return ["https:","http:"].includes(parsed.protocol) && !!parsed.hostname && !parsed.username && !parsed.password; } catch { return false; }
};
export async function enrichProduct(
  identity: IdentityDescriptor,
  provider: ResearchProvider,
  cache: ResearchCache,
  options: ResearchOptions = {},
): Promise<ResearchResult> {
  const initial = createSuperCatalogCard(identity);
  const key = initial.superHash;
  const previous = await cache.get(key);
  if (previous) return { ...previous, queried: false };
  const maxSources = Math.min(5, Math.max(1, Math.floor(options.maxSources ?? 3)));
  const maxFields = Math.min(30, Math.max(1, Math.floor(options.maxFieldsPerSource ?? 15)));
  const warnings: string[] = [];
  const query = [identity.brand, identity.model, identity.version, identity.manufacturerCode, "especificações tênis"].filter(Boolean).join(" ");
  let hits: ResearchHit[];
  try { hits = await provider.search(query, maxSources); }
  catch (error) { return { card: initial, state: "RESEARCH_FAILED", queried: true, warnings: [failureCode(error,"SEARCH")] }; }
  const evidence: TechnicalEvidence[] = [];
  const seen = new Set<string>();
  for (const hit of hits.slice(0, maxSources)) {
    if (!safeUrl(hit.url) || seen.has(hit.url)) continue;
    seen.add(hit.url);
    try {
      const extracted = await provider.extract(identity, hit);
      for (const item of extracted.slice(0,maxFields)) {
        // A provider may hallucinate a source; accept only citations pointing
        // to the specific research result it was asked to analyze.
        if (item.sourceUrl === hit.url && item.sourceType === hit.sourceType) evidence.push(item);
        else warnings.push("UNTRUSTED_CITATION");
      }
    } catch (error) { warnings.push(failureCode(error,"EXTRACTION")); }
  }
  const card = createSuperCatalogCard(identity,evidence);
  const result: ResearchResult = {card, state: card.sourcesConsulted ? "ENRICHED" : "NO_EVIDENCE", queried: true, warnings};
  if (result.state === "ENRICHED") await cache.set(key,result);
  return result;
}
