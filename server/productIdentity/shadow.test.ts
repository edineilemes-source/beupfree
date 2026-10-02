import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { adaptReconciledRows } from "./adapter";
import { canonical, pairKey, snapshot } from "./contracts";
import { runReconciledShadow, runShadow } from "./shadow";
import { simulateGroups } from "./grouping";
import { fixtureRow as row, shadowFixture } from "./fixtures";
import { parseProductIdentity } from "../../shared/product-identity/parser";
import { matchProductIdentities } from "../../shared/product-identity/matcher";
const run = (rows = shadowFixture(), options = {}) => runShadow(adaptReconciledRows(rows), options);

test("singleton stays visible in identity coverage, without a universal NO_MATCH", () => {
  const r = run([row("one", "Tênis Acme Comet Preto")]).logical;
  assert.equal(r.identityCoverage.singletons, 1);
  assert.equal(r.withoutCandidate.length, 1);
  assert.equal(r.pairs.length, 0);
  assert.equal(r.identityCoverage.master.NO_MATCH, 0);
});
for (const count of [2, 3]) test(`same Master in ${count} merchants, with independent Variant decisions`, () => {
  const r = run(shadowFixture().slice(0, count)).logical;
  assert.equal(r.identityCoverage.simulatedGroups, 1);
  assert.equal(r.groups[0].members.length, count);
  assert.equal(r.identityCoverage.master.AUTO_MATCH, count * (count - 1) / 2);
  assert.equal(r.identityCoverage.variant.AUTO_MATCH, 1);
  assert.equal(r.identityCoverage.variant.NO_MATCH, count === 3 ? 2 : 0);
});
test("multiple candidates, third merchant and two providers with identical external IDs", () => {
  const r = run().logical;
  assert.equal(r.providers.length, 2);
  assert.equal(r.merchants.length, 3);
  const same = r.snapshots.filter(s => s.externalProductKey === "same-external-id");
  assert.equal(same.length, 2);
  assert.notEqual(same[0].key, same[1].key);
  assert.ok(r.candidates.filter(c => c.left === same[0].key || c.right === same[0].key).length > 1);
  assert.ok(r.identityCoverage.master.REVIEW > 0);
  assert.ok(r.identityCoverage.master.NO_MATCH > 0);
  assert.ok(r.withoutCandidate.some(p => p.key.includes("identity-solo")));
  assert.ok(r.withoutCandidate.some(p => p.key.includes("identity-missing") && p.reason === "BRAND_MISSING"));
});
test("editorial order is equivalent, unknown editorial tokens and functional edition stay conservative", () => {
  const r = run(shadowFixture().filter(r => r.identity.id.includes("evo"))).logical;
  assert.equal(r.identityCoverage.master.AUTO_MATCH, 1);
  assert.equal(r.identityCoverage.master.REVIEW, 2);
  const extra = run([row("a", "Tênis Acme Comet Preto"), row("b", "Tênis Acme Comet Edição Especial Preto", "merchant-b")]);
  assert.equal(extra.logical.pairs[0].result.masterDecision, "REVIEW");
});
test("additional ambiguous numbers preserve V1.2 evidence and never infer sizes", () => {
  const r = run(shadowFixture().filter(r => r.identity.id.includes("numeric"))).logical;
  assert.equal(r.pairs[0].result.masterDecision, "REVIEW");
  assert.ok(r.pairs[0].result.master.reasons.includes("AMBIGUOUS_ADDITIONAL_MODEL_NUMBER"));
  assert.ok(r.parses.some(p => p.parsed.modelTokens.includes("1285710")));
  assert.ok(r.parses.every(p => p.parsed.variant.size === null));
});
test("missing attributes stay missing, observed variants do not leak into a product title parse", () => {
  const a = row("a", "Tênis Acme Comet");
  a.variants = [{ id: "v1", productId: a.product.id, providerId: a.provider.id, merchantId: a.merchant.id,
    size: "40", colour: "preto", gtin: "4006381333931", mpn: "COMET" }];
  const dto = adaptReconciledRows([a])[0];
  assert.equal(dto.input.gtin, undefined);
  assert.equal(dto.input.size, undefined);
  assert.equal(dto.observedVariants[0].size, "40");
  const r = run([a, row("b", a.product.mainName, "merchant-b")]).logical;
  assert.equal(r.pairs[0].result.masterDecision, "AUTO_MATCH");
  assert.equal(r.pairs[0].result.variantDecision, "REVIEW");
  a.selectedVariantId = "v1";
  const selected = adaptReconciledRows([a])[0];
  assert.equal(selected.input.gtin, "4006381333931");
  assert.equal(selected.input.mpn, "COMET");
  assert.equal(selected.input.size, undefined, "schema has no explicit size system");
  assert.ok(selected.provenance.some(p => p.recordId === "v1" && p.field === "gtin"));
});
test("price, stock, discount, offer URL and operational timestamps cannot change identity hash", () => {
  const source = row("a", "Tênis Acme Comet");
  const changed = { ...structuredClone(source), offers: [{ currentPrice: 123, previousPrice: 456, stock: false, discount: 73, url: "https://example.test/promo" }] };
  changed.product.updatedAt = "2027-01-01T00:00:00Z";
  changed.identity.lastSeenAt = "2027-01-01T00:00:00Z";
  const [a, b] = [source, changed].map(r => snapshot(adaptReconciledRows([r])[0]));
  assert.equal(a.inputHash, b.inputHash);
  assert.notDeepEqual(a.timestamps, b.timestamps);
  assert.equal(canonical(b).includes("example.test"), false);
  assert.deepEqual(run([source]).logical.groups, run([changed]).logical.groups);
});
test("all allowed matcher attributes and relevant name/brand changes change the hash", () => {
  const dto = adaptReconciledRows([row("a", "Tênis Acme Comet V2 Preto")])[0];
  const hash = snapshot(dto).inputHash;
  for (const input of [
    { ...dto.input, name: "Tênis Acme Comet V3 Preto" },
    { ...dto.input, name: "Tênis Acme Comet V2 Pro Preto" },
    { ...dto.input, name: "Tênis Acme Orbit V2 Preto" },
    { ...dto.input, brand: "Other" }, { ...dto.input, gtin: "4006381333931" },
    { ...dto.input, mpn: "PART-42" }, { ...dto.input, size: { value: "40", system: "BR" } },
  ]) assert.notEqual(snapshot({ ...dto, input }).inputHash, hash);
});
test("same data, object order, variants order and input order yield the same logical report", () => {
  const source = shadowFixture(), before = structuredClone(source);
  const first = run(source);
  const reverseKeys = (value: any): any => Array.isArray(value) ? value.map(reverseKeys) : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverseKeys(v)])) : value;
  assert.equal(canonical(first.logical), canonical(run(reverseKeys([...source].reverse())).logical));
  assert.deepEqual(source, before);
  assert.ok(first.measurements.elapsedMs >= 0);
  assert.ok(Number.isFinite(first.measurements.heapDeltaBytes));
});
test("candidate degree limit applies to exact matches, reports truncation and is deterministic", () => {
  const source = shadowFixture().slice(0, 3);
  const a = run(source, { maxCandidatesPerProduct: 1 }).logical;
  assert.equal(a.candidates.length, 1);
  assert.equal(a.truncatedCandidates.length, 2);
  assert.equal(a.withoutCandidate.length, 1);
  assert.equal(a.withoutCandidate[0].reason, "CANDIDATE_LIMIT");
  assert.deepEqual(a, run(source.reverse(), { maxCandidatesPerProduct: 1 }).logical);
  const zero = run(source, { maxCandidatesPerProduct: 0 }).logical;
  assert.equal(zero.candidates.length, 0);
  assert.equal(zero.identityCoverage.master.NO_MATCH, 0);
});
test("retrieval/evaluation limits are explicit, with no invented decisions", () => {
  const source = shadowFixture().slice(0, 3);
  const retrieval = run(source, { maxRetrievalComparisons: 0 }).logical;
  assert.equal(retrieval.identityCoverage.unexaminedPairs, 3);
  assert.equal(retrieval.pairs.length, 0);
  const evaluation = run(source, { maxEvaluatedPairs: 0 }).logical;
  assert.equal(evaluation.unevaluatedPairs.length, 3);
  assert.equal(evaluation.groups.length, 3);
  assert.equal(evaluation.pairs.length, 0);
});
for (const blocked of ["REVIEW", "NO_MATCH", "NOT_EVALUATED"] as const) test(`A-B-C checks the missing pair and prevents conflicting merge: ${blocked}`, () => {
  // Synthetic decision graph: V1.2 Master AUTO_MATCH is currently structurally transitive.
  // This tests the grouping policy independently, without changing or replacing V1.2 in the runner.
  const calls: string[] = [];
  const result = simulateGroups(["c", "a", "b"], [{ left: "a", right: "b" }, { left: "b", right: "c" }], (a, b) => {
    calls.push(pairKey(a, b));
    return pairKey(a, b) === pairKey("a", "c") ? blocked : "AUTO_MATCH";
  });
  assert.ok(calls.includes(pairKey("a", "c")));
  assert.equal(result.groups.length, 2);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].blockedPairs[0].decision, blocked);
});
test("valid complete group checks a pair not proposed by retrieval", () => {
  const calls: string[] = [];
  const r = simulateGroups(["a", "b", "c"], [{ left: "a", right: "b" }, { left: "b", right: "c" }], (a, b) => {
    calls.push(pairKey(a, b)); return "AUTO_MATCH";
  });
  assert.equal(r.groups.length, 1);
  assert.ok(calls.includes(pairKey("a", "c")));
});
test("source relation conflicts and invalid inputs fail locally with sanitized errors", () => {
  const a = row("a", "Tênis Acme Comet");
  a.merchant.providerId = "wrong";
  assert.equal(runReconciledShadow([a]).status, "FAILED");
  const malformed = [{ secret: "do-not-print", product: null }];
  const result = runReconciledShadow(malformed);
  assert.equal(result.status, "FAILED");
  assert.equal(JSON.stringify(result).includes("do-not-print"), false);
  assert.equal(runReconciledShadow(shadowFixture(), { minSimilarity: NaN }).status, "FAILED");
  assert.equal(runReconciledShadow(Array(2001).fill(row("a", "Comet"))).status, "FAILED");
  assert.equal(runReconciledShadow([row("a", "Comet"), row("a", "Comet")]).status, "FAILED");
});
test("ambiguous variant association is diagnosed, cannot select or transfer a variant", () => {
  const a = row("a", "Tênis Acme Comet"), b = structuredClone(a);
  b.identity.id = "identity-b";
  b.identity.externalProductKey = "external-b";
  a.variants = [{ id: "v1", productId: a.product.id, providerId: a.provider.id, merchantId: a.merchant.id }];
  const dtos = adaptReconciledRows([a, b]);
  assert.ok(dtos.every(d => d.diagnostics.includes("VARIANT_ASSOCIATION_AMBIGUOUS")));
  assert.ok(dtos.every(d => d.observedVariants.length === 0));
  a.selectedVariantId = "v1";
  assert.equal(runReconciledShadow([a, b]).status, "FAILED");
});
test("V1.2 frozen labels, matcher and historical parses remain auditable with explicit V1.5 parse deltas", () => {
  const root = new URL("../../shared/product-identity/", import.meta.url);
  const expected = {
    // Authorized V1.5 parser replacement; historical parses stay in immutable golden.
    "parser.ts": "bd50efcc685958bef534a92e3a9f856e19334d1830d9d1b0971dd04c97165126",
    "matcher.ts": "52bd2c2307496ff149e4c5dbb07bbf0e48d02432cf271e7b8af575cf788b686f",
    "identity.test.ts": "df4512d4ad331a4bdbb70b91584c59269bb5ce3158e69025574e9d28cb013500",
    "validation/golden-v1.json": "6024db9bbfb06b1975d5bb13fb30e7ae028d7519d49e4e4ac1085717c1fa56a9",
    "validation/labeling-v1.json": "5d269cfd8596cff3d37a56287adc64e142420b6f04f229d880959d919c2c599d",
  };
  for (const [file, hash] of Object.entries(expected)) assert.equal(createHash("sha256").update(readFileSync(new URL(file, root))).digest("hex"), hash);
  const golden = JSON.parse(readFileSync(new URL("validation/golden-v1.json", root), "utf8"));
  const totals = { AUTO_MATCH: 0, REVIEW: 0, NO_MATCH: 0 };
  const currentTotals = { ...totals };
  const changedParses: string[] = [];
  for (const c of golden.cases) {
    const a = parseProductIdentity(c.futFanatics.identity.raw), b = parseProductIdentity(c.dafiti.identity.raw);
    if (canonical(a) !== canonical(c.futFanatics.identity)) changedParses.push(`${c.id}:futFanatics`);
    if (canonical(b) !== canonical(c.dafiti.identity)) changedParses.push(`${c.id}:dafiti`);
    totals[matchProductIdentities(c.futFanatics.identity, c.dafiti.identity).masterDecision]++;
    currentTotals[matchProductIdentities(a, b).masterDecision]++;
  }
  assert.equal(golden.cases.length, 247);
  assert.deepEqual(totals, { AUTO_MATCH: 147, REVIEW: 64, NO_MATCH: 36 });
  assert.deepEqual(currentTotals, { AUTO_MATCH: 148, REVIEW: 63, NO_MATCH: 36 });
  assert.deepEqual(changedParses, ["PID-0177:futFanatics", "PID-0177:dafiti", "PID-0188:dafiti",
    "PID-0191:dafiti", "PID-0192:dafiti", "PID-0242:dafiti"]);
});
test("adapter normalizes actual entity Date timestamps and preserves variant provenance/order", () => {
  const a = row("a", "Tênis Acme Comet");
  const v = { productId: a.product.id, providerId: a.provider.id, merchantId: a.merchant.id,
    size: "40", colour: "preto", provenanceMethod: "merchant_provided", lastSeenAt: "2026-09-29T00:00:00Z" };
  a.variants = [{ ...v, id: "v2", externalVariantKey: "key2" }, { ...v, id: "v1", externalVariantKey: "key1" }];
  const b = { ...structuredClone(a), product: { ...a.product, updatedAt: new Date(a.product.updatedAt!) }, variants: [...a.variants].reverse() };
  const first = run([a]);
  const second = runShadow(adaptReconciledRows([b]));
  assert.deepEqual(first.logical, second.logical);
  assert.ok(first.logical.snapshots[0].provenance.some(p => p.recordId === "v1" && p.field === "colour" && p.method === "merchant_provided"));
  assert.equal(first.logical.snapshots[0].observedVariants[0].externalVariantKey, "key1");
});
test("run key includes configuration, selected scope and identity evidence, excludes operational time", () => {
  const source = shadowFixture();
  const first = run(source).logical;
  source[0].identity.lastSeenAt = "2027-01-01T00:00:00Z";
  assert.equal(run(source).logical.runKey, first.runKey);
  assert.notEqual(run(source, { maxCandidatesPerProduct: 1 }).logical.runKey, first.runKey);
  source[0].product.mainName += " Pro";
  assert.notEqual(run(source).logical.runKey, first.runKey);
});
