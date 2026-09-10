import "dotenv/config";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import pg from "pg";
import { PostgresAwinRepository, type AwinImportReport } from "../server/integrations/awin/repository";
import type { NormalizedAwinItem } from "../server/integrations/awin/types";

export const BENCHMARK_ROWS = 20_000;
export const BENCHMARK_BATCH_SIZES = [1_000, 2_000] as const;
export const BENCHMARK_TABLES = ["commerce_raw_feed_items", "product_images", "offers", "product_variants", "external_product_identities", "commerce_feeds", "commerce_merchants", "products", "commerce_providers"] as const;
const MERCHANTS = ["synthetic-alpha", "synthetic-beta"] as const;
const ROWS_PER_MERCHANT = BENCHMARK_ROWS / 2;
const PRODUCTS_PER_MERCHANT = ROWS_PER_MERCHANT / 2;

export function validatedBenchmarkTarget(value = process.env.AWIN_TEST_DATABASE_URL): string {
  if (!value?.trim()) throw new Error("AWIN_TEST_DATABASE_URL_REQUIRED");
  let target: URL;
  try { target = new URL(value); } catch { throw new Error("AWIN_TEST_DATABASE_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(target.protocol)) throw new Error("AWIN_TEST_DATABASE_URL_INVALID_PROTOCOL");
  if (!["localhost", "127.0.0.1"].includes(target.hostname)) throw new Error("AWIN_TEST_DATABASE_URL_NOT_LOCAL");
  if (!target.pathname.replace(/^\//, "").endsWith("_import_test")) throw new Error("AWIN_TEST_DATABASE_NAME_UNSAFE");
  return value;
}

const key = (prefix: string, value: number) => `${prefix}${value.toString(16).padStart(63, "0")}`.slice(0, 64);

export function syntheticItem(globalIndex: number, merchantIndex: number): NormalizedAwinItem {
  const merchantId = MERCHANTS[merchantIndex], localIndex = globalIndex - merchantIndex * ROWS_PER_MERCHANT;
  const productNumber = Math.floor(localIndex / 2), variantNumber = localIndex % 2;
  const currentPrice = 50 + (globalIndex % 500) / 10, originalPrice = currentPrice + 20 + variantNumber;
  const feedId = `benchmark-feed-${merchantIndex + 1}`;
  const merchantUrl = `https://merchant.example/${merchantId}/${globalIndex}`, affiliateUrl = `https://affiliate.example/click/${merchantId}/${globalIndex}`;
  return {
    productKey: key("p", merchantIndex * PRODUCTS_PER_MERCHANT + productNumber), variantKey: key("v", globalIndex), offerKey: key("o", globalIndex),
    product: { name: `Synthetic product ${merchantIndex}-${productNumber}`, description: `Deterministic benchmark product ${productNumber}`, shortDescription: `Benchmark ${productNumber}`, brand: `Brand ${productNumber % 20}`, colour: variantNumber ? "blue" : "black", model: null, modelNumber: null, productType: "sportswear", condition: "new", specifications: null, keywords: null, identifiers: { parentProductId: `parent-${productNumber}`, awProductId: `${globalIndex}`, merchantProductId: `sku-${globalIndex}`, upc: null, mpn: `mpn-${globalIndex}` }, category: { primary: `category-${productNumber % 10}` } },
    variant: { size: variantNumber ? "M" : "P", sizeStockStatus: "in stock", colour: variantNumber ? "blue" : "black", ean: null, gtin: null, validGtin: null },
    offer: { merchantId, merchantName: `Synthetic merchant ${merchantIndex + 1}`, currentPrice, prices: { old: originalPrice, rrp: originalPrice + 10, saving: originalPrice - currentPrice, savingsPercent: ((originalPrice - currentPrice) / originalPrice) * 100 }, currency: "BRL", availability: { inStock: true, isForSale: true, stockStatus: "in stock", validFrom: null, validTo: null }, affiliateUrl, merchantUrl, basketUrl: null, delivery: {} },
    images: [`https://images.example/${merchantId}/product-${productNumber}.jpg`, `https://images.example/${merchantId}/product-${productNumber}-${variantNumber}.jpg`],
    provenance: { provider: "awin", merchantId, merchantName: `Synthetic merchant ${merchantIndex + 1}`, feedId, dataFeedId: feedId, externalIds: { awProductId: `${globalIndex}`, merchantProductId: `sku-${globalIndex}`, parentProductId: `parent-${productNumber}` }, sourceUpdatedAt: null },
    raw: { provider: "awin", feedId, merchantId, awProductId: `${globalIndex}`, merchantProductId: `sku-${globalIndex}`, identityHash: key("i", globalIndex), contentHash: key("c", globalIndex), ingestedAt: "2026-09-10T00:00:00.000Z", payload: { product_name: `Synthetic product ${productNumber}`, source_marker: "upcat018", api_key: "must-never-persist", feed_url: "must-never-persist" } },
  };
}

export async function* syntheticMerchantStream(merchantIndex: number) {
  const start = merchantIndex * ROWS_PER_MERCHANT;
  for (let offset = 0; offset < ROWS_PER_MERCHANT; offset++) yield syntheticItem(start + offset, merchantIndex);
}

async function verifySchema(pool: pg.Pool) {
  const result = await pool.query("SELECT name, to_regclass(name) IS NOT NULL AS present FROM unnest($1::text[]) name", [BENCHMARK_TABLES]);
  const missing = result.rows.filter(row => !row.present).map(row => row.name);
  assert.deepEqual(missing, [], `AWIN_BENCHMARK_SCHEMA_INCOMPLETE: ${missing.join(",")}`);
}

async function cleanBenchmarkTables(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Child-to-parent order confines cleanup to exactly these constants.
    for (const table of BENCHMARK_TABLES) await client.query(`DELETE FROM ${table}`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

type Metric = { elapsedMs: number; rowsPerSecond: number; peakRssBytes: number; batches: number; roundTrips: number; sqlSteps: AwinImportReport["sql_steps"]; report: Pick<AwinImportReport, "created" | "updated" | "unchanged" | "seen" | "staged" | "changed" | "merges_skipped" | "fast_path"> };
async function measuredImport(repository: PostgresAwinRepository, chunkSize: number, run: number): Promise<Metric> {
  let peakRssBytes = process.memoryUsage().rss;
  const sampler = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 10), started = performance.now();
  const reports: AwinImportReport[] = [];
  try {
    for (let merchant = 0; merchant < 2; merchant++) reports.push(await repository.import(syntheticMerchantStream(merchant), { feedId: `benchmark-feed-${merchant + 1}`, expectedMerchant: MERCHANTS[merchant], expectedCount: ROWS_PER_MERCHANT, chunkSize, now: new Date(`2026-09-10T0${run + merchant}:00:00.000Z`) }));
  } finally { clearInterval(sampler); }
  const elapsedMs = performance.now() - started;
  const sum = (field: keyof AwinImportReport) => reports.reduce((total, report) => total + Number(report[field]), 0);
  const sqlSteps = new Map<string, AwinImportReport["sql_steps"][number]>();
  for (const report of reports) for (const step of report.sql_steps) {
    const prior = sqlSteps.get(step.name);
    sqlSteps.set(step.name, { name: step.name, durationMs: Number(((prior?.durationMs ?? 0) + step.durationMs).toFixed(3)), rowCount: prior?.rowCount === null || step.rowCount === null ? null : (prior?.rowCount ?? 0) + step.rowCount, roundTrips: (prior?.roundTrips ?? 0) + step.roundTrips });
  }
  return { elapsedMs: +elapsedMs.toFixed(3), rowsPerSecond: +(BENCHMARK_ROWS / (elapsedMs / 1_000)).toFixed(2), peakRssBytes, batches: sum("batches"), roundTrips: sum("roundTrips"), sqlSteps: [...sqlSteps.values()], report: { created: sum("created"), updated: sum("updated"), unchanged: sum("unchanged"), seen: sum("seen"), staged: sum("staged"), changed: sum("changed"), merges_skipped: sum("merges_skipped"), fast_path: reports.every(report => report.fast_path) } };
}

async function databaseEvidence(pool: pg.Pool) {
  const result = await pool.query(`SELECT
    (SELECT count(*)::int FROM commerce_providers) providers,(SELECT count(*)::int FROM commerce_merchants) merchants,(SELECT count(*)::int FROM commerce_feeds) feeds,(SELECT count(*)::int FROM products) products,
    (SELECT count(*)::int FROM external_product_identities) identities,(SELECT count(*)::int FROM product_variants) variants,(SELECT count(*)::int FROM offers) offers,(SELECT count(*)::int FROM product_images) images,(SELECT count(*)::int FROM commerce_raw_feed_items) raw_items,
    (SELECT count(*)::int FROM external_product_identities WHERE publication_state <> 'staging' OR active) invalid_publication,(SELECT count(*)::int FROM offers WHERE status <> 'paused' OR active) invalid_offers,
    (SELECT count(*)::int FROM external_product_identities e LEFT JOIN products p ON p.id=e.product_id WHERE p.id IS NULL) orphan_identities,
    (SELECT count(*)::int FROM product_variants v LEFT JOIN products p ON p.id=v.product_id LEFT JOIN commerce_merchants m ON m.id=v.merchant_id WHERE p.id IS NULL OR m.id IS NULL) orphan_variants,
    (SELECT count(*)::int FROM offers o LEFT JOIN products p ON p.id=o.product_id LEFT JOIN product_variants v ON v.id=o.variant_id WHERE p.id IS NULL OR v.id IS NULL) orphan_offers,
    (SELECT count(*)::int FROM product_images i LEFT JOIN products p ON p.id=i.product_id WHERE p.id IS NULL) orphan_images,
    (SELECT count(*)::int FROM commerce_raw_feed_items r LEFT JOIN commerce_merchants m ON m.id=r.merchant_id LEFT JOIN commerce_feeds f ON f.id=r.feed_id WHERE m.id IS NULL OR f.id IS NULL) orphan_raw,
    (SELECT count(*)::int-count(DISTINCT (provider_id,merchant_id,external_product_key))::int FROM external_product_identities) duplicate_identities,
    (SELECT count(*)::int-count(DISTINCT (provider_id,merchant_id,external_variant_key))::int FROM product_variants) duplicate_variants,
    (SELECT count(*)::int-count(DISTINCT (provider_id,merchant_id,external_offer_key))::int FROM offers) duplicate_offers,
    (SELECT count(*)::int FROM commerce_raw_feed_items WHERE raw_payload ?| ARRAY['api_key','feed_url','access_token','password','secret']) unsafe_payloads`);
  const evidence = result.rows[0];
  assert.deepEqual({ providers: evidence.providers, merchants: evidence.merchants, feeds: evidence.feeds, products: evidence.products, identities: evidence.identities, variants: evidence.variants, offers: evidence.offers, images: evidence.images, raw_items: evidence.raw_items }, { providers: 1, merchants: 2, feeds: 2, products: 10_000, identities: 10_000, variants: 20_000, offers: 20_000, images: 30_000, raw_items: 20_000 });
  for (const field of ["invalid_publication", "invalid_offers", "orphan_identities", "orphan_variants", "orphan_offers", "orphan_images", "orphan_raw", "duplicate_identities", "duplicate_variants", "duplicate_offers", "unsafe_payloads"]) assert.equal(evidence[field], 0, field);
  const sample = (await pool.query("SELECT current_price,original_price,affiliate_url,original_url FROM offers WHERE external_offer_key=$1", [key("o", 12_345)])).rows[0], expected = syntheticItem(12_345, 1);
  assert.deepEqual(sample, { current_price: expected.offer.currentPrice.toFixed(2), original_price: expected.offer.prices.old!.toFixed(2), affiliate_url: expected.offer.affiliateUrl, original_url: expected.offer.merchantUrl });
  return evidence;
}

export async function runBenchmark(connectionString = process.env.AWIN_TEST_DATABASE_URL) {
  const pool = new pg.Pool({ connectionString: validatedBenchmarkTarget(connectionString) });
  try {
    await verifySchema(pool);
    const scenarios = [];
    for (const chunkSize of BENCHMARK_BATCH_SIZES) {
      await cleanBenchmarkTables(pool);
      const repository = new PostgresAwinRepository(pool), first = await measuredImport(repository, chunkSize, 1);
      assert.equal(first.report.created, BENCHMARK_ROWS); assert.ok(first.elapsedMs <= 300_000, `AWIN_BENCHMARK_FIRST_LOAD_TOO_SLOW: ${first.elapsedMs}ms`);
      const evidence = await databaseEvidence(pool), second = await measuredImport(repository, chunkSize, 3);
      assert.deepEqual(second.report, { created: 0, updated: 0, unchanged: BENCHMARK_ROWS, seen: BENCHMARK_ROWS, staged: BENCHMARK_ROWS, changed: 0, merges_skipped: 10, fast_path: true });
      assert.deepEqual(await databaseEvidence(pool), evidence);
      const changed = structuredClone(syntheticItem(0, 0));
      changed.offer.currentPrice = 12.34; changed.raw.contentHash = key("u", 0);
      const pointUpdate = await repository.import([changed], { feedId: "benchmark-feed-1", expectedMerchant: MERCHANTS[0], expectedCount: 1, chunkSize });
      assert.deepEqual({ created: pointUpdate.created, updated: pointUpdate.updated, unchanged: pointUpdate.unchanged, changed: pointUpdate.changed, fast_path: pointUpdate.fast_path }, { created: 0, updated: 1, unchanged: 0, changed: 1, fast_path: false });
      const priceBeforeRollback = (await pool.query("SELECT current_price FROM offers WHERE external_offer_key=$1", [changed.offerKey])).rows[0].current_price;
      assert.equal(priceBeforeRollback, "12.34");
      await assert.rejects(repository.import([syntheticItem(0, 0)], { feedId: "benchmark-feed-1", expectedMerchant: MERCHANTS[0], expectedCount: 2, chunkSize }), /COUNT_MISMATCH/);
      assert.equal((await pool.query("SELECT current_price FROM offers WHERE external_offer_key=$1", [changed.offerKey])).rows[0].current_price, priceBeforeRollback);
      assert.deepEqual(await databaseEvidence(pool), evidence);
      scenarios.push({ chunkSize, first, second, pointUpdate: { created: pointUpdate.created, updated: pointUpdate.updated, unchanged: pointUpdate.unchanged, roundTrips: pointUpdate.roundTrips }, rollbackProbe: "passed", secondToFirstRatio: +(second.elapsedMs / first.elapsedMs).toFixed(3), secondLoadAssessment: second.elapsedMs < first.elapsedMs * 0.9 ? "significantly_faster" : "not_10_percent_faster; measured ratio retained for investigation" });
    }
    return { dataset: { rows: BENCHMARK_ROWS, products: 10_000, variants: 20_000, offers: 20_000, merchants: 2, seed: "upcat018-v1" }, scenarios };
  } finally { await pool.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runBenchmark().then(result => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch(error => { process.stderr.write(`${error instanceof Error ? error.message : "AWIN_BENCHMARK_FAILED"}\n`); process.exitCode = 1; });
