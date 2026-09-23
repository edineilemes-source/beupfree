import assert from "node:assert/strict";
import test from "node:test";
import { evaluate, summarize, type AuditRow } from "./product-identity-offline-evaluation";
const row = (productId: string, merchant: string, name: string, brand = "fila"): AuditRow => ({ productId, merchant, name, brand });
const d = (id: string, name: string, brand?: string) => row(id, "Dafiti BR", name, brand);
const f = (id: string, name: string, brand?: string) => row(id, "Fut Fanatics BR", name, brand);

test("exact control counts groups, pairs and distinct products independently", () => {
  const report = evaluate([d("d1", "Fila Recovery"), d("d2", "Fila Recovery"), f("f1", "Fila Recovery")]);
  assert.equal(report.positiveControl.sharedNormalizedGroups, 1);
  assert.equal(report.positiveControl.oneToOneGroups, 0);
  assert.equal(report.positiveControl.futProducts, 1);
  assert.equal(report.positiveControl.decisions.AUTO_MATCH, 2);
  assert.equal(report.nonExact.pairs, 0);
});
test("same-brand candidates only and bounded top K", () => {
  const report = evaluate([f("f1", "Fila Recovery Preto"), ...Array.from({ length: 12 }, (_, i) => d(`d${i}`, `Fila Recovery Branco ${i}`)), d("wrong", "Fila Recovery Preto", "nike")]);
  assert.ok(report.nonExact.pairs > 0 && report.nonExact.pairs <= 5);
  assert.ok(report.nonExactEvaluations.every(p => p.dafiti.productId !== "wrong"));
});
test("similarity does not override missing generation", () => {
  const report = evaluate([f("f1", "Olympikus Flutua 2", "olympikus"), d("d1", "Olympikus Flutua", "olympikus")]);
  assert.equal(report.nonExact.pairDecisions.REVIEW, 1);
  assert.equal(report.nonExact.pairDecisions.AUTO_MATCH, 0);
  assert.equal(report.negativeRegressions[0].realPairCounts.REVIEW, 1);
});
test("reports full parsed evidence for different-name automatic match", () => {
  const report = evaluate([f("f1", "Tênis Fila Recovery Preto e Branco"), d("d1", "Tênis Fila Recovery Branco e Preto")]);
  const pair = report.autoMatch.differentRawNames[0];
  assert.equal(pair.decision, "AUTO_MATCH");
  assert.ok(pair.futFanatics.identity.modelTokens.length);
  assert.ok(pair.reasons.length);
  assert.equal(report.autoMatch.byBrand[0].pairs, 1);
});
test("partitions non-exact products with and without candidates", () => {
  const report = evaluate([f("f1", "Fila Recovery"), f("f2", "Nike Unknown", "nike"), d("d1", "Fila Recovery Preto")]);
  assert.equal(report.nonExact.futProducts, 2);
  assert.equal(report.nonExact.withCandidate, 1);
  assert.equal(report.nonExact.withoutCandidate, 1);
});
test("absent real controls are not replaced by synthetic matches", () => {
  assert.ok(evaluate([]).positiveRegressions.every(p => !p.foundCrossMerchant && !p.realPairs.length));
});
test("all eight requested negative synthetic controls prohibit AUTO_MATCH", () => {
  assert.ok(evaluate([]).negativeRegressions.every(p => p.syntheticControl.decision !== "AUTO_MATCH"));
});
test("duplicate projection product rows fail instead of inflating totals", () => {
  assert.throws(() => evaluate([d("d1", "Fila Recovery"), d("d1", "Fila Recovery")]), /DUPLICATE_PRODUCT_MERCHANT/);
});

test("V1.1 collapses variant records into master candidates without deduplicating input", () => {
  const report = evaluate([f("f1", "Fila Recovery Preto"), d("d1", "Fila Recovery Preto"), d("d2", "Fila Recovery Preto")]);
  const v = report.identityV11;
  assert.equal(v.master.AUTO_MATCH, 2);
  assert.equal(v.variant.AUTO_MATCH, 2);
  assert.equal(v.candidates.futWithMultipleMasterRecords, 1);
  assert.equal(v.candidates.futWithExactlyOneUniqueMaster, 1);
  assert.equal(v.candidates.uniqueMasterCandidates, 1);
  assert.equal(v.apparentDuplicates.groups, 1);
  assert.equal(v.apparentDuplicates.extraRecords, 1);
});
test("V1.1 samples separate missing evidence from explicit conflict and are reproducible", () => {
  const rows = [f("f1", "Fila Recovery Preto"), d("d1", "Fila Recovery Branco"), d("d2", "Fila Recovery Feminino Preto"), d("d3", "Fila Recovery Plus")];
  const a = evaluate(rows), b = evaluate([...rows].reverse());
  assert.deepEqual(a, b);
  assert.equal(a.identityV11.masterAutoVariantReview, 1);
  assert.equal(a.identityV11.masterAutoVariantNoMatch, 1);
  assert.equal(a.identityV11.samples.masterReview.length, 1);
  assert.equal(a.identityV11.samples.masterAutoVariantNoMatch[0].conflicts.variant[0], "COLOR_CONFLICT");
});
test("V1.1 variant colors are ignored only for master grouping", () => {
  const r = evaluate([f("f1", "Fila Recovery Preto"), d("d1", "Fila Recovery Branco"), d("d2", "Fila Recovery Verde")]);
  assert.equal(r.identityV11.candidates.uniqueMasterCandidates, 1);
  assert.equal(r.identityV11.variant.NO_MATCH, 2);
  assert.equal(r.identityV11.apparentDuplicates.groups, 0);
});
test("V1.1 sample categories are bounded and counts are not truncated", () => {
  const rows = Array.from({length: 25}, (_, i) => [f(`f${i}`, `Fila Recovery ${100 + i} Preto`), d(`d${i}`, `Fila Recovery ${100 + i} Branco`)]).flat();
  const r = evaluate(rows);
  assert.equal(r.identityV11.samples.masterAutoVariantNoMatch.length, 20);
  assert.equal(r.identityV11.masterAutoVariantNoMatch, 25);
});


test("V1.1 compact output preserves totals and safety samples without exhaustive pairs", () => {
  const full = evaluate([f("f1", "Fila Recovery Preto"), d("d1", "Fila Recovery Branco")]);
  const compact = summarize(full);
  assert.deepEqual(compact.identityV11, full.identityV11);
  assert.equal(compact.autoMatch.differentRawNames, 1);
  assert.ok(!("nonExactEvaluations" in compact));
  assert.ok(compact.identityV11.baselineComparison.requiresInvestigation);
});
