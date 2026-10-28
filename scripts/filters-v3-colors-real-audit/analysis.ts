import { catalogRequestParams, filtersFromSearch, toggleFilterSearch } from "../../client/src/lib/catalogState";
import { EXAMPLE_LIMIT, TOP_LIMIT } from "./queries";

export type Source = "variant" | "primary" | "projection";
export type ColorFrequency = {
  source: Source; value: string | null; frequency: number; products: number;
  variants: number | null; merchants: number;
};
export const SOURCES: Source[] = ["variant", "primary", "projection"];
const percent = (n: number, total: number) => total ? +(100 * n / total).toFixed(4) : 0;
const descending = (a: {frequency: number}, b: {frequency: number}) => b.frequency - a.frequency;
/** Mechanical analytical keys only: no semantic aliases, no persistence. */
export const textualKeys = {
  trim: (s: string) => s.trim(),
  lowercase: (s: string) => s.trim().toLocaleLowerCase("pt-BR"),
  diacriticInsensitive: (s: string) => s.trim().normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR"),
  separatorNormalized: (s: string) => s.trim().normalize("NFD").replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR").replace(/[\s\-/+&,;]+/g, " ").trim(),
};
const formatTests: Record<string, (s: string) => boolean> = {
  diacritics: s => /\p{M}/u.test(s.normalize("NFD")),
  hyphen: s => /[-‐‑‒–—]/u.test(s), slash: s => s.includes("/"), plus: s => s.includes("+"),
  ampersand: s => s.includes("&"), comma: s => s.includes(","), semicolon: s => s.includes(";"),
  parentheses: s => /[()]/.test(s), multipleWhitespace: s => /\s{2,}/u.test(s),
  leadingTrailingWhitespace: s => s !== s.trim(), digits: s => /\p{N}/u.test(s),
  // Unicode code points, not UTF-16 units. Analytical threshold; never clips stored text.
  veryLong: s => Array.from(s).length > 120,
};
const compoundTests: Record<string, (s: string) => boolean> = {
  slash: formatTests.slash, plus: formatTests.plus, ampersand: formatTests.ampersand,
  comma: formatTests.comma, textualAnd: s => / e /iu.test(s),
};

export function transport(value: string) {
  const url = toggleFilterSearch("", "cor", value);
  const state = filtersFromSearch(url);
  const request = catalogRequestParams(state, "", "relevantes", 1, 21);
  const backendValues = (request.get("cor") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const secondState = filtersFromSearch(toggleFilterSearch(url, "cor", value)).cor;
  return { value, url, reconstructedValues: state.cor, backendValues,
    secondClickRemoves: secondState.length === 0,
    stable: backendValues.length === 1 && backendValues[0] === value };
}

function exampleBudget<T extends {examples: unknown[];distinctValues:number}>(groups:T[]):T[] {
  let remaining=EXAMPLE_LIMIT;
  return groups.map(group=>{
    const examples=group.examples.slice(0,remaining);remaining-=examples.length;
    return {...group,examples,examplesOmitted:group.distinctValues-examples.length};
  });
}

type Analyzed = ColorFrequency & ReturnType<typeof transport>;
export function analyzeColors(input: ColorFrequency[]) {
  const nonnull = input.filter((row): row is ColorFrequency & {value: string} => typeof row.value === "string")
    .slice().sort(descending);
  const rows: Analyzed[] = nonnull.map(row => ({...row, ...transport(row.value)}));
  const outputs = new Map<string, Analyzed[]>();
  for (const row of rows) {
    // Serialize the whole ordered backend multiselect, avoiding delimiter-key ambiguity.
    const key = JSON.stringify(row.backendValues);
    const group = outputs.get(key) ?? []; group.push(row); outputs.set(key, group);
  }
  const collisions = [...outputs.entries()].filter(([,group]) => new Set(group.map(r=>r.value)).size > 1);
  const collisionValues = new Set(collisions.flatMap(([,group])=>group.map(row=>row.value)));
  const changed = rows.filter(row => !row.stable);
  const changedValues = changed.map(row=>row.value);
  const groups = Object.entries(textualKeys).map(([kind, keyOf]) => {
    const map = new Map<string, ColorFrequency[]>();
    for(const row of nonnull) {
      const key = keyOf(row.value);
      const group = map.get(key) ?? []; group.push(row); map.set(key, group);
    }
    const candidates = [...map.entries()].filter(([,group])=>group.length>1)
      .map(([key,group])=>({classification:"TEXTUAL_VARIATION_CANDIDATE", key,
        distinctValues:group.length,frequency:group.reduce((sum,row)=>sum+row.frequency,0),
        examples:group.slice(0,EXAMPLE_LIMIT)})).sort(descending);
    return {kind, totalGroups:candidates.length, groups:exampleBudget(candidates.slice(0,TOP_LIMIT))};
  });
  const measureFormats = (tests: Record<string,(s:string)=>boolean>, classification?:string) => Object.fromEntries(
    Object.entries(tests).map(([name, matches])=>{
      const selected = nonnull.filter(row=>matches(row.value));
      return [name,{classification,distinctValues:selected.length,
        occurrences:selected.reduce((sum,row)=>sum+row.frequency,0),
        examples:selected.slice(0,EXAMPLE_LIMIT)}];
    }),
  );
  const total = rows.length, frequencies = rows.reduce((sum,row)=>sum+row.frequency,0);
  const countClass = (selected:Analyzed[]) => ({distinctValues:selected.length,percentDistinct:percent(selected.length,total),
    occurrences:selected.reduce((sum,row)=>sum+row.frequency,0),
    percentOccurrences:percent(selected.reduce((sum,row)=>sum+row.frequency,0),frequencies),
    examples:selected.slice(0,EXAMPLE_LIMIT)});
  return {
    distribution:{distinctNonNullValues:total, nullBucket:input.find(row=>row.value===null)??null,
      top:nonnull.slice(0,TOP_LIMIT),tailDistinctValues:Math.max(0,total-TOP_LIMIT),
      tailOccurrences:nonnull.slice(TOP_LIMIT).reduce((sum,row)=>sum+row.frequency,0)},
    textualVariationCandidates:groups,
    formatMetrics:measureFormats(formatTests),
    compoundColorCandidates:measureFormats(compoundTests,"COMPOUND_COLOR_CANDIDATE_NOT_SEMANTIC_SPLIT"),
    roundTripAnalysis:{totalDistinctValues:total,totalOccurrences:frequencies,
      ROUNDTRIP_STABLE:countClass(rows.filter(row=>row.stable)),
      ROUNDTRIP_CHANGED:countClass(changed),
      // Collision overlaps changed/stable; not a mutually exclusive third partition.
      ROUNDTRIP_COLLISION:countClass(rows.filter(row=>collisionValues.has(row.value))),
      collisionGroups:collisions.length,
      collisions:exampleBudget(collisions.map(([key,group])=>({backendValues:JSON.parse(key) as string[],
        distinctValues:group.length,frequency:group.reduce((sum,row)=>sum+row.frequency,0),
        examples:group.slice(0,EXAMPLE_LIMIT)})).sort(descending).slice(0,TOP_LIMIT)),
      secondClickNotRemoving:countClass(rows.filter(row=>!row.secondClickRemoves))},
    impactParameters:{changedValues,collisionValues:[...collisionValues]},
  };
}
