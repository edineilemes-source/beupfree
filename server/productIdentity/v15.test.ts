import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fixtureRow } from "./fixtures";
import { adaptReconciledRows } from "./adapter";
import { canonical, compare, pairKey, snapshot } from "./contracts";
import { configSchema, generateCandidates, type Prepared, type Candidate } from "./candidates";
import { runShadow } from "./shadow";
import { parseProductIdentity } from "../../shared/product-identity/parser";
const prepare = (rows: ReturnType<typeof fixtureRow>[]) => adaptReconciledRows(rows).map(r => ({ snapshot: snapshot(r), parsed: parseProductIdentity(r.input) }));
// Frozen V1.4 scheduling reference for bounded fixtures only, not a production matcher.
function legacyCandidates(items: Prepared[], max = 5, budget = 100000) {
  const sorted = [...items].sort((a, b) => compare(a.snapshot.key, b.snapshot.key));
  const qualified: Candidate[] = []; let comparisons = 0;
  for (const brand of [...new Set(sorted.map(i => i.parsed.brand).filter(Boolean))].sort()) {
    const block = sorted.filter(i => i.parsed.brand === brand);
    for (let i = 0; i < block.length; i++) for (let j = i + 1; j < block.length; j++) {
      const a = block[i], b = block[j];
      if (a.snapshot.providerId === b.snapshot.providerId && a.snapshot.merchantId === b.snapshot.merchantId) continue;
      if (a.parsed.productType && b.parsed.productType && a.parsed.productType !== b.parsed.productType) continue;
      if (comparisons >= budget) continue; comparisons++;
      const left = new Set(a.parsed.normalizedTokens), right = new Set(b.parsed.normalizedTokens);
      const score = 2 * [...left].filter(t => right.has(t)).length / (left.size + right.size);
      if (score >= .35) qualified.push({ key: pairKey(a.snapshot.key, b.snapshot.key), left: a.snapshot.key, right: b.snapshot.key, similarity: score });
    }
  }
  qualified.sort((a, b) => b.similarity - a.similarity || compare(a.key, b.key));
  const degrees = new Map<string, number>();
  return qualified.filter(p => {
    if ((degrees.get(p.left) ?? 0) >= max || (degrees.get(p.right) ?? 0) >= max) return false;
    for (const k of [p.left, p.right]) degrees.set(k, (degrees.get(k) ?? 0) + 1);
    return true;
  });
}
function components(items: Prepared[], pairs: Candidate[]) {
  const groups = items.map(i => new Set([i.snapshot.key]));
  for (const p of pairs) {
    const a = groups.find(g => g.has(p.left))!, b = groups.find(g => g.has(p.right))!;
    if (a !== b) { for (const k of b) a.add(k); groups.splice(groups.indexOf(b), 1); }
  }
  return groups;
}
function safety(r: ReturnType<typeof runShadow>["logical"]) {
  const pairs = new Map(r.pairs.map(p => [p.key, p]));
  const members = r.groups.flatMap(g => g.members);
  assert.equal(new Set(members).size, r.snapshots.length); assert.equal(members.length, r.snapshots.length);
  for (const g of r.groups) for (let i = 0; i < g.members.length; i++) for (let j = i + 1; j < g.members.length; j++) {
    assert.equal(pairs.get(pairKey(g.members[i], g.members[j]))?.result.masterDecision, "AUTO_MATCH");
  }
}
function crowded() {
  return ["Preto", "Branco"].flatMap((color, c) => ["a", "b"].flatMap(merchant =>
    Array.from({ length: 6 }, (_, i) => fixtureRow(`${c}-${merchant}-${i}`, `Tênis Acme Orbit Pro Speed Tech Feminino ${color}`, merchant))));
}
test("V1.5 top-K=5 bridges exact Master components before redundant cycles; V1.4 fragments", () => {
  const items = prepare(crowded()), config = configSchema.parse({});
  const old = legacyCandidates(items), current = generateCandidates(items, config);
  assert.equal(components(items, old).length, 3); assert.equal(components(items, current.candidates).length, 1);
  assert.ok(current.truncated.length > 0);
  const degree = new Map<string, number>();
  for (const p of current.candidates) for (const k of [p.left, p.right]) degree.set(k, (degree.get(k) ?? 0) + 1);
  assert.ok([...degree.values()].every(n => n <= 5));
  assert.equal(current.retrievalComparisons, 144); assert.equal(current.unexaminedPairs, 0);
  assert.equal(new Set(current.candidates.map(p => p.key)).size, current.candidates.length);
  assert.deepEqual(current, generateCandidates([...items].reverse(), config));
  const r = runShadow(adaptReconciledRows(crowded())).logical;
  assert.equal(r.groups.length, 1); assert.equal(r.groups[0].members.length, 24); safety(r);
  console.log(JSON.stringify({ fixture: "crowded-same-master", beforeComponents: 3, afterComponents: 1,
    beforeCandidatePairs: old.length, afterCandidatePairs: current.candidates.length,
    comparisons: current.retrievalComparisons, evaluatedPairs: r.pairs.length, topK: 5 }));
});
test("V1.5 stronger structural proposals precede inferior title proposals before both budgets", () => {
  const rows = [fixtureRow("z-anchor", "Tênis Acme Orbit Pro Speed Tech Feminino Verde", "a"),
    fixtureRow("z-strong", "Tênis Acme Tech Speed Pro Orbit Masculino Branco", "b"),
    ...Array.from({ length: 20 }, (_, i) => fixtureRow(`a-inferior-${i}`, `Tênis Acme Orbit Pro Speed Tech Feminino Verde Extra${i}`, "b"))];
  const items = prepare(rows), config = configSchema.parse({ maxCandidatesPerProduct: 1, maxRetrievalComparisons: 1 });
  const r = generateCandidates(items, config);
  const strong = items.find(i => i.snapshot.externalIdentityId === "identity-z-strong")!.snapshot.key;
  assert.equal(r.candidates.length, 1); assert.ok([r.candidates[0].left, r.candidates[0].right].includes(strong));
  assert.equal(r.retrievalComparisons, 1); assert.equal(r.unexaminedPairs, 20);
  assert.ok(!legacyCandidates(items, 1, 1).some(p => [p.left, p.right].includes(strong)));
});
test("V1.5 identical parsed evidence still requires matcher: generic models and qualifier conflicts REVIEW", () => {
  for (const name of ["Tênis Acme Casual Preto", "Tênis Acme Orbit Low Mid Preto"]) {
    const r = runShadow(adaptReconciledRows([fixtureRow("a", name, "a"), fixtureRow("b", name, "b")])).logical;
    assert.equal(r.candidates.length, 1); assert.equal(r.pairs[0].result.masterDecision, "REVIEW");
    assert.equal(r.groups.length, 2); safety(r);
  }
});
test("V1.5 exact path preserves multiset, versions, types, ambiguity and same-merchant exclusions", () => {
  const r = runShadow(adaptReconciledRows([
    fixtureRow("a", "Tênis Acme Orbit V2 Preto", "a"), fixtureRow("b", "Tênis Acme Orbit V2 Branco", "b"),
    fixtureRow("duplicate", "Tênis Acme Orbit Orbit V2 Branco", "b"), fixtureRow("v3", "Tênis Acme Orbit V3 Preto", "b"),
    fixtureRow("type", "Sandália Acme Orbit V2 Preto", "b"), fixtureRow("ambiguous", "Tênis Acme Orbit V2 V3 Preto", "b"),
  ])).logical;
  assert.ok(r.candidates.every(p => !p.key.includes('identity-type')));
  assert.ok(r.pairs.some(p => p.result.masterDecision === "NO_MATCH"));
  assert.ok(r.pairs.some(p => p.result.masterDecision === "REVIEW")); safety(r);
});
test("V1.5 bounded real KR7 regression preserves competing Fila proposals and reunites fragmented identities", () => {
  const fixture = JSON.parse(readFileSync(new URL("./v15-real-regression-fixture.json", import.meta.url), "utf8"));
  const toRow = (r: any) => fixtureRow(r.id, r.name, r.merchant, r.provider, r.brand);
  const rows = [...fixture.rows, ...fixture.competitors].map(toRow);
  const targets = prepare(fixture.rows.map(toRow));
  const keys = new Set(targets.map(p => p.snapshot.key));
  const oldCandidates = legacyCandidates(prepare(rows));
  const oldTargetCandidates = oldCandidates.filter(p => keys.has(p.left) && keys.has(p.right));
  const oldComponents = components(targets, oldTargetCandidates).length;
  assert.equal(oldComponents, 2);
  const r = runShadow(adaptReconciledRows(rows)).logical;
  const reunited = r.groups.find(g => g.members.includes(targets[0].snapshot.key))!;
  assert.ok(targets.every(t => reunited.members.includes(t.snapshot.key))); safety(r);
  console.log(JSON.stringify({ fixture: "real-KR7-subcohort", previousRealGroupSizes: [8, 5], legacyTargetComponents: oldComponents, legacyCandidatePairs: oldCandidates.length, afterTargetPartitionSizes: [13],
    fixtureIdentities: rows.length, reunitedTargetIdentities: targets.length, reunitedGroupSize: reunited.members.length,
    candidatePairs: r.candidates.length, evaluatedPairs: r.pairs.length, comparisons: r.identityCoverage.retrievalComparisons,
    truncated: r.truncatedCandidates.length, budgets: r.config,
    limitation: "154-identity same-brand local fixture, not a rerun or estimate for the 2000-identity cohort" }));
});
test("V1.5 all group boundary pairs stay confirmed under evaluation exhaustion", () => {
  const r = runShadow(adaptReconciledRows(crowded()), { maxEvaluatedPairs: 7 }).logical;
  assert.ok(r.unevaluatedPairs.length > 0); assert.ok(r.groupConflicts.length > 0); safety(r);
  assert.equal(r.pairs.length, 7);
});
test("V1.5 retrieval zero budgets stay explicit; deterministic output never fabricates matches", () => {
  for (const options of [{ maxCandidatesPerProduct: 0 }, { maxRetrievalComparisons: 0 }, { maxEvaluatedPairs: 0 }]) {
    const a = runShadow(adaptReconciledRows(crowded()), options).logical;
    const b = runShadow(adaptReconciledRows(crowded().reverse()), options).logical;
    assert.equal(canonical(a), canonical(b)); safety(a);
  }
});
