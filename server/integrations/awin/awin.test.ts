import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseAwinCsv } from "./csv";
import { analyzeAwinFeed } from "./dryRun";
import { openGzipFile, sanitizeFeedLocation } from "./input";
import { isInvalidAwinItem, isValidAwinGtin, normalizeAwinItem, normalizeCurrency, parseAwinBoolean } from "./normalize";
import { createAwinIdentitySnapshot, reconcileAwinItem } from "./reconcile";

const csv = readFileSync(new URL("./fixtures/sample.csv", import.meta.url), "utf8");

async function parsed(input = csv) {
  const result = [];
  for await (const item of parseAwinCsv(Readable.from(input))) result.push(item);
  return result;
}

test("parser suporta CSV válido, multiline, vírgulas, aspas e valores vazios", async () => {
  const result = await parsed();
  assert.equal(result.length, 2);
  assert.match(result[0].raw.description, /vírgula\ne segunda/);
  assert.equal(result[1].raw.merchant_image_url, "");
});

test("parser tolera coluna opcional ausente", async () => {
  const result = await parsed("product_name,merchant_id,aw_deep_link,search_price,currency\nProduto,1,https://a.example/x,10.00,BRL\n");
  assert.equal(result[0].raw.ean, undefined);
});

test("gzip válido é interpretado e gzip inválido falha", async () => {
  const valid = Readable.from(gzipSync(csv));
  const { createGunzip } = await import("node:zlib");
  const result = [];
  for await (const item of parseAwinCsv(valid.pipe(createGunzip()))) result.push(item);
  assert.equal(result.length, 2);
  await assert.rejects(async () => { for await (const _ of Readable.from("inválido").pipe(createGunzip())) void _; });
  assert.equal(typeof openGzipFile, "function");
});

test("normaliza merchant, preço, booleanos, moeda, EAN, variante, links e proveniência", async () => {
  const [source] = await parsed();
  const item = normalizeAwinItem(source, { feedId: "fixture", ingestedAt: "2026-01-01T00:00:00Z" });
  assert.ok(!isInvalidAwinItem(item));
  assert.equal(item.offer.merchantId, "42");
  assert.equal(item.offer.currentPrice, 199.9);
  assert.equal(item.offer.currency, "BRL");
  assert.equal(item.offer.affiliateUrl, source.raw.aw_deep_link);
  assert.equal(item.offer.merchantUrl, source.raw.merchant_deep_link);
  assert.equal(item.variant.ean, "7894900011517");
  assert.equal(item.variant.validGtin, "7894900011517");
  assert.equal(item.variant.size, "40");
  assert.equal(item.provenance.provider, "awin");
  assert.equal(item.raw.payload.description, source.raw.description);
});

test("preço e moeda inválidos tornam a linha inválida; booleanos são seguros", async () => {
  const [source] = await parsed();
  source.raw.search_price = "R$ 12x";
  source.raw.currency = "REAL";
  const item = normalizeAwinItem(source, { feedId: "fixture" });
  assert.ok(isInvalidAwinItem(item));
  assert.deepEqual(parseAwinBoolean("yes"), true);
  assert.deepEqual(parseAwinBoolean("talvez"), null);
  assert.equal(normalizeCurrency("BRL"), "BRL");
  assert.equal(normalizeCurrency("REAL"), null);
});

test("produto agrupa tamanhos, variantes e ofertas permanecem distintas", async () => {
  const [one, two] = await parsed();
  const a = normalizeAwinItem(one, { feedId: "fixture" });
  const b = normalizeAwinItem(two, { feedId: "fixture" });
  assert.ok(!isInvalidAwinItem(a) && !isInvalidAwinItem(b));
  assert.equal(a.productKey, b.productKey);
  assert.notEqual(a.variantKey, b.variantKey);
  assert.notEqual(a.offerKey, b.offerKey);
});

test("valida GTIN/EAN estruturalmente e rejeita sentinelas sem invalidar a linha", async () => {
  for (const invalid of ["", " ", "0", "0000000000000", "ABC123", "1234567", "7894900011518"]) {
    assert.equal(isValidAwinGtin(invalid), false, invalid);
  }
  for (const valid of ["96385074", "036000291452", "4006381333931", "10012345000017"]) {
    assert.equal(isValidAwinGtin(valid), true, valid);
  }
  const [source] = await parsed();
  source.raw.ean = "0";
  const item = normalizeAwinItem(source, { feedId: "fixture" });
  assert.ok(!isInvalidAwinItem(item));
  assert.equal(item.variant.ean, "0");
  assert.equal(item.variant.validGtin, null);
});

test("EAN inválido usa merchant_product_id, tamanho e cor sem colapsar tamanhos", async () => {
  const [one, two] = await parsed();
  one.raw.ean = "0";
  two.raw.ean = "0000000000000";
  const a = normalizeAwinItem(one, { feedId: "fixture" });
  const b = normalizeAwinItem(two, { feedId: "fixture" });
  assert.ok(!isInvalidAwinItem(a) && !isInvalidAwinItem(b));
  assert.equal(a.productKey, b.productKey);
  assert.notEqual(a.variantKey, b.variantKey);
});

test("ausência de EAN usa fallback e EAN válido idêntico mantém a Variant", async () => {
  const [one, two] = await parsed();
  one.raw.ean = "";
  const withoutEan = normalizeAwinItem(one, { feedId: "fixture" });
  assert.ok(!isInvalidAwinItem(withoutEan));
  assert.equal(withoutEan.variant.validGtin, null);
  one.raw.ean = "4006381333931";
  two.raw.ean = "4006381333931";
  const a = normalizeAwinItem(one, { feedId: "fixture" });
  const b = normalizeAwinItem(two, { feedId: "fixture" });
  assert.ok(!isInvalidAwinItem(a) && !isInvalidAwinItem(b));
  assert.equal(a.variantKey, b.variantKey);
});

test("mesmo EAN não colide entre merchants", async () => {
  const [one, two] = await parsed();
  two.raw.merchant_id = "another-merchant";
  two.raw.ean = one.raw.ean;
  const a = normalizeAwinItem(one, { feedId: "fixture" });
  const b = normalizeAwinItem(two, { feedId: "fixture" });
  assert.ok(!isInvalidAwinItem(a) && !isInvalidAwinItem(b));
  assert.notEqual(a.productKey, b.productKey);
  assert.notEqual(a.variantKey, b.variantKey);
});

test("reconciliação é idempotente, deduplica imagens e atualiza oferta", async () => {
  const [source] = await parsed();
  const item = normalizeAwinItem(source, { feedId: "fixture" });
  assert.ok(!isInvalidAwinItem(item));
  const snapshot = createAwinIdentitySnapshot();
  assert.equal(reconcileAwinItem(snapshot, item).offer, "created");
  const again = reconcileAwinItem(snapshot, item);
  assert.equal(again.offer, "unchanged"); assert.equal(again.imagesCreated, 0);
  item.offer.currentPrice = 179.9;
  assert.equal(reconcileAwinItem(snapshot, item).offer, "updated");
});

test("dry-run não persiste e apresenta contagens", async () => {
  const report = await analyzeAwinFeed(Readable.from(csv), "fixture");
  assert.equal(report.rawRows, 2);
  assert.equal(report.validRows, 2);
  assert.equal(report.candidateProducts, 1);
  assert.equal(report.candidateVariants, 2);
  assert.equal(report.withDescription, 1);
  assert.equal(report.withEanRaw, 2);
  assert.equal(report.withValidEan, 2);
  assert.equal(report.withInvalidEan, 0);
  assert.deepEqual(report.variantCollisions, { differentSizes: 0, differentValidGtins: 0, acrossProducts: 0, acrossMerchants: 0 });
});

test("sanitização não vaza API key nem query da URL do feed", () => {
  const secret = "super-secret-api-key";
  const sanitized = sanitizeFeedLocation(`https://feeds.example/path/${secret}.csv.gz?apiKey=${secret}`);
  assert.doesNotMatch(sanitized, new RegExp(secret));
  assert.doesNotMatch(sanitized, /apiKey/);
});
