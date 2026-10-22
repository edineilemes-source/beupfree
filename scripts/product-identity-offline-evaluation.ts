/** Read-only audit. Prints JSON to stdout; never writes results to disk or database. */
import pg from "pg";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseProductIdentity, type ProductIdentity } from "../shared/product-identity/parser";
import { matchProductIdentities, masterIdentityKey, type IdentityMatchResult } from "../shared/product-identity/matcher";
import { normalizeAttributeText } from "../shared/attribute-extraction/normalization";

export interface AuditRow { productId: string; merchant: string; name: string; brand: string }
type Item = AuditRow & { normalizedName: string; identity: ProductIdentity; grams: Set<string> };
type Pair = { brand: string; futFanatics: Item; dafiti: Item; similarity: number; result: IdentityMatchResult };
export const CONFIG = { topK: 5, minSimilarity: 0.55, exactNormalization: "NFD, accents removed, lowercase, punctuation to spaces", similarity: "character trigram Dice on normalized names; same stored brand_normalized only" };
const counts = () => ({ AUTO_MATCH: 0, REVIEW: 0, NO_MATCH: 0 });
const normalize = normalizeAttributeText;
function grams(value: string): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < value.length - 2; i++) result.add(value.slice(i, i + 3));
  return result;
}
export function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const token of a) if (b.has(token)) common++;
  return 2 * common / (a.size + b.size);
}
const prepare = (r: AuditRow): Item => ({ ...r, normalizedName: normalize(r.name), identity: parseProductIdentity({ name: r.name, brand: r.brand }), grams: grams(normalize(r.name)) });
const key = (r: Item) => JSON.stringify([r.brand, r.normalizedName]);
function group<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) { const k = getKey(item); const bucket = groups.get(k) ?? []; bucket.push(item); groups.set(k, bucket); }
  return groups;
}
const pair = (f: Item, d: Item): Pair => ({ brand: f.brand, futFanatics: f, dafiti: d, similarity: similarity(f.grams, d.grams), result: matchProductIdentities(f.identity, d.identity) });
const publicPair = (p: Pair) => ({ brand: p.brand, futFanatics: { productId: p.futFanatics.productId, name: p.futFanatics.name, identity: p.futFanatics.identity }, dafiti: { productId: p.dafiti.productId, name: p.dafiti.name, identity: p.dafiti.identity }, similarity: p.similarity, ...p.result });

// Requested controls. Real occurrences are located by brand and normalized title;
// leading "Tênis" is optional only in this lookup, never in parser input.
export const positiveControls = [
  ["mizuno", "Mizuno Edo Cross Preto e Branco", "Mizuno Edo Cross Branco e Preto"],
  ["fila", "Fila Racer Fastpace Azul e Verde", "Fila Racer Fastpace Verde e Azul"],
  ["fila", "Fila Recovery Feminino Bege e Bordô", "Fila Feminino Recovery Bege e Bordô"],
  ["skechers", "Skechers Altus Glide-Step Preto e Cinza", "Skechers Glide-Step Altus Cinza e Preto"],
  ["bibi", "Bibi Roller 2.0 Infantil Preto", "Infantil - Tênis Bibi Roller 2.0 Preto"],
  ["new balance", "New Balance Fresh Foam Arishi V4 Feminino Cinza e Preto", "New Balance Fresh Foam Arishi V4 Feminino Preto e Cinza"],
];
export const negativeControls = [
  ["olympikus", "Flutua 2", "Flutua"], ["olympikus", "Eros 2", "Eros"],
  ["fila", "Float Maxxi", "Float Maxxi 2"], ["reebok", "Floatzig", "Floatzig 1"],
  ["puma", "Carina", "Carina 3.0"], ["joma", "Top Flex", "Top Flex II"],
  ["puma", "Carina BDP II", "Carina BDP"], ["under armour", "Charged Wing 2", "Charged Wing"],
];

export function evaluate(rows: AuditRow[]) {
  const items = rows.map(prepare).sort((a, b) => a.productId.localeCompare(b.productId));
  const dafiti = items.filter(r => r.merchant === "Dafiti BR");
  const fut = items.filter(r => r.merchant === "Fut Fanatics BR");
  if (items.length !== dafiti.length + fut.length) throw new Error("UNEXPECTED_MERCHANT");
  if (new Set(items.map(r => `${r.merchant}:${r.productId}`)).size !== items.length) throw new Error("DUPLICATE_PRODUCT_MERCHANT");
  const exactIndex = group(dafiti.filter(r => r.brand && r.normalizedName), key);
  const brandIndex = group(dafiti.filter(r => r.brand), r => r.brand);
  // Inverted trigrams avoid unrestricted cross-merchant Cartesian comparison.
  const postings = new Map<string, Map<string, Set<Item>>>();
  for (const [brand, list] of brandIndex) {
    const index = new Map<string, Set<Item>>();
    for (const item of list) for (const gram of item.grams) { const bucket = index.get(gram) ?? new Set<Item>(); bucket.add(item); index.set(gram, bucket); }
    postings.set(brand, index);
  }
  const exact: Pair[] = [], nonExact: Pair[] = [];
  let withExact = 0, withCandidate = 0, withSameBrand = 0;
  const productDecisions = counts();
  for (const f of fut) {
    const known = f.brand && f.normalizedName ? exactIndex.get(key(f)) ?? [] : [];
    if (known.length) { withExact++; for (const d of known) exact.push(pair(f, d)); continue; }
    const index = postings.get(f.brand);
    if (index) withSameBrand++;
    const pool = new Set<Item>();
    for (const gram of f.grams) for (const d of index?.get(gram) ?? []) pool.add(d);
    const candidates = [...pool].map(d => ({ d, score: similarity(f.grams, d.grams) }))
      .filter(c => c.score >= CONFIG.minSimilarity)
      .sort((a, b) => b.score - a.score || a.d.productId.localeCompare(b.d.productId)).slice(0, CONFIG.topK);
    if (!candidates.length) continue;
    withCandidate++;
    const evaluated = candidates.map(c => pair(f, c.d)); nonExact.push(...evaluated);
    productDecisions[evaluated.some(p => p.result.decision === "AUTO_MATCH") ? "AUTO_MATCH" : evaluated.some(p => p.result.decision === "REVIEW") ? "REVIEW" : "NO_MATCH"]++;
  }
  const all = [...exact, ...nonExact];
  const distribution = (pairs: Pair[]) => { const result = counts(); for (const p of pairs) result[p.result.decision]++; return result; };
  const auto = all.filter(p => p.result.decision === "AUTO_MATCH");
  const differentNames = auto.filter(p => p.futFanatics.name !== p.dafiti.name);
  const byBrand = [...group(auto, p => p.brand)].map(([brand, pairs]) => ({ brand, pairs: pairs.length, futProducts: new Set(pairs.map(p => p.futFanatics.productId)).size, exactPairs: pairs.filter(p => key(p.futFanatics) === key(p.dafiti)).length })).sort((a, b) => b.pairs - a.pairs || a.brand.localeCompare(b.brand));
  const lookup = (name: string) => normalize(name).split(" ").filter(t => t !== "tenis").join(" ");
  const positive = positiveControls.map(([brand, a, b]) => {
    const left = items.filter(r => r.brand === brand && lookup(r.name) === lookup(a));
    const right = items.filter(r => r.brand === brand && lookup(r.name) === lookup(b));
    const pairs: Pair[] = [];
    for (const l of left) for (const r of right) if (l.merchant !== r.merchant) pairs.push(l.merchant === "Fut Fanatics BR" ? pair(l, r) : pair(r, l));
    return { brand, requested: [a, b], occurrences: [left.length, right.length], foundCrossMerchant: pairs.length > 0, realPairs: pairs.map(publicPair) };
  });
  // Targeted negative-family probe bypasses top-K to expose missing-generation risks.
  // Residual model/qualifier signature ignores parsed generation ONLY for lookup.
  const signature = (p: ProductIdentity) => JSON.stringify([p.modelTokens, p.technicalQualifiers]);
  const negative = negativeControls.map(([brand, a, b]) => {
    const pa = parseProductIdentity({ name: `${brand} ${a}`, brand });
    const pb = parseProductIdentity({ name: `${brand} ${b}`, brand });
    const signatures = new Set([signature(pa), signature(pb)]);
    const families = items.filter(r => r.brand === brand && signatures.has(signature(r.identity)));
    const probes: Pair[] = [];
    for (const f of families.filter(r => r.merchant === "Fut Fanatics BR")) for (const d of families.filter(r => r.merchant === "Dafiti BR")) {
      if (f.identity.version !== d.identity.version || signature(f.identity) !== signature(d.identity)) probes.push(pair(f, d));
    }
    return { brand, requested: [a, b], syntheticControl: matchProductIdentities(pa, pb), realProductsInFamily: families.length, realPairCounts: distribution(probes), realAutoMatchViolations: probes.filter(p => p.result.decision === "AUTO_MATCH").map(publicPair), realPairs: probes.map(publicPair) };
  });
  const variantDistribution = (pairs: Pair[]) => {
    const result = counts(); for (const p of pairs) result[p.result.variantDecision]++; return result;
  };
  const candidateGroups = [...group(auto, p => p.futFanatics.productId).values()];
  const uniqueCount = (pairs: Pair[]) => new Set(pairs.map(p => masterIdentityKey(p.dafiti.identity))).size;
  const duplicates = [...group(items.filter(p => matchProductIdentities(p.identity, p.identity).variantDecision === "AUTO_MATCH"),
    p => JSON.stringify([p.merchant, masterIdentityKey(p.identity), p.identity.variant])).values()].filter(g => g.length > 1);
  const sampleRank = (p: Pair) => createHash("sha256").update(JSON.stringify([p.brand, p.futFanatics.productId, p.dafiti.productId])).digest("hex");
  const sample = (pairs: Pair[]) => pairs.map(p => ({ p, rank: sampleRank(p) })).sort((a, b) => a.rank.localeCompare(b.rank)).map(({ p }) => p)
    .slice(0, 20).map(p => ({ brand: p.brand, futFanatics: p.futFanatics.name, dafiti: p.dafiti.name,
      futProductId: p.futFanatics.productId, dafitiProductId: p.dafiti.productId,
      masterDecision: p.result.masterDecision, variantDecision: p.result.variantDecision,
      masterConfidence: p.result.masterConfidence, variantConfidence: p.result.variantConfidence,
      reasons: { master: p.result.master.reasons, variant: p.result.variant.reasons },
      conflicts: { master: p.result.master.conflicts, variant: p.result.variant.conflicts } }));
  const exactCounts = distribution(exact);
  const baseline = { AUTO_MATCH: 554, REVIEW: 9, NO_MATCH: 0 };
  return {
    identityV11: {
      master: distribution(all), variant: variantDistribution(all),
      positiveVariant: variantDistribution(exact), nonExactVariant: variantDistribution(nonExact),
      masterAutoVariantReview: auto.filter(p => p.result.variantDecision === "REVIEW").length,
      masterAutoVariantNoMatch: auto.filter(p => p.result.variantDecision === "NO_MATCH").length,
      candidates: {
        futWithExactlyOneMasterRecord: candidateGroups.filter(g => g.length === 1).length,
        futWithMultipleMasterRecords: candidateGroups.filter(g => g.length > 1).length,
        futWithExactlyOneUniqueMaster: candidateGroups.filter(g => uniqueCount(g) === 1).length,
        futWithMultipleUniqueMasters: candidateGroups.filter(g => uniqueCount(g) > 1).length,
        uniqueMasterCandidates: uniqueCount(auto),
        uniqueFutMasterEdges: candidateGroups.reduce((n, g) => n + uniqueCount(g), 0),
        recordMultiplicity: Object.fromEntries([...group(candidateGroups, g => String(g.length))].map(([n, g]) => [n, g.length])),
      },
      apparentDuplicates: {
        groups: duplicates.length, records: duplicates.reduce((n, g) => n + g.length, 0),
        extraRecords: duplicates.reduce((n, g) => n + g.length - 1, 0),
        byMerchant: [...group(duplicates, g => g[0].merchant)].map(([merchant, groups]) => ({ merchant, groups: groups.length, records: groups.reduce((n, g) => n + g.length, 0) })),
      },
      byBrand: [...group(all, p => p.brand)].map(([brand, pairs]) => ({ brand, master: distribution(pairs), variant: variantDistribution(pairs) })).sort((a, b) => a.brand.localeCompare(b.brand)),
      baselineComparison: { baseline, current: exactCounts,
        delta: { AUTO_MATCH: exactCounts.AUTO_MATCH - baseline.AUTO_MATCH, REVIEW: exactCounts.REVIEW - baseline.REVIEW, NO_MATCH: exactCounts.NO_MATCH - baseline.NO_MATCH },
        sameUniverse: dafiti.length === 11424 && fut.length === 5554 && exact.length === 563,
        requiresInvestigation: exactCounts.AUTO_MATCH < baseline.AUTO_MATCH || exactCounts.NO_MATCH > 0 || exact.length !== 563 || dafiti.length !== 11424 || fut.length !== 5554,
      },
      samples: {
        masterAutoDifferentNames: sample(differentNames),
        masterAutoVariantReview: sample(auto.filter(p => p.result.variantDecision === "REVIEW")),
        masterAutoVariantNoMatch: sample(auto.filter(p => p.result.variantDecision === "NO_MATCH")),
        masterReview: sample(all.filter(p => p.result.masterDecision === "REVIEW")),
      },
    },
    config: CONFIG, universe: { dafiti: dafiti.length, futFanatics: fut.length, expected: { dafiti: 11424, futFanatics: 5554 } },
    positiveControl: { sharedNormalizedGroups: new Set(exact.map(p => key(p.futFanatics))).size, oneToOneGroups: [...group(exact, p => key(p.futFanatics)).values()].filter(g => g.length === 1).length, futProducts: withExact, pairs: exact.length, decisions: distribution(exact), unexpectedNoMatches: exact.filter(p => p.result.decision === "NO_MATCH").map(publicPair), reviews: exact.filter(p => p.result.decision === "REVIEW").map(publicPair) },
    nonExact: { futProducts: fut.length - withExact, withSameBrand, withCandidate, withoutCandidate: fut.length - withExact - withCandidate, pairs: nonExact.length, pairDecisions: distribution(nonExact), productDecisions },
    autoMatch: { identicalRawNames: auto.filter(p => p.futFanatics.name === p.dafiti.name).map(publicPair), differentRawNames: differentNames.map(publicPair), differentNormalizedNames: differentNames.filter(p => key(p.futFanatics) !== key(p.dafiti)).length, byBrand },
    positiveRegressions: positive, negativeRegressions: negative,
    nonExactEvaluations: nonExact.map(publicPair),
    warnings: ["Not a labeled ground truth; positive predictive value cannot be estimated from names alone", "Same family is not necessarily the same commercial variant", "Top-K and threshold limit candidate recall", "Detailed pair output requires --detailed; samples are deterministic and limited to 20 per category", "Master signatures group observed evidence only; duplicates are apparent, never deleted", "Variant AUTO_MATCH without GTIN means observed attributes agree, not proof of identical SKU"],
  };
}

/** Compact CLI output; evaluate() retains its V1 detailed API for offline consumers. */
export function summarize(report: ReturnType<typeof evaluate>) {
  const { autoMatch, positiveControl, positiveRegressions, negativeRegressions, nonExactEvaluations, ...rest } = report;
  return { ...rest,
    positiveControl: { ...positiveControl, unexpectedNoMatches: positiveControl.unexpectedNoMatches.slice(0, 20), reviews: positiveControl.reviews.slice(0, 20) },
    autoMatch: { identicalRawNames: autoMatch.identicalRawNames.length, differentRawNames: autoMatch.differentRawNames.length, differentNormalizedNames: autoMatch.differentNormalizedNames, byBrand: autoMatch.byBrand },
    positiveRegressions: positiveRegressions.map(({ realPairs, ...control }) => ({ ...control, realPairCount: realPairs.length })),
    negativeRegressions: negativeRegressions.map(({ realPairs, realAutoMatchViolations, ...control }) => ({ ...control, realAutoMatchViolationCount: realAutoMatchViolations.length })),
  };
}

export async function run() {
  const connectionString = process.env.AWIN_CURATOR_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_CONNECTION_UNAVAILABLE");
  const client = new pg.Client({ connectionString, connectionTimeoutMillis:10000, application_name:"product_identity_offline_read_only", options:"-c default_transaction_read_only=on -c statement_timeout=30000" });
  try {
    await client.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const readOnly = (await client.query("SHOW transaction_read_only")).rows[0].transaction_read_only;
    if (readOnly !== "on") throw new Error("READ_ONLY_REQUIRED");
    const snapshotTime = (await client.query("SELECT CURRENT_TIMESTAMP AS snapshot_time")).rows[0].snapshot_time;
    const rows = (await client.query(`SELECT c.product_id AS "productId", m.name AS merchant, c.product_name AS name, c.brand_normalized AS brand FROM catalog_search_products c JOIN commerce_merchants m ON m.id=c.merchant_id WHERE c.catalog_state='CATALOG_ELIGIBLE' AND c.available=true AND m.name = ANY($1::text[]) ORDER BY m.name,c.product_id`, [["Dafiti BR", "Fut Fanatics BR"]])).rows as AuditRow[];
    await client.query("ROLLBACK");
    const sourceHashes = Object.fromEntries(["parser.ts", "matcher.ts"].map(name => [name, createHash("sha256").update(readFileSync(new URL(`../shared/product-identity/${name}`, import.meta.url))).digest("hex")]));
    console.log(JSON.stringify({ snapshotTime, transactionReadOnly: readOnly, sourceHashes, ...(process.argv.includes("--detailed") ? evaluate(rows) : summarize(evaluate(rows))) }, null, 2));
  } finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    // Do not print connection strings, hosts, or database error details.
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "AUDIT_FAILED";
    console.error(JSON.stringify({ status: "BLOCKED", code, resultsPersisted: false }));
    process.exitCode = 1;
  });
}
