import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PostgresAwinRepository } from "./repository";
import type { NormalizedAwinItem } from "./types";

function item(index: number, merchant = "m1", feed = "f1"): NormalizedAwinItem {
  const key = index.toString(16).padStart(64, "0");
  return {
    productKey: key, variantKey: `v${key}`.slice(0, 64), offerKey: `o${key}`.slice(0, 64),
    product: { name: `Product ${index}`, description: null, shortDescription: null, brand: null, colour: null, model: null, modelNumber: null, productType: null, condition: null, specifications: null, keywords: null, identifiers: { parentProductId: null, awProductId: `${index}`, merchantProductId: `${index}`, upc: null, mpn: null }, category: {} },
    variant: { size: `${35 + index % 10}`, sizeStockStatus: "in stock", colour: "black", ean: null, gtin: null, validGtin: null },
    offer: { merchantId: merchant, merchantName: `Merchant ${merchant}`, currentPrice: 99.9, prices: { old: 129.9, rrp: null, saving: 30, savingsPercent: 23.095 }, currency: "BRL", availability: { inStock: true, isForSale: true, stockStatus: "in stock", validFrom: null, validTo: null }, affiliateUrl: "https://affiliate.example/item", merchantUrl: "https://merchant.example/item", basketUrl: null, delivery: {} },
    images: ["https://images.example/item.jpg"], provenance: { provider: "awin", merchantId: merchant, merchantName: `Merchant ${merchant}`, feedId: feed, dataFeedId: feed, externalIds: { awProductId: `${index}`, merchantProductId: `${index}`, parentProductId: null }, sourceUpdatedAt: null },
    raw: { provider: "awin", feedId: feed, merchantId: merchant, awProductId: `${index}`, merchantProductId: `${index}`, identityHash: key, contentHash: key, ingestedAt: "test", payload: { api_key: "must-not-persist", product: `${index}` } },
  };
}

class FakeClient {
  calls: Array<{ sql: string; values?: unknown[] }> = []; staged = 0; merchants = new Set<string>(); feeds = new Set<string>(); released = false; failOn = "";
  constructor(
    readonly disposition: "created" | "updated" | "unchanged" = "created",
    readonly classificationCounts?: { created: unknown; updated: unknown; unchanged: unknown; changed: unknown },
  ) {}
  async query(sql: string, values?: unknown[]) {
    this.calls.push({ sql, values });
    if (this.failOn && sql.includes(this.failOn)) throw new Error("synthetic merge failure");
    if (sql.includes("jsonb_to_recordset") && sql.includes("INSERT INTO awin_import_stage")) {
      const rows = JSON.parse(String(values?.[0])) as Array<{ merchant_external_id: string; external_feed_id: string }>;
      this.staged += rows.length; rows.forEach(row => { this.merchants.add(row.merchant_external_id); this.feeds.add(row.external_feed_id); });
    }
    if (sql.startsWith("SELECT count(DISTINCT merchant_external_id)")) return { rows: [{ merchants: this.merchants.size, merchant: [...this.merchants][0] ?? null, feed: [...this.feeds][0] ?? null, max_feed: [...this.feeds].at(-1) ?? null }] };
    if (sql.includes("RETURNING id") && sql.includes("commerce_providers")) return { rows: [{ id: "provider" }] };
    if (sql.includes("WITH classified AS")) return { rows: [this.classificationCounts ?? {
      created: this.disposition === "created" ? this.staged : 0,
      updated: this.disposition === "updated" ? this.staged : 0,
      unchanged: this.disposition === "unchanged" ? this.staged : 0,
      changed: this.disposition === "unchanged" ? 0 : this.staged,
    }] };
    if (sql.startsWith("SELECT count(*)::int count FROM commerce_raw")) return { rows: [{ count: 0 }] };
    return { rows: [], rowCount: 0 };
  }
  release() { this.released = true; }
}

const pool = (client: FakeClient) => ({ async connect() { return client; } }) as any;
async function* generated(count: number, tracker?: { outstanding: number; peak: number }) {
  for (let index = 0; index < count; index++) {
    if (tracker) { tracker.outstanding++; tracker.peak = Math.max(tracker.peak, tracker.outstanding); }
    yield item(index);
    if (tracker) tracker.outstanding--;
  }
}

test("streaming de 20k itens respeita chunk/backpressure e queries O(lotes), sem payload secreto", async () => {
  const client = new FakeClient(); const tracker = { outstanding: 0, peak: 0 };
  const report = await new PostgresAwinRepository(pool(client)).import(generated(20_001, tracker), { feedId: "f1", expectedMerchant: "m1", expectedCount: 20_001, chunkSize: 1_000 });
  assert.equal(report.batches, 21); assert.equal(report.maxBatchItems, 1_000); assert.ok(report.roundTrips < 50); assert.ok(tracker.peak <= 1);
  assert.equal(client.calls.filter(call => call.sql.includes("INSERT INTO awin_import_stage")).length, 21);
  assert.doesNotMatch(JSON.stringify(client.calls), /must-not-persist/); assert.equal(client.released, true);
});

test("0 e 1 item, lote parcial e múltiplos merchants são tratados sem query por item", async () => {
  const emptyClient = new FakeClient(); assert.equal((await new PostgresAwinRepository(pool(emptyClient)).import([], { feedId: "f1" })).seen, 0);
  const oneClient = new FakeClient(); const one = await new PostgresAwinRepository(pool(oneClient)).import([item(1)], { feedId: "f1", chunkSize: 20 });
  assert.equal(one.batches, 1); assert.equal(one.maxBatchItems, 1);
  const source = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /persistItem|for\s*\([^)]*changedItems/); assert.match(source, /jsonb_to_recordset/);
});

test("fast path idêntico pula os merges das cinco entidades e mantém reconciliação completa", async () => {
  const client = new FakeClient("unchanged");
  const progress: string[] = [];
  const report = await new PostgresAwinRepository(pool(client)).import([item(1), item(2)], { feedId: "f1", now: new Date("2026-09-10T00:00:00Z"), onProgress: value => { if (value.sqlStep) progress.push(value.sqlStep.name); } });
  assert.deepEqual({ staged: report.staged, changed: report.changed, unchanged: report.unchanged, fast_path: report.fast_path, merges_skipped: report.merges_skipped }, { staged: 2, changed: 0, unchanged: 2, fast_path: true, merges_skipped: 5 });
  const sql = client.calls.map(call => call.sql);
  const mergeSteps = ["merge_products", "merge_external_product_identities", "merge_product_variants", "merge_offers", "merge_product_images"];
  for (const entity of ["products", "external_product_identities", "product_variants", "offers", "product_images"]) {
    assert.equal(sql.some(statement => new RegExp(`^(?:INSERT INTO|UPDATE) ${entity}\\b`).test(statement)), false, entity);
  }
  assert.deepEqual(report.sql_steps.filter(step => mergeSteps.includes(step.name)), []);
  assert.equal(report.roundTrips, client.calls.length);
  assert.ok(sql.some(statement => statement.startsWith("UPDATE commerce_raw_feed_items")));
  assert.ok(sql.some(statement => statement.includes("LEFT JOIN awin_import_stage") && statement.includes("merchant_external_id")));
  assert.equal(report.raw_last_seen_refresh_ms, 86_400_000);
  assert.ok(report.sql_steps.some(step => step.name === "classify_and_count_staging" && step.roundTrips === 1));
  assert.ok(report.sql_steps.every(step => !/[\s;]/.test(step.name)));
  assert.ok(progress.includes("refresh_unchanged_raw_presence"));
  const refresh = client.calls.find(call => call.sql.startsWith("UPDATE commerce_raw_feed_items"))!;
  assert.match(refresh.sql, /r\.id=s\.raw_item_id/); assert.match(refresh.sql, /existing_last_seen_at/);
  assert.match(refresh.sql, /existing_last_seen_at <= \$2::timestamp without time zone/);
  assert.doesNotMatch(refresh.sql, /interval/i);
  assert.equal(refresh.values?.length, 3);
  assert.deepEqual(refresh.values, [expectDate("2026-09-10T00:00:00.000Z"), expectDate("2026-09-09T00:00:00.000Z"), false]);
});

test("fast path classifica exatamente 19861 existentes com mesmo hash sem contagem sobreposta", async () => {
  const client = new FakeClient("unchanged");
  const report = await new PostgresAwinRepository(pool(client)).import(generated(19_861), {
    feedId: "f1", expectedMerchant: "m1", expectedCount: 19_861, chunkSize: 1_000,
  });
  assert.deepEqual(
    { staged: report.staged, created: report.created, updated: report.updated, unchanged: report.unchanged, changed: report.changed },
    { staged: 19_861, created: 0, updated: 0, unchanged: 19_861, changed: 0 },
  );
  assert.equal(report.fast_path, true);
  assert.equal(report.merges_skipped, 5);
  assert.equal(report.sql_steps.some(step => step.name.startsWith("merge_")), false);
  const classification = client.calls.find(call => call.sql.includes("WITH classified AS"))!;
  assert.deepEqual(classification.values, ["provider", 19_861]);
  assert.doesNotMatch(classification.sql, /SELECT count\(\*\).*FROM awin_import_stage/is);
  assert.match(classification.sql, /\(\$2::bigint-count\(\*\)\).*count\(\*\) FILTER \(WHERE disposition='updated'\)/s);
});

test("contagens mistas formam partição exclusiva e governam os merges", async () => {
  const client = new FakeClient("created", { created: 2, updated: 1, unchanged: 2, changed: 3 });
  const report = await new PostgresAwinRepository(pool(client)).import(generated(5), { feedId: "f1" });
  assert.deepEqual(
    { staged: report.staged, created: report.created, updated: report.updated, unchanged: report.unchanged, changed: report.changed },
    { staged: 5, created: 2, updated: 1, unchanged: 2, changed: 3 },
  );
  assert.equal(report.fast_path, false);
  assert.equal(report.sql_steps.some(step => step.name.startsWith("merge_")), true);
});

test("invariantes rejeitam contagens contraditórias e executam rollback antes dos merges", async () => {
  const impossible = new FakeClient("created", { created: 19_861, updated: 0, unchanged: 19_861, changed: 19_861 });
  await assert.rejects(
    new PostgresAwinRepository(pool(impossible)).import(generated(19_861), { feedId: "f1", expectedCount: 19_861 }),
    /AWIN_STAGING_COUNTS_INVALID/,
  );
  assert.equal(impossible.calls.some(call => /^(?:INSERT INTO|UPDATE) (?:products|external_product_identities|product_variants|offers|product_images)\b/.test(call.sql)), false);
  assert.equal(impossible.calls.at(-1)?.sql, "ROLLBACK");

  for (const counts of [
    { created: 1, updated: 0, unchanged: 0, changed: 0 },
    { created: -1, updated: 1, unchanged: 1, changed: 0 },
    { created: 0.5, updated: 0.5, unchanged: 0, changed: 1 },
    { created: 0, updated: 0, unchanged: 1, changed: 1 },
  ]) {
    const client = new FakeClient("created", counts);
    await assert.rejects(new PostgresAwinRepository(pool(client)).import([item(1)], { feedId: "f1" }), /AWIN_STAGING_COUNTS_INVALID/);
    assert.equal(client.calls.at(-1)?.sql, "ROLLBACK");
  }
});

function expectDate(iso: string) {
  return new Date(iso);
}

test("atualização pontual limita todos os merges às linhas changed", async () => {
  const client = new FakeClient("updated");
  const report = await new PostgresAwinRepository(pool(client)).import([item(1)], { feedId: "f1" });
  assert.deepEqual({ staged: report.staged, changed: report.changed, updated: report.updated, fast_path: report.fast_path }, { staged: 1, changed: 1, updated: 1, fast_path: false });
  const mergeSql = client.calls.map(call => call.sql).filter(sql => /^(?:INSERT INTO|UPDATE) (?:products|external_product_identities|product_variants|offers|product_images)\b/.test(sql));
  assert.ok(mergeSql.length >= 5);
  for (const sql of mergeSql) assert.match(sql, /disposition(?:=|<>)'(?:updated|unchanged)'/);
});

test("gates rejeitam colisão de merchant/feed e rollback cobre falha de merge", async () => {
  const mismatch = new FakeClient();
  await assert.rejects(new PostgresAwinRepository(pool(mismatch)).import([item(1, "m1"), item(2, "m2")], { feedId: "f1", expectedMerchant: "m1" }), /MERCHANT_MISMATCH/);
  assert.ok(mismatch.calls.some(call => call.sql === "ROLLBACK"));
  const failure = new FakeClient(); failure.failOn = "INSERT INTO offers";
  await assert.rejects(new PostgresAwinRepository(pool(failure)).import([item(1)], { feedId: "f1" }), /synthetic merge failure/);
  assert.equal(failure.calls.at(-1)?.sql, "ROLLBACK");
});

test("timeouts transacionais usam set_config parametrizado e validam limites", async () => {
  const client = new FakeClient();
  await new PostgresAwinRepository(pool(client)).import([], { feedId: "f1" });
  assert.deepEqual(client.calls.slice(1, 3), [
    { sql: "SELECT set_config('statement_timeout', $1, true)", values: ["300000ms"] },
    { sql: "SELECT set_config('lock_timeout', $1, true)", values: ["10000ms"] },
  ]);
  assert.equal(client.calls.some(call => /^SET(?: LOCAL)?\b/.test(call.sql)), false);

  const invalid = new FakeClient();
  await assert.rejects(
    new PostgresAwinRepository(pool(invalid)).import([], { feedId: "f1", statementTimeoutMs: 1.5 }),
    /AWIN_STATEMENT_TIMEOUT_INVALID/,
  );
  assert.equal(invalid.calls.length, 0);
  await assert.rejects(new PostgresAwinRepository(pool(new FakeClient())).import([], { feedId: "f1", rawItemLastSeenRefreshMs: -1 }), /RAW_LAST_SEEN_REFRESH_INVALID/);
});

test("SQL set-based preserva chaves multi-marketplace, Product/Offer, staging e constraints existentes", () => {
  const source = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
  for (const table of ["commerce_providers", "commerce_merchants", "commerce_feeds", "products", "external_product_identities", "product_variants", "offers", "product_images", "commerce_raw_feed_items"]) assert.match(source, new RegExp(`(?:INSERT INTO|UPDATE) ${table}`));
  assert.match(source, /publication_state.*'staging'/s); assert.match(source, /'paused',false/); assert.match(source, /ON CONFLICT \(provider_id,merchant_id,external_variant_key\)/);
  assert.match(source, /ON CONFLICT \(provider_id,merchant_id,external_offer_key\)/); assert.match(source, /ON CONFLICT \(provider_id,merchant_id,feed_id,identity_hash\)/);
  assert.match(source, /CREATE INDEX ON awin_import_stage \(external_feed_id,merchant_external_id,identity_hash\)/);
  assert.match(source, /r\.provider_id=\$1 AND r\.identity_hash=s\.identity_hash/);
  assert.doesNotMatch(source.match(/classify_and_count_staging[\s\S]*?\[provider\.id\]/)?.[0] ?? "", /\bOR\b/);
  const schema = readFileSync(new URL("../../../shared/schema.ts", import.meta.url), "utf8");
  assert.match(schema, /uniqueIndex\("uq_commerce_raw_feed_identity"\)\.on\(table\.providerId, table\.merchantId, table\.feedId, table\.identityHash\)/);
});
