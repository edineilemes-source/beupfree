import test from "node:test";
import assert from "node:assert/strict";
import { auditHumanPairs } from "./product-identity-human-audit-v15";
test("V1.5 all 247 independent human labels gate AUTO_MATCH; every decision change is exposed", () => {
  const r = auditHumanPairs();
  assert.equal(r.total, 247); assert.deepEqual(r.human, { YES: 157, NO: 87, UNSURE: 3 });
  assert.deepEqual(r.before, {
    AUTO_MATCH: { YES: 147, NO: 0, UNSURE: 0 }, REVIEW: { YES: 10, NO: 53, UNSURE: 1 }, NO_MATCH: { YES: 0, NO: 34, UNSURE: 2 },
  });
  assert.equal(r.humanNoToAutoMatch, 0); assert.equal(r.humanUnsureToAutoMatch, 0); assert.equal(r.passed, true);
  assert.deepEqual(r.after, {
    AUTO_MATCH: { YES: 148, NO: 0, UNSURE: 0 }, REVIEW: { YES: 9, NO: 53, UNSURE: 1 }, NO_MATCH: { YES: 0, NO: 34, UNSURE: 2 },
  });
  assert.deepEqual(r.decisionChanges.map((c: any) => [c.id, c.human.sameMaster, c.before.masterDecision, c.after.masterDecision,
    c.before.variantDecision, c.after.variantDecision]), [
    ["PID-0191", "YES", "REVIEW", "AUTO_MATCH", "REVIEW", "NO_MATCH"],
    ["PID-0192", "NO", "REVIEW", "REVIEW", "REVIEW", "NO_MATCH"],
  ]);
  assert.ok(r.cases.filter((c: any) => c.before.masterDecision === "AUTO_MATCH").every((c: any) => c.after.masterDecision === "AUTO_MATCH"));
});
