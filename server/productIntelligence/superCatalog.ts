import { TECHNICAL_FIELD_SET, TECHNICAL_FIELDS } from "./technicalFields";
import { createHash } from "node:crypto";

/** Mission 10: auditable knowledge attached to an existing Product Identity Master.
 * This module never merges master IDs, scrapes sites, or changes commercial offers.
 */
export type EvidenceSource = "MANUFACTURER" | "RETAILER" | "INDEPENDENT_TEST" | "FEED";
export type TechnicalEvidence = {
  field: string;
  value: string;
  sourceUrl: string;
  sourceType: EvidenceSource;
  observedAt: string;
  modelCode?: string;
};
export type IdentityDescriptor = {
  masterId: string;
  brand: string;
  model: string;
  manufacturerCode?: string;
  version?: string;
  variantCode?: string;
  color?: string;
};
export type FieldAssessment = {
  field: string;
  value: string | null;
  status: "VERIFIED" | "SINGLE_SOURCE" | "CONFLICT" | "UNAVAILABLE";
  sources: TechnicalEvidence[];
};
export type KnowledgeCard = {
  masterId: string;
  familyKey: string;
  modelKey: string;
  variantKey: string | null;
  superHash: string;
  fields: FieldAssessment[];
  sourcesConsulted: number;
};
const normalize = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fieldKey = (s: string) => normalize(s).replace(/ /g, "_");
const allowedFields = TECHNICAL_FIELD_SET;
const allowedSources = new Set<EvidenceSource>(["MANUFACTURER","RETAILER","INDEPENDENT_TEST","FEED"]);
function sourceUrl(value: string): boolean {
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}
export function createSuperCatalogCard(identity: IdentityDescriptor, evidence: TechnicalEvidence[] = []): KnowledgeCard {
  if (!identity.masterId.trim() || !normalize(identity.brand) || !normalize(identity.model)) throw new Error("IDENTITY_REQUIRED");
  const brand = normalize(identity.brand), model = normalize(identity.model);
  const familyKey = digest(["family-v1", brand, model]);
  // A manufacturer code is a stronger identity signal, but a missing code must
  // never cause two existing Master IDs to be merged.
  const modelKey = digest(["model-v1", brand, model, normalize(identity.version ?? ""), normalize(identity.manufacturerCode ?? "")]);
  const variantParts = [identity.variantCode, identity.color].map(v => normalize(v ?? ""));
  const variantKey = variantParts.some(Boolean) ? digest(["variant-v1", modelKey, ...variantParts]) : null;
  const superHash = digest(["knowledge-v1", identity.masterId, modelKey, variantKey]);
  const grouped = new Map<string, TechnicalEvidence[]>();
  for (const item of evidence) {
    const field = fieldKey(item.field);
    if (!allowedFields.has(field) || !item.value.trim() || !sourceUrl(item.sourceUrl) ||
        !allowedSources.has(item.sourceType) || !Number.isFinite(Date.parse(item.observedAt))) continue;
    // Reject evidence explicitly tied to another manufacturer's model code.
    if (item.modelCode && identity.manufacturerCode && normalize(item.modelCode) !== normalize(identity.manufacturerCode)) continue;
    const entries = grouped.get(field) ?? [];
    if (!entries.some(existing => existing.sourceUrl === item.sourceUrl && normalize(existing.value) === normalize(item.value))) entries.push(item);
    grouped.set(field, entries);
  }
  const fields = [...TECHNICAL_FIELDS].sort().map(field => {
    const sources = (grouped.get(field) ?? []).sort((a,b) => a.sourceUrl.localeCompare(b.sourceUrl) || a.value.localeCompare(b.value));
    const values = [...new Set(sources.map(item => normalize(item.value)))];
    const status: FieldAssessment["status"] = !values.length ? "UNAVAILABLE" : values.length > 1 ? "CONFLICT" : new Set(sources.map(s => new URL(s.sourceUrl).hostname)).size > 1 ? "VERIFIED" : "SINGLE_SOURCE";
    return { field, value: values.length === 1 ? sources[0].value : null, status, sources };
  });
  return { masterId: identity.masterId, familyKey, modelKey, variantKey, superHash, fields, sourcesConsulted: new Set(fields.flatMap(f => f.sources.map(s => s.sourceUrl))).size };
}
export function candidateMatch(a: IdentityDescriptor, b: IdentityDescriptor): "DIFFERENT" | "CANDIDATE" | "SAME_MASTER" {
  if (a.masterId === b.masterId) return "SAME_MASTER";
  if (normalize(a.brand) !== normalize(b.brand)) return "DIFFERENT";
  if (a.manufacturerCode && b.manufacturerCode && normalize(a.manufacturerCode) !== normalize(b.manufacturerCode)) return "DIFFERENT";
  if (a.version && b.version && normalize(a.version) !== normalize(b.version)) return "DIFFERENT";
  if (a.variantCode && b.variantCode && normalize(a.variantCode) !== normalize(b.variantCode)) return "DIFFERENT";
  return normalize(a.model) === normalize(b.model) ? "CANDIDATE" : "DIFFERENT";
}
