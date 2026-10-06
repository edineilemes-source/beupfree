/** Universal commercial destination; independent of identity, variants and merchants. */
export const DEMOGRAPHIC_TAXONOMY_VERSION = "uppulse-demographics-v1";
export const DEMOGRAPHIC_FILTER_VERSION = "uppulse-demographic-filters-v4";
export const GENDERS = [
  { value: "MASCULINO", id: "masculino", label: "Masculino" },
  { value: "FEMININO", id: "feminino", label: "Feminino" },
  { value: "UNISSEX", id: "unissex", label: "Unissex" },
] as const;
export const AGE_GROUPS = [
  { value: "ADULTO", id: "adulto", label: "Adulto" },
  { value: "INFANTIL", id: "infantil", label: "Infantil" },
  { value: "BEBE", id: "bebe", label: "Bebê" },
] as const;
export type Gender = typeof GENDERS[number]["value"];
export type AgeGroup = typeof AGE_GROUPS[number]["value"];
export type DemographicDimension = "genero" | "idade";
export type DemographicEvidence = {
  raw: string; field: string; source: "structured" | "adapter" | "title";
  /** Dedicated structured fields must have verified semantics/provenance. */
  axis?: "gender" | "ageGroup";
  providerId?: string; merchantId?: string; feedId?: string;
};
export type AxisResult<T> = { value: T | null; status: "KNOWN" | "UNKNOWN" | "AMBIGUOUS"; source: DemographicEvidence["source"] | null; reasons: string[] };
export type Demographics = { gender: AxisResult<Gender>; ageGroup: AxisResult<AgeGroup>; evidence: DemographicEvidence[]; taxonomyVersion: string };
const fold = (s: string) => s.normalize("NFKC").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const rank = { structured: 1, adapter: 2, title: 3 };
const genderWords: Record<string, Gender> = { masculino: "MASCULINO", masculina: "MASCULINO", homem: "MASCULINO", men: "MASCULINO", male: "MASCULINO", menino: "MASCULINO", feminino: "FEMININO", feminina: "FEMININO", mulher: "FEMININO", women: "FEMININO", female: "FEMININO", menina: "FEMININO", unissex: "UNISSEX", unisex: "UNISSEX" };
const childWords = new Set(["infantil", "kid", "kids", "crianca", "menino", "menina"]);
const adultWords = new Set(["adulto", "adulta", "adult"]);
function signals(e: DemographicEvidence) {
  const text = fold(e.raw), tokens = text.match(/[a-z0-9]+/g) ?? [];
  const genders = new Set<Gender>(), ages = new Set<AgeGroup>();
  let juvenile = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    // Negation and explicit model naming are not positive audience evidence.
    const preceding = tokens.slice(Math.max(0,i-5),i).join(" ");
    if (["modelo", "model"].includes(tokens[i - 1]) || /(?:^| )(?:nao|not|sem)(?: (?:e|eh|para|o|a|publico|recomendado|indicad[oa])){0,4}$/.test(preceding)) continue;
    if (genderWords[t]) genders.add(genderWords[t]);
    if (childWords.has(t)) ages.add("INFANTIL");
    if (adultWords.has(t)) ages.add("ADULTO");
    const context = e.source !== "title" || /(?:^| )(?:para|publico|faixa|idade)(?: o| a)?$/.test(preceding);
    // Full Juvenil is an explicit qualifier; Junior and Baby require context.
    if (t === "juvenil" || (t === "junior" && context) || (t === "jr" && e.source !== "title" && e.axis === "ageGroup")) { ages.add("INFANTIL"); juvenile = true; }
    if (t === "bebe" || (t === "baby" && context)) ages.add("BEBE");
  }
  if (ages.has("BEBE") && !juvenile) ages.delete("INFANTIL");
  if (e.axis === "gender") ages.clear();
  if (e.axis === "ageGroup") genders.clear();
  return { genders, ages };
}
export function normalizeDemographics(evidence: DemographicEvidence[]): Demographics {
  const unique = [...new Map(evidence.map(e => [JSON.stringify(e), e])).values()].sort((a, b) => rank[a.source] - rank[b.source] || JSON.stringify(a).localeCompare(JSON.stringify(b)));
  function resolve<T extends Gender | AgeGroup>(axis: "genders" | "ages"): AxisResult<T> {
    const entries = unique.map(e => ({ e, values: [...signals(e)[axis]] as T[] })).filter(e => e.values.length);
    if (!entries.length) return { value: null, status: "UNKNOWN", source: null, reasons: ["NO_EXPLICIT_EVIDENCE"] };
    const tier = rank[entries[0].e.source], candidates = new Set(entries.filter(x => rank[x.e.source] === tier).flatMap(x => x.values));
    // A broad child signal may specialize to baby within the same evidence tier.
    if (axis === "ages" && candidates.has("BEBE" as T) && !entries.some(x => rank[x.e.source] === tier && /\b(juvenil|junior|jr)\b/.test(fold(x.e.raw)))) candidates.delete("INFANTIL" as T);
    if (candidates.size !== 1) return { value: null, status: "AMBIGUOUS", source: entries[0].e.source, reasons: ["CONFLICTING_EVIDENCE"] };
    const value = [...candidates][0];
    return { value, status: "KNOWN", source: entries[0].e.source, reasons: entries.some(x => rank[x.e.source] > tier && x.values.some(v => v !== value)) ? ["LOWER_PRIORITY_CONFLICT"] : [] };
  }
  return { gender: resolve<Gender>("genders"), ageGroup: resolve<AgeGroup>("ages"), evidence: unique, taxonomyVersion: DEMOGRAPHIC_TAXONOMY_VERSION };
}
export function titleDemographics(title: string) { return normalizeDemographics([{ raw: title, field: "title", source: "title" }]); }
export function demographicRegistry(dimension: DemographicDimension) { return dimension === "genero" ? GENDERS : AGE_GROUPS; }
export function demographicId(dimension: DemographicDimension, value: string): string | null {
  let id = fold(value);
  if (dimension === "genero" && id === "unisex") id = "unissex";
  if (dimension === "idade" && ["juvenil", "junior"].includes(id)) id = "infantil";
  return demographicRegistry(dimension).find(x => x.id === id)?.id ?? null;
}
/** Invalid URL tokens are discarded, never mapped across dimensions or to Adulto. */
export function demographicSelection(dimension: DemographicDimension, raw: unknown): string[] {
  const inputs = Array.isArray(raw) ? raw : [raw];
  const ids = new Set(inputs.flatMap(x => typeof x === "string" ? x.split(",") : []).flatMap(x => demographicId(dimension, x) ?? []));
  return demographicRegistry(dimension).filter(x => ids.has(x.id)).map(x => x.id);
}
export function demographicValues(dimension: DemographicDimension, raw: unknown): string[] { return demographicSelection(dimension, raw).map(id => demographicRegistry(dimension).find(x => x.id === id)!.value); }
export function demographicLabel(dimension: DemographicDimension, value: string): string { const id = demographicId(dimension, value); return demographicRegistry(dimension).find(x => x.id === id)?.label ?? value; }
export function demographicFacets(dimension: DemographicDimension, raw: Array<{ value: string; count: number }> = []) {
  return demographicRegistry(dimension).map(x => ({ value: x.id, label: x.label, count: Number(raw.find(r => r.value === x.value || r.value === x.id)?.count ?? 0) }));
}
