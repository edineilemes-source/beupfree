import assert from "node:assert/strict";
import test from "node:test";
import {
  DecisionEngine,
  type Analyzer,
  type AnalyzerResult,
  type DecisionCandidate,
  type DecisionContext,
} from "../index";

const candidates: DecisionCandidate[] = [
  { id: "a", name: "A", attributes: { value: 1 }, metadata: { source: "test" } },
  { id: "b", name: "B", attributes: { value: 2 } },
];

function result(
  analyzerId: string,
  candidateId: string,
  score: number,
  confidence: number,
  reasons: string[] = [],
  warnings: string[] = [],
): AnalyzerResult {
  return { analyzerId, candidateId, score, confidence, reasons, warnings };
}

test("returns zeroed results when there are no analyzers", async () => {
  const results = await new DecisionEngine().evaluate({ candidates });

  assert.deepEqual(results, candidates.map((candidate) => ({
    candidateId: candidate.id,
    score: 0,
    confidence: 0,
    analyzerResults: [],
    reasons: [],
    warnings: [],
  })));
});

test("executes one analyzer", async () => {
  const analyzer: Analyzer = {
    id: "one",
    analyze: (candidate) => result("one", candidate.id, 70, 80),
  };

  const [decision] = await new DecisionEngine([analyzer]).evaluate({
    candidates: [candidates[0]],
  });

  assert.equal(decision.score, 70);
  assert.equal(decision.confidence, 80);
  assert.equal(decision.analyzerResults.length, 1);
});

test("averages multiple analyzers and consolidates reasons and warnings", async () => {
  const analyzers: Analyzer[] = [
    {
      id: "first",
      analyze: (candidate) => result("first", candidate.id, 40, 60, ["reason 1"], []),
    },
    {
      id: "second",
      analyze: (candidate) => result("second", candidate.id, 80, 100, ["reason 2"], ["warning"]),
    },
  ];

  const [decision] = await new DecisionEngine(analyzers).evaluate({
    candidates: [candidates[0]],
  });

  assert.equal(decision.score, 60);
  assert.equal(decision.confidence, 80);
  assert.deepEqual(decision.reasons, ["reason 1", "reason 2"]);
  assert.deepEqual(decision.warnings, ["warning"]);
});

test("supports asynchronous analyzers", async () => {
  const analyzer: Analyzer = {
    id: "async",
    analyze: async (candidate) => result("async", candidate.id, 55, 65),
  };

  const [decision] = await new DecisionEngine([analyzer]).evaluate({
    candidates: [candidates[0]],
  });

  assert.equal(decision.score, 55);
});

test("sorts candidates from highest to lowest score", async () => {
  const analyzer: Analyzer = {
    id: "ranking",
    analyze: (candidate) => result(
      "ranking",
      candidate.id,
      candidate.id === "a" ? 10 : 90,
      100,
    ),
  };

  const decisions = await new DecisionEngine([analyzer]).evaluate({ candidates });

  assert.deepEqual(decisions.map(({ candidateId }) => candidateId), ["b", "a"]);
});

test("clamps finite metrics outside the accepted range", async () => {
  const analyzer: Analyzer = {
    id: "bounds",
    analyze: (candidate) => result("bounds", candidate.id, 150, -10),
  };

  const [decision] = await new DecisionEngine([analyzer]).evaluate({
    candidates: [candidates[0]],
  });

  assert.equal(decision.score, 100);
  assert.equal(decision.confidence, 0);
  assert.equal(decision.analyzerResults[0].score, 100);
});

test("replaces NaN and infinite metrics with zero", async () => {
  const analyzers: Analyzer[] = [
    { id: "nan", analyze: (candidate) => result("nan", candidate.id, Number.NaN, Infinity) },
    { id: "infinite", analyze: (candidate) => result("infinite", candidate.id, -Infinity, 50) },
  ];

  const [decision] = await new DecisionEngine(analyzers).evaluate({
    candidates: [candidates[0]],
  });

  assert.equal(decision.score, 0);
  assert.equal(decision.confidence, 25);
  assert.ok(Number.isFinite(decision.score));
  assert.ok(Number.isFinite(decision.confidence));
});

test("does not mutate candidates, context, analyzers, or analyzer results", async () => {
  const analyzerOutput = result("immutable", "a", 140, 75, ["kept"], ["kept"]);
  const analyzer: Analyzer = { id: "immutable", analyze: () => analyzerOutput };
  const context: DecisionContext = {
    candidates: [{ ...candidates[0], attributes: { ...candidates[0].attributes } }],
    preferences: { mode: "test" },
  };
  const before = structuredClone(context);

  const [decision] = await new DecisionEngine([analyzer]).evaluate(context);

  assert.deepEqual(context, before);
  assert.equal(analyzerOutput.score, 140);
  decision.reasons.push("changed result only");
  assert.deepEqual(analyzerOutput.reasons, ["kept"]);
});
