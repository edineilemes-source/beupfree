import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("./awin-regular-catalog-stage.ts",import.meta.url),"utf8");
test("estágio AWIN começa read-only, exige alvo explícito e não ativa catálogo",()=>{
 for(const required of ["READ ONLY","--expected-raw-count","--confirm-staging","AWIN_CATALOG_EXPECTED_DATABASE","AWIN_CATALOG_EXPECTED_HOST","RAW_COUNT_MISMATCH","MERCHANT_NOT_ISOLATED","INCOMPLETE_JOIN","STAGED_PRICE_MISMATCH","MIGRATION_0014_NOT_APPLIED","OTHER_MERCHANT_EVIDENCE_CHANGED"])
  assert.ok(source.includes(required),required);
 assert.doesNotMatch(source,/\b(TRUNCATE|DROP TABLE|DELETE FROM|UPDATE offers|UPDATE products|UPDATE external_product_identities)\b/i);
 assert.ok(source.includes("persistClassifications")&&source.includes("persistNormalizations"));
 assert.ok(source.includes("await client.query(\"ROLLBACK\")"));
});
