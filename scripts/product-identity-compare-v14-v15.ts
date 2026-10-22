/** File-only comparison. No parser, matcher, database, environment loading or evaluation. */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { canonical, compare, identityInputSchema, pairKey } from "../server/productIdentity/contracts";
const decision = z.enum(["AUTO_MATCH", "REVIEW", "NO_MATCH"]);
const evidence = z.object({ decision, reasons: z.array(z.string()), conflicts: z.array(z.string()) });
const reportSchema = z.object({
  transactionReadOnly: z.literal("on"), rollback: z.literal(true),
  timings: z.record(z.number()),
  shadow: z.object({ status: z.literal("COMPLETE"), logical: z.object({
    mode: z.literal("SHADOW"), versions: z.record(z.string()), config: z.record(z.number()),
    coverageLimited: z.boolean(), inputManifestHash: z.string(),
    snapshots: z.array(z.object({ key: z.string(), productId: z.string(), providerId: z.string(), merchantId: z.string(),
      input: identityInputSchema, scope: z.object({ kind: z.string(), variantId: z.string().optional() }) })),
    parses: z.array(z.object({ key: z.string(), parsed: z.object({
      master: z.unknown(), variant: z.unknown(), ambiguities: z.array(z.string()),
    }) })),
    candidates: z.array(z.object({ key: z.string(), left: z.string(), right: z.string(), similarity: z.number() })),
    pairs: z.array(z.object({ key: z.string(), left: z.string(), right: z.string(),
      purpose: z.string(), result: z.object({ masterDecision: decision, variantDecision: decision, master: evidence, variant: evidence }) })),
    groups: z.array(z.object({ id: z.string(), members: z.array(z.string()).min(1) })),
    identityCoverage: z.object({ candidatesTruncated: z.number(), unexaminedPairs: z.number(),
      retrievalComparisons: z.number(), unevaluatedPairs: z.number() }),
  }) }),
});
type Report = z.infer<typeof reportSchema>;
function index<T extends { key: string }>(rows: T[]) {
  const result = new Map(rows.map(r => [r.key, r]));
  if (result.size !== rows.length) throw new Error("DUPLICATE_KEY");
  return result;
}
function prepare(raw: unknown) {
  const report = reportSchema.parse(raw), l = report.shadow.logical;
  const snapshots = index(l.snapshots), parses = index(l.parses), pairs = index(l.pairs), candidates = index(l.candidates);
  if (parses.size !== snapshots.size || [...parses.keys()].some(k => !snapshots.has(k))) throw new Error("PARSE_COVERAGE_INVALID");
  for (const rows of [pairs, candidates]) for (const p of rows.values()) {
    if (p.left === p.right || !snapshots.has(p.left) || !snapshots.has(p.right) || p.key !== pairKey(p.left, p.right)) throw new Error("PAIR_INVALID");
  }
  for (const p of pairs.values()) if (p.result.masterDecision !== p.result.master.decision ||
      p.result.variantDecision !== p.result.variant.decision) throw new Error("DECISION_INCONSISTENT");
  const memberships = new Map<string, { id: string; members: string[] }>();
  const ids = new Set<string>();
  for (const g of l.groups) {
    if (ids.has(g.id)) throw new Error("DUPLICATE_GROUP");
    ids.add(g.id);
    for (const k of g.members) {
      if (!snapshots.has(k) || memberships.has(k)) throw new Error("GROUP_MEMBERSHIP_INVALID");
      memberships.set(k, g);
    }
  }
  if (memberships.size !== snapshots.size) throw new Error("GROUP_COVERAGE_INVALID");
  return { report, l, snapshots, parses, pairs, candidates, memberships };
}
function summary(p: ReturnType<typeof prepare>) {
  const { l, snapshots, pairs } = p;
  const master = { AUTO_MATCH: 0, REVIEW: 0, NO_MATCH: 0 }, variant = { ...master };
  for (const pair of pairs.values()) { master[pair.result.masterDecision]++; variant[pair.result.variantDecision]++; }
  const sizes = l.groups.map(g => g.members.length);
  const invalidInternalPairs: Array<{ group: string; left: string; right: string; decision: string }> = [];
  for (const g of l.groups) for (let i = 0; i < g.members.length; i++) for (let j = i + 1; j < g.members.length; j++) {
    const [left, right] = [g.members[i], g.members[j]];
    const value = pairs.get(pairKey(left, right))?.result.masterDecision ?? "NOT_EVALUATED";
    if (value !== "AUTO_MATCH") invalidInternalPairs.push({ group: g.id, left, right, decision: value });
  }
  return { cohortSize: snapshots.size, master, variant, evaluatedPairs: pairs.size, candidatePairs: p.candidates.size,
    truncations: l.identityCoverage.candidatesTruncated, unexaminedPairs: l.identityCoverage.unexaminedPairs,
    unevaluatedPairs: l.identityCoverage.unevaluatedPairs, retrievalComparisons: l.identityCoverage.retrievalComparisons,
    coverageLimited: l.coverageLimited, groups: { total: sizes.length, singletons: sizes.filter(n => n === 1).length,
      two: sizes.filter(n => n === 2).length, three: sizes.filter(n => n === 3).length, fourPlus: sizes.filter(n => n >= 4).length,
      largest: Math.max(0, ...sizes),
      multiMerchant: l.groups.filter(g => new Set(g.members.map(k => canonical([snapshots.get(k)!.providerId, snapshots.get(k)!.merchantId]))).size > 1).length,
      multiProvider: l.groups.filter(g => new Set(g.members.map(k => snapshots.get(k)!.providerId)).size > 1).length },
    groupSafety: { valid: invalidInternalPairs.length === 0, invalidInternalPairs }, budgets: l.config, versions: l.versions, timings: p.report.timings };
}
export function compareReports(beforeRaw: unknown, afterRaw: unknown) {
  const before = prepare(beforeRaw), after = prepare(afterRaw);
  const common = [...before.snapshots.keys()].filter(k => after.snapshots.has(k)).sort(compare);
  const removed = [...before.snapshots.keys()].filter(k => !after.snapshots.has(k)).sort(compare);
  const added = [...after.snapshots.keys()].filter(k => !before.snapshots.has(k)).sort(compare);
  const changedInputs = common.filter(k => canonical({ input: before.snapshots.get(k)!.input, scope: before.snapshots.get(k)!.scope }) !==
    canonical({ input: after.snapshots.get(k)!.input, scope: after.snapshots.get(k)!.scope }));
  const comparability = { sameMembership: !added.length && !removed.length, sameInputsAndScopes: !changedInputs.length,
    comparable: !added.length && !removed.length && !changedInputs.length,
    common: common.length, added, removed, changedInputs,
    sameBudgets: canonical(before.l.config) === canonical(after.l.config),
    manifestHashes: [before.l.inputManifestHash, after.l.inputManifestHash] };
  const changedGroups = common.filter(k => canonical([...before.memberships.get(k)!.members].sort(compare)) !==
    canonical([...after.memberships.get(k)!.members].sort(compare))).map(key => ({ key,
    productId: before.snapshots.get(key)!.productId,
    before: before.memberships.get(key)!, after: after.memberships.get(key)! }));
  // Report overlap, including singleton absorption. Missing/new cohort members are
  // separate from splits/unions; changed inputs prevent causal version attribution.
  const reunified = after.l.groups.flatMap(g => {
    const sources = [...new Set(g.members.filter(k => before.memberships.has(k)).map(k => before.memberships.get(k)!.id))].sort(compare);
    if (sources.length < 2) return [];
    return [{ after: g, before: sources.map(id => before.l.groups.find(g => g.id === id)!),
      completeUnion: sources.every(id => before.l.groups.find(g => g.id === id)!.members.every(k => g.members.includes(k))),
      includesPreviousSingletons: sources.some(id => before.l.groups.find(g => g.id === id)!.members.length === 1) }];
  });
  const split = before.l.groups.flatMap(g => {
    const targets = [...new Set(g.members.filter(k => after.memberships.has(k)).map(k => after.memberships.get(k)!.id))].sort(compare);
    return targets.length > 1 ? [{ before: g, after: targets.map(id => after.l.groups.find(g => g.id === id)!) }] : [];
  });
  const parseChanges = common.flatMap(key => {
    const a = before.parses.get(key)!.parsed, b = after.parses.get(key)!.parsed;
    return canonical(a) === canonical(b) ? [] : [{ key, nameBefore: before.snapshots.get(key)!.input.name,
      nameAfter: after.snapshots.get(key)!.input.name, before: a, after: b }];
  });
  const pairKeys = [...new Set([...before.pairs.keys(), ...after.pairs.keys()])].sort(compare);
  const pairChanges = pairKeys.flatMap(key => {
    const a = before.pairs.get(key), b = after.pairs.get(key);
    if (a && b && a.result.masterDecision === b.result.masterDecision && a.result.variantDecision === b.result.variantDecision) return [];
    return [{ key, left: (a ?? b)!.left, right: (a ?? b)!.right,
      before: a?.result ?? null, after: b?.result ?? null,
      beforePurpose: a?.purpose ?? null, afterPurpose: b?.purpose ?? null,
      sameInputs: [ (a ?? b)!.left, (a ?? b)!.right ].every(k => before.snapshots.has(k) && after.snapshots.has(k) && !changedInputs.includes(k)) }];
  });
  const transitions = (level: "masterDecision" | "variantDecision") => {
    const changes = {
    newAutoMatch: pairChanges.filter(p => p.after?.[level] === "AUTO_MATCH" && p.before?.[level] !== "AUTO_MATCH"),
    lostAutoMatch: pairChanges.filter(p => p.before?.[level] === "AUTO_MATCH" && p.after?.[level] !== "AUTO_MATCH"),
    reviewToAutoMatch: pairChanges.filter(p => p.before?.[level] === "REVIEW" && p.after?.[level] === "AUTO_MATCH"),
    noMatchToAutoMatch: pairChanges.filter(p => p.before?.[level] === "NO_MATCH" && p.after?.[level] === "AUTO_MATCH"),
    previouslyNotEvaluatedToAutoMatch: pairChanges.filter(p => !p.before && p.after?.[level] === "AUTO_MATCH"),
    autoMatchNowNotEvaluated: pairChanges.filter(p => p.before?.[level] === "AUTO_MATCH" && !p.after),
    };
    return { counts: Object.fromEntries(Object.entries(changes).map(([key, values]) => [key, values.length])), ...changes };
  };
  const candidateKeysBefore = new Set(before.candidates.keys()), candidateKeysAfter = new Set(after.candidates.keys());
  return { comparability, before: summary(before), after: summary(after),
    candidateChanges: { added: [...candidateKeysAfter].filter(k => !candidateKeysBefore.has(k)).sort(compare),
      removed: [...candidateKeysBefore].filter(k => !candidateKeysAfter.has(k)).sort(compare) },
    groups: { changedProducts: changedGroups.length, changedGroups, reunified, split },
    parseChanges, pairChanges, transitions: { master: transitions("masterDecision"), variant: transitions("variantDecision") },
    warnings: ["More AUTO_MATCH or groups is not proof of quality; no human accuracy estimate is computed.",
      "Absent pair means NOT_EVALUATED, not NO_MATCH. Pair totals depend on retrieval and group verification.",
      "Unions/splits describe membership overlap, not independently validated product identity.",
      ...(!comparability.comparable ? ["COHORTS_NOT_COMPARABLE: input or membership drift prevents attributing differences solely to V1.5."] : []),
      ...(!comparability.sameBudgets ? ["BUDGETS_DIFFER: costs and coverage are not controlled."] : [])] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] === args[1]) throw new Error("TWO_DISTINCT_REPORTS_REQUIRED");
    console.log(JSON.stringify(compareReports(...args.map(p => JSON.parse(readFileSync(p, "utf8"))) as [unknown, unknown]), null, 2));
  } catch {
    console.error("IDENTITY_COMPARISON_FAILED: supply two valid, distinct, complete read-only SHADOW JSON reports.");
    process.exitCode = 1;
  }
}
