import { z } from "zod";
import type { ProductIdentity } from "../../shared/product-identity/parser";
import { compare, pairKey, type Snapshot } from "./contracts";

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
/** Brand blocks, compatible known types, token Dice retrieval. Scores never decide identity. */
export function generateCandidates(items: Prepared[], config: Config) {
  const sorted = [...items].sort((a, b) => compare(a.snapshot.key, b.snapshot.key));
  const blocks = new Map<string, Prepared[]>();
  const tokens = new Map(sorted.map(i => [i.snapshot.key, new Set(i.parsed.normalizedTokens)]));
  for (const item of sorted) if (item.parsed.brand) {
    const bucket = blocks.get(item.parsed.brand) ?? [];
    bucket.push(item); blocks.set(item.parsed.brand, bucket);
  }
  const qualified: Candidate[] = [];
  let retrievalComparisons = 0, unexaminedPairs = 0;
  for (const brand of [...blocks.keys()].sort(compare)) {
    const block = blocks.get(brand)!;
    for (let i = 0; i < block.length; i++) for (let j = i + 1; j < block.length; j++) {
      const a = block[i], b = block[j];
      if (a.snapshot.providerId === b.snapshot.providerId && a.snapshot.merchantId === b.snapshot.merchantId) continue;
      if (a.parsed.productType && b.parsed.productType && a.parsed.productType !== b.parsed.productType) continue;
      if (retrievalComparisons >= config.maxRetrievalComparisons) { unexaminedPairs++; continue; }
      retrievalComparisons++;
      const similarity = dice(tokens.get(a.snapshot.key)!, tokens.get(b.snapshot.key)!);
      if (similarity < config.minSimilarity) continue;
      qualified.push({ key: pairKey(a.snapshot.key, b.snapshot.key), left: a.snapshot.key, right: b.snapshot.key, similarity });
    }
  }
  qualified.sort((a, b) => b.similarity - a.similarity || compare(a.key, b.key));
  const degree = new Map<string, number>();
  const candidates: Candidate[] = [], truncated: Candidate[] = [];
  for (const pair of qualified) {
    if ((degree.get(pair.left) ?? 0) >= config.maxCandidatesPerProduct || (degree.get(pair.right) ?? 0) >= config.maxCandidatesPerProduct) {
      truncated.push(pair); continue;
    }
    candidates.push(pair);
    for (const key of [pair.left, pair.right]) degree.set(key, (degree.get(key) ?? 0) + 1);
  }
  return { candidates, truncated, retrievalComparisons, unexaminedPairs,
    withoutCandidate: sorted.filter(i => !degree.has(i.snapshot.key)).map(i => ({
      key: i.snapshot.key,
      reason: !i.parsed.brand ? "BRAND_MISSING" : truncated.some(p => p.left === i.snapshot.key || p.right === i.snapshot.key)
        ? "CANDIDATE_LIMIT" : unexaminedPairs ? "RETRIEVAL_INCOMPLETE" : "NONE_IN_SEARCHED_BLOCKS",
    })) };
}
