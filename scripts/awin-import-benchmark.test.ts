import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BENCHMARK_BATCH_SIZES, BENCHMARK_ROWS, BENCHMARK_TABLES, syntheticItem, syntheticMerchantStream, validatedBenchmarkTarget } from "./awin-import-benchmark";

test("benchmark gate aceita somente PostgreSQL local em banco _import_test", () => {
  const safe = "postgresql://user:pass@127.0.0.1:55416/upcat016_import_test";
  assert.equal(validatedBenchmarkTarget(safe), safe);
  for (const unsafe of ["", "invalid", "mysql://localhost/x_import_test", "postgres://db.example/x_import_test", "postgres://localhost/production"]) assert.throws(() => validatedBenchmarkTarget(unsafe), /AWIN_TEST_DATABASE/);
});

test("gerador determinístico entrega 20k por AsyncIterable sem acumular", async () => {
  assert.equal(BENCHMARK_ROWS, 20_000); assert.deepEqual(BENCHMARK_BATCH_SIZES, [1_000, 2_000]);
  const first = syntheticItem(0, 0), repeated = syntheticItem(0, 0), other = syntheticItem(10_000, 1);
  assert.deepEqual(first, repeated); assert.notEqual(first.provenance.merchantId, other.provenance.merchantId);
  assert.notEqual(first.offer.currentPrice, syntheticItem(1, 0).offer.currentPrice); assert.equal(first.images.length, 2);
  const stream = syntheticMerchantStream(0); assert.equal(typeof stream[Symbol.asyncIterator], "function");
  assert.equal((await stream.next()).value!.productKey, first.productKey); await stream.return(undefined);
});

test("script limita limpeza às nove tabelas e exige evidências reais", () => {
  assert.equal(BENCHMARK_TABLES.length, 9);
  const source = readFileSync(new URL("./awin-import-benchmark.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /DROP\s+(?:DATABASE|SCHEMA|TABLE)/i);
  assert.doesNotMatch(source, /TRUNCATE|CASCADE/i);
  for (const proof of ["publication_state", "orphan_offers", "duplicate_offers", "unsafe_payloads", "changed.offer.currentPrice = 12.34", "expectedCount: 2", "merges_skipped", "fast_path", "sqlSteps", "second"]) assert.match(source, new RegExp(proof.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
