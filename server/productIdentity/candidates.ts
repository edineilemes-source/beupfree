import { z } from "zod";
import type { ProductIdentity } from "../../shared/product-identity/parser";
import { canonical, compare, pairKey, type Snapshot } from "./contracts";

export const configSchema = z.object({
  minSimilarity: z.number().min(0).max(1).default(0.35),
  maxCandidatesPerProduct: z.number().int().min(0).max(100).default(5),
  maxRetrievalComparisons: z.number().int().min(0).max(1000000).default(100000),
  maxEvaluatedPairs: z.number().int().min(0).max(100000).default(20000),
}).strict();
export type Config = z.infer<typeof configSchema>;
export type Prepared = { snapshot: Snapshot; parsed: ProductIdentity };
export type Candidate = { key: string; left: string; right: string; similarity: number };
const dice = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const token of a) if (b.has(token)) common++;
  return 2 * common / (a.size + b.size);
};
/** Structural evidence is a retrieval priority, never an identity decision.
 * Ignore spelling of versionTokens, but retain all semantic Master fields and
 * model multiplicity. Ambiguous or incomplete parses use ordinary title Dice.
 */
const structuralKey = (p: ProductIdentity) => p.brand && p.productType && p.modelTokens.length && !p.ambiguities.length
  ? canonical([p.brand, p.productType, p.modelTokens, p.version, p.technicalQualifiers]) : null;

/** Brand/type blocks. Exact structural proposals precede title Dice proposals.
 * Both passes share the same comparison budget; each eligible pair is scored once.
 * An exact-evidence forest reserves top-K slots for bridges rather than cycles.
 * Only the matcher and complete boundary verification can authorize grouping.
 */
export function generateCandidates(items: Prepared[], config: Config) {
  const sorted = [...items].sort((a, b) => compare(a.snapshot.key, b.snapshot.key));
  const blocks = new Map<string, Prepared[]>();
  const tokens = new Map(sorted.map(i => [i.snapshot.key, new Set(i.parsed.normalizedTokens)]));
  const signatures = new Map(sorted.map(i => [i.snapshot.key, structuralKey(i.parsed)]));
  for (const item of sorted) if (item.parsed.brand) {
    const bucket = blocks.get(item.parsed.brand) ?? [];
    bucket.push(item); blocks.set(item.parsed.brand, bucket);
  }
  const qualified: Array<Candidate & { exact: boolean }> = [];
  let retrievalComparisons = 0, unexaminedPairs = 0;
  for (const exactPass of [true, false]) for (const brand of [...blocks.keys()].sort(compare)) {
    const block = blocks.get(brand)!;
    for (let i = 0; i < block.length; i++) for (let j = i + 1; j < block.length; j++) {
      const a = block[i], b = block[j];
      if (a.snapshot.providerId === b.snapshot.providerId && a.snapshot.merchantId === b.snapshot.merchantId) continue;
      if (a.parsed.productType && b.parsed.productType && a.parsed.productType !== b.parsed.productType) continue;
      const signature = signatures.get(a.snapshot.key);
      const exact = signature != null && signature === signatures.get(b.snapshot.key);
      if (exact !== exactPass) continue;
      if (retrievalComparisons >= config.maxRetrievalComparisons) { unexaminedPairs++; continue; }
      retrievalComparisons++;
      const similarity = exact ? 1 : dice(tokens.get(a.snapshot.key)!, tokens.get(b.snapshot.key)!);
      if (similarity < config.minSimilarity) continue;
      qualified.push({ key: pairKey(a.snapshot.key, b.snapshot.key), left: a.snapshot.key, right: b.snapshot.key, similarity, exact });
    }
  }
  qualified.sort((a, b) => Number(b.exact) - Number(a.exact) || b.similarity - a.similarity || compare(a.key, b.key));
  const degree = new Map<string, number>();
  const candidates: Candidate[] = [], truncated: Candidate[] = [];
  const parent = new Map(sorted.map(i => [i.snapshot.key, i.snapshot.key]));
  const root = (key: string): string => {
    let r = key;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (key !== r) { const next = parent.get(key)!; parent.set(key, r); key = next; }
    return r;
  };
  const selected = new Set<string>();
  const hasRoom = (p: Candidate) => (degree.get(p.left) ?? 0) < config.maxCandidatesPerProduct &&
    (degree.get(p.right) ?? 0) < config.maxCandidatesPerProduct;
  const accept = ({ exact: _exact, ...pair }: Candidate & { exact: boolean }) => {
    candidates.push(pair); selected.add(pair.key);
    for (const key of [pair.left, pair.right]) degree.set(key, (degree.get(key) ?? 0) + 1);
  };
  // This connectivity is scheduling only; it is not emitted as inferred groups.
  for (const pair of qualified) if (pair.exact && hasRoom(pair) && root(pair.left) !== root(pair.right)) {
    parent.set(root(pair.right), root(pair.left)); accept(pair);
  }
  for (const pair of qualified) {
    if (selected.has(pair.key)) continue;
    if (!hasRoom(pair)) {
      const { exact: _exact, ...candidate } = pair;
      truncated.push(candidate); continue;
    }
    accept(pair);
  }
  return { candidates, truncated, retrievalComparisons, unexaminedPairs,
    withoutCandidate: sorted.filter(i => !degree.has(i.snapshot.key)).map(i => ({
      key: i.snapshot.key,
      reason: !i.parsed.brand ? "BRAND_MISSING" : truncated.some(p => p.left === i.snapshot.key || p.right === i.snapshot.key)
        ? "CANDIDATE_LIMIT" : unexaminedPairs ? "RETRIEVAL_INCOMPLETE" : "NONE_IN_SEARCHED_BLOCKS",
    })) };
}
