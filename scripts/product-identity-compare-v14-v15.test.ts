import test from "node:test";
import assert from "node:assert/strict";
import { compareReports } from "./product-identity-compare-v14-v15";
import { adaptReconciledRows } from "../server/productIdentity/adapter";
import { fixtureRow } from "../server/productIdentity/fixtures";
import { runShadow } from "../server/productIdentity/shadow";
const report = (rows = [fixtureRow("a", "Tênis Acme Orbit Preto", "a"), fixtureRow("b", "Tênis Acme Orbit Branco", "b")], options = {}) => ({
  transactionReadOnly: "on", rollback: true, timings: { readAndSelectionMs: 1, shadowMs: 2, totalMs: 3 },
  shadow: runShadow(adaptReconciledRows(rows), options),
});
test("comparison same report has no changes; summaries are derived from detailed records", () => {
  const a = report(), r = compareReports(a, a);
  assert.equal(r.comparability.comparable, true); assert.equal(r.comparability.sameBudgets, true);
  assert.equal(r.before.master.AUTO_MATCH, 1); assert.equal(r.before.variant.NO_MATCH, 1);
  assert.equal(r.before.groups.multiMerchant, 1); assert.equal(r.before.groupSafety.valid, true);
  assert.equal(r.groups.changedProducts, 0); assert.equal(r.parseChanges.length, 0); assert.equal(r.pairChanges.length, 0);
});
test("comparison ignores regenerated group IDs and member order", () => {
  const a = report(), b = structuredClone(a);
  b.shadow.logical.groups[0].id = "regenerated"; b.shadow.logical.groups[0].members.reverse();
  const r = compareReports(a, b);
  assert.equal(r.groups.changedProducts, 0); assert.equal(r.groups.reunified.length, 0); assert.equal(r.groups.split.length, 0);
});
test("comparison detects singleton reunification, splits and absent pairs without inventing NO_MATCH", () => {
  const a = report(undefined, { maxEvaluatedPairs: 0 }), b = report();
  const r = compareReports(a, b);
  assert.equal(r.groups.changedProducts, 2); assert.equal(r.groups.reunified.length, 1);
  assert.equal(r.groups.reunified[0].completeUnion, true); assert.equal(r.groups.reunified[0].includesPreviousSingletons, true);
  assert.equal(r.transitions.master.previouslyNotEvaluatedToAutoMatch.length, 1);
  assert.equal(r.transitions.master.noMatchToAutoMatch.length, 0);
  assert.equal(r.comparability.sameBudgets, false);
  const reverse = compareReports(b, a);
  assert.equal(reverse.groups.split.length, 1); assert.equal(reverse.transitions.master.autoMatchNowNotEvaluated.length, 1);
});
test("comparison reports every MASTER and VARIANT decision transition with old/new reasons", () => {
  const a = report(), b = structuredClone(a);
  a.shadow.logical.pairs[0].result.masterDecision = "REVIEW";
  a.shadow.logical.pairs[0].result.master.decision = "REVIEW";
  a.shadow.logical.pairs[0].result.master.reasons = ["MODEL_EVIDENCE_DIFFERS"];
  a.shadow.logical.groups = a.shadow.logical.snapshots.map((s, i) => ({ id: `old-${i}`, members: [s.key] }));
  const r = compareReports(a, b);
  assert.equal(r.transitions.master.reviewToAutoMatch.length, 1);
  assert.deepEqual(r.transitions.master.reviewToAutoMatch[0].before?.master.reasons, ["MODEL_EVIDENCE_DIFFERS"]);
  a.shadow.logical.pairs[0].result.masterDecision = "NO_MATCH";
  a.shadow.logical.pairs[0].result.master.decision = "NO_MATCH";
  assert.equal(compareReports(a, b).transitions.master.noMatchToAutoMatch.length, 1);
});
test("comparison detects name/scope drift and relevant parse deltas, preventing causal attribution", () => {
  const a = report(), b = report([fixtureRow("a", "Tênis Acme Orbit Verde Claro", "a"), fixtureRow("b", "Tênis Acme Orbit Branco", "b")]);
  const r = compareReports(a, b);
  assert.equal(r.comparability.sameMembership, true); assert.equal(r.comparability.comparable, false);
  assert.equal(r.comparability.changedInputs.length, 1); assert.equal(r.parseChanges.length, 1);
  assert.ok(r.warnings.some(w => w.includes("COHORTS_NOT_COMPARABLE")));
  assert.equal(r.comparability.common, 2);
  const drift = compareReports(a, report([fixtureRow("different", "Tênis Acme Orbit Preto", "a")]));
  assert.equal(drift.comparability.comparable, false); assert.equal(drift.comparability.added.length, 1); assert.equal(drift.comparability.removed.length, 2);
});
test("comparison audits complete group safety independently of suspicious counter", () => {
  const a = report(), b = structuredClone(a);
  b.shadow.logical.pairs[0].result.masterDecision = "REVIEW";
  b.shadow.logical.pairs[0].result.master.decision = "REVIEW";
  const r = compareReports(a, b);
  assert.equal(r.after.groupSafety.valid, false); assert.equal(r.after.groupSafety.invalidInternalPairs.length, 1);
});
test("comparison rejects malformed artifacts, duplicate keys and incomplete group coverage", () => {
  const a = report();
  assert.throws(() => compareReports({}, a));
  const duplicate = structuredClone(a); duplicate.shadow.logical.snapshots.push(duplicate.shadow.logical.snapshots[0]);
  assert.throws(() => compareReports(a, duplicate), /DUPLICATE_KEY/);
  const incomplete = structuredClone(a); incomplete.shadow.logical.groups = [];
  assert.throws(() => compareReports(a, incomplete), /GROUP_COVERAGE_INVALID/);
});
