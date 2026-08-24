import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import test from "node:test";
import pg from "pg";
import { parseAwinCsv } from "./csv";
import { isInvalidAwinItem, normalizeAwinItem } from "./normalize";
import { PostgresAwinRepository, sanitizeRawPayload } from "./repository";
import type { AwinFeedItem, NormalizedAwinItem } from "./types";

const connectionString = process.env.AWIN_TEST_DATABASE_URL;
const local = connectionString ? ["localhost", "127.0.0.1", "::1"].includes(new URL(connectionString).hostname) : false;
const csv = readFileSync(new URL("./fixtures/sample.csv", import.meta.url), "utf8");

async function rows(): Promise<AwinFeedItem[]> {
  const result: AwinFeedItem[] = [];
  for await (const row of parseAwinCsv(Readable.from(csv))) result.push(row);
  return result;
}
const normalized = (row: AwinFeedItem, feedId = "repository-poc"): NormalizedAwinItem => {
  const item = normalizeAwinItem(row, { feedId, ingestedAt: "2026-08-21T00:00:00Z" });
  if (isInvalidAwinItem(item)) throw new Error(item.reasons.join(", "));
  return item;
};

test("payload raw remove nomes de campos de segredo", () => {
  assert.deepEqual(sanitizeRawPayload({ product_name: "x", api_key: "secret", feedUrl: "secret", accessToken: "secret" }), { product_name: "x" });
});

test("POC PostgreSQL isolada: reimport, updates, ausência, nova variante e merchants", { skip: !local && "AWIN_TEST_DATABASE_URL local não configurada" }, async () => {
  const pool = new pg.Pool({ connectionString });
  try {
    await pool.query("TRUNCATE commerce_raw_feed_items, product_images, offers, product_variants, external_product_identities, commerce_feeds, commerce_merchants, products RESTART IDENTITY CASCADE");
    const repository = new PostgresAwinRepository(pool);
    const source = await rows();
    const initial = source.map((row) => normalized(row));
    const first = await repository.import(initial, { feedId: "repository-poc", now: new Date("2026-08-21T01:00:00Z") });
    assert.equal(first.created, 2);
    const identical = await repository.import(initial, { feedId: "repository-poc", now: new Date("2026-08-21T02:00:00Z") });
    assert.deepEqual({ created: identical.created, updated: identical.updated, unchanged: identical.unchanged }, { created: 0, updated: 0, unchanged: 2 });

    source[0].raw.search_price = "179.90";
    source[0].raw.in_stock = "0";
    const changed = normalized(source[0]);
    const update = await repository.import([changed], { feedId: "repository-poc", now: new Date("2026-08-21T03:00:00Z") });
    assert.equal(update.updated, 1);
    assert.equal(update.missingCandidates, 1);

    const newVariantRow = structuredClone(source[0]);
    newVariantRow.raw.ean = "036000291452";
    newVariantRow.raw.merchant_product_id = "new-variant";
    newVariantRow.raw.aw_product_id = "new-offer";
    const newVariant = await repository.import([normalized(newVariantRow)], { feedId: "repository-poc", now: new Date("2026-08-21T04:00:00Z") });
    assert.equal(newVariant.created, 1);

    const otherMerchantRow = structuredClone(newVariantRow);
    otherMerchantRow.raw.merchant_id = "other-merchant";
    otherMerchantRow.raw.merchant_name = "Outro merchant de teste";
    const otherMerchant = await repository.import([normalized(otherMerchantRow)], { feedId: "repository-poc", now: new Date("2026-08-21T05:00:00Z") });
    assert.equal(otherMerchant.created, 1);

    const counts = await pool.query(`SELECT
      (SELECT count(*)::int FROM external_product_identities) products,
      (SELECT count(*)::int FROM product_variants) variants,
      (SELECT count(*)::int FROM offers) offers,
      (SELECT count(*)::int FROM commerce_merchants) merchants`);
    assert.deepEqual(counts.rows[0], { products: 2, variants: 4, offers: 4, merchants: 2 });
    const offer = await pool.query(`SELECT current_price,in_stock,status,active,affiliate_url,original_url FROM offers WHERE external_offer_key=$1`, [changed.offerKey]);
    assert.equal(offer.rows[0].current_price, "179.90");
    assert.equal(offer.rows[0].in_stock, false);
    assert.equal(offer.rows[0].status, "paused");
    assert.equal(offer.rows[0].active, false);
    assert.equal(offer.rows[0].affiliate_url, changed.offer.affiliateUrl);
    assert.equal(offer.rows[0].original_url, changed.offer.merchantUrl);
  } finally {
    await pool.end();
  }
});
