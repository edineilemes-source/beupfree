import { performance } from "node:perf_hooks";
import { parseProductIdentity } from "../../shared/product-identity/parser";
import { matchProductIdentities, type IdentityMatchResult } from "../../shared/product-identity/matcher";
import { adaptReconciledRows } from "./adapter";
import { configSchema, generateCandidates, type Config } from "./candidates";
import { canonical, compare, digest, pairKey, snapshot, VERSIONS, type MerchantProduct } from "./contracts";
import { simulateGroups } from "./grouping";
const counts = () => ({ AUTO_MATCH: 0, REVIEW: 0, NO_MATCH: 0 });

/** No commercial dependencies, callbacks or mutations. Failed runs contain no inferred identity. */
export function runShadow(products: MerchantProduct[], options: Partial<Config> = {}) {
  const started = performance.now(), heapBefore = process.memoryUsage().heapUsed;
  const config = configSchema.parse(options);
  if (products.length > 2000) throw new Error("SHADOW_INPUT_LIMIT");
  const items = products.map(snapshot).sort((a, b) => compare(a.key, b.key));
  const keys = items.map(i => i.key);
  if (new Set(keys).size !== keys.length || new Set(items.map(i => i.externalIdentityId)).size !== keys.length ||
    new Set(items.map(i => canonical([i.providerId, i.merchantId, i.externalProductKey]))).size !== keys.length) {
    throw new Error("DUPLICATE_MERCHANT_PRODUCT");
  }
  const prepared = items.map(snapshot => ({ snapshot, parsed: parseProductIdentity(snapshot.input) }));
  const byKey = new Map(prepared.map(p => [p.snapshot.key, p]));
  const retrieval = generateCandidates(prepared, config);
  const decisions = new Map<string, { key: string; left: string; right: string; purpose: "CANDIDATE" | "GROUP_VERIFICATION"; result: IdentityMatchResult }>();
  const unevaluated = new Set<string>();
  function evaluate(a: string, b: string, purpose: "CANDIDATE" | "GROUP_VERIFICATION") {
    const [left, right] = [a, b].sort(compare), key = pairKey(left, right);
    if (decisions.has(key)) return decisions.get(key)!.result.masterDecision;
    if (decisions.size >= config.maxEvaluatedPairs) { unevaluated.add(key); return "NOT_EVALUATED" as const; }
    const result = matchProductIdentities(byKey.get(left)!.parsed, byKey.get(right)!.parsed);
    decisions.set(key, { key, left, right, purpose, result });
    return result.masterDecision;
  }
  for (const p of retrieval.candidates) evaluate(p.left, p.right, "CANDIDATE");
  const automatic = [...decisions.values()].filter(p => p.result.masterDecision === "AUTO_MATCH");
  const grouping = simulateGroups(keys, automatic, (a, b) => evaluate(a, b, "GROUP_VERIFICATION"));
  const pairs = [...decisions.values()].sort((a, b) => compare(a.key, b.key));
  const master = counts(), variant = counts();
  for (const pair of pairs) { master[pair.result.masterDecision]++; variant[pair.result.variantDecision]++; }
  const inputManifestHash = digest(items.map(i => ({ key: i.key, inputHash: i.inputHash, scope: i.scope })));
  const logical = {
    mode: "SHADOW" as const, versions: VERSIONS, config,
    inputManifestHash, runKey: digest({ inputManifestHash, versions: VERSIONS, config }),
    coverageLimited: retrieval.truncated.length > 0 || retrieval.unexaminedPairs > 0 || unevaluated.size > 0,
    snapshots: items, parses: prepared.map(p => ({ key: p.snapshot.key, parsed: p.parsed })),
    providers: [...new Set(items.map(i => i.providerId))].sort(compare),
    merchants: [...new Set(items.map(i => canonical([i.providerId, i.merchantId])))].sort(compare),
    identityCoverage: {
      merchantProducts: items.length, productsWithCandidate: items.length - retrieval.withoutCandidate.length,
      productsWithoutCandidate: retrieval.withoutCandidate.length, candidatesGenerated: retrieval.candidates.length,
      evaluatedPairs: pairs.length, master, variant,
      simulatedGroups: grouping.groups.filter(g => g.members.length > 1).length,
      singletons: grouping.groups.filter(g => g.members.length === 1).length,
      groupConflicts: grouping.conflicts.length, candidatesTruncated: retrieval.truncated.length,
      retrievalComparisons: retrieval.retrievalComparisons, unexaminedPairs: retrieval.unexaminedPairs,
      unevaluatedPairs: unevaluated.size,
    },
    promotionalCoverage: { status: "NOT_MEASURED" as const, reason: "Commercial eligibility is independent and is not an identity input." },
    candidates: retrieval.candidates, withoutCandidate: retrieval.withoutCandidate,
    truncatedCandidates: retrieval.truncated, unevaluatedPairs: [...unevaluated].sort(compare),
    pairs, groups: grouping.groups, groupConflicts: grouping.conflicts,
  };
  return { status: "COMPLETE" as const, logical,
    measurements: { elapsedMs: performance.now() - started, heapDeltaBytes: process.memoryUsage().heapUsed - heapBefore } };
}
export function runReconciledShadow(raw: unknown, options: Partial<Config> = {}) {
  try { return runShadow(adaptReconciledRows(raw), options); }
  catch { return { status: "FAILED" as const, errorCode: "SHADOW_RUN_FAILED" as const,
    versions: VERSIONS }; } // Do not log exception messages: sources may contain secrets.
}
