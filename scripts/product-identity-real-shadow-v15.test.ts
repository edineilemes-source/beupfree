import assert from "node:assert/strict";
import test from "node:test";
import { executeRealShadowV15, OUTPUT_V15 } from "./product-identity-real-shadow-v15";
import { OUTPUT, SQL, type ReadClient, type Source } from "./product-identity-real-shadow";
import { fixtureRow } from "../server/productIdentity/fixtures";
const row = fixtureRow("a", "Tênis Acme Orbit 1080v14 Verde Claro");
const source: Source = { id: row.identity.id, productId: row.product.id, providerId: row.provider.id,
  merchantId: row.merchant.id, feedId: row.identity.feedId!, externalProductKey: row.identity.externalProductKey,
  name: row.product.mainName, brandId: row.product.brandId!, brandName: "Acme", rawBrand: null, rawBrandCount: 0,
  merchantName: "Synthetic", providerCode: "Synthetic", updatedAt: row.product.updatedAt as string,
  lastSeenAt: row.identity.lastSeenAt as string, provenanceMethod: "merchant_provided" };
function mock(proof = "on") {
  const calls: string[] = [];
  const client: ReadClient = {
    async connect() { calls.push("CONNECT"); }, async end() { calls.push("END"); },
    async query(sql) {
      calls.push(sql);
      return { rows: sql === "SHOW transaction_read_only" ? [{ transaction_read_only: proof }] :
        sql === SQL.sources ? [source] : sql === SQL.feeds ? [row.feed] : sql === SQL.universe ? [{ products: 1 }] : [] };
    },
  };
  return { calls, client };
}
test("V1.5 runner only writes separate V15 path after proven READ ONLY and rollback, with version metadata", async () => {
  const m = mock(); let saved = false;
  await executeRealShadowV15({ AWIN_CATALOG_ADMIN_DATABASE_URL: "synthetic-url" }, () => m.client, async (path, content) => {
    saved = true; assert.equal(path, OUTPUT_V15); assert.notEqual(path, OUTPUT); assert.equal(m.calls.at(-1), "ROLLBACK");
    const r = JSON.parse(content);
    assert.equal(r.releaseVersion, "product-identity-v1.5"); assert.equal(r.shadow.logical.versions.parser, "product-identity-v1.5");
    assert.equal(r.shadow.logical.versions.matcher, "product-identity-v1.2");
    assert.equal(r.shadow.logical.parses[0].parsed.version, "14"); assert.equal(r.rollback, true);
    assert.equal(content.includes("synthetic-url"), false);
  });
  assert.equal(saved, true); assert.equal(m.calls.at(-1), "END");
});
test("V1.5 runner never falls back to other credentials; factory not called", async () => {
  await assert.rejects(executeRealShadowV15({ DATABASE_URL: "synthetic-url" }, () => assert.fail()), /AWIN_CATALOG_ADMIN_DATABASE_URL_REQUIRED/);
});
test("V1.5 unproven READ ONLY prevents all source reads and writes", async () => {
  const m = mock("off");
  await assert.rejects(executeRealShadowV15({ AWIN_CATALOG_ADMIN_DATABASE_URL: "synthetic-url" }, () => m.client,
    async () => assert.fail()), /REAL_SHADOW_READ_ONLY_FAILED/);
  assert.deepEqual(m.calls, ["CONNECT", "BEGIN READ ONLY", "SHOW transaction_read_only", "ROLLBACK", "END"]);
});
