import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { parseAwinCsv } from "./csv";
import { eligibleDafitiItem } from "./dafitiStaging";

const header = "aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,description,merchant_category,search_price,merchant_name,merchant_id,currency,merchant_deep_link,data_feed_id,brand_name,colour,product_price_old,in_stock,stock_status,ean,parent_product_id,Fashion:size,product_type";
const base = ["https://awin.example/a", "Tênis Runner", "101", "SKU-40", "https://img.example/a.jpg", "Descrição", "tênis", "199.90", "Dafiti BR", "17697", "BRL", "https://www.dafiti.com.br/runner-1.html", "53075", "Nike", "preto", "399.90 BRL", "1", "in stock", "", "", "40", "calcado"];
async function candidate(values: string[]) { const csv = `${header}\n${values.join(",")}\n`; for await (const row of parseAwinCsv(Readable.from(csv))) return eligibleDafitiItem(row); throw new Error("fixture vazia"); }

test("filtro staging aceita somente tênis estruturado, promoção, estoque e mínimos", async () => {
  const result = await candidate(base);
  assert.ok(result.item); assert.equal(result.item.dafiti.dataFeedId, "53075"); assert.equal(result.item.variant.size, "40");
  assert.equal(result.item.offer.prices.old, 399.9); assert.equal(result.item.offer.affiliateUrl, base[0]);
});

test("categorias aproximadas ou palavra apenas no nome/descrição não entram", async () => {
  for (const category of ["calçados", "sapatênis", "camiseta"]) { const values = [...base]; values[6] = category; assert.equal((await candidate(values)).reason, "not_confirmed_sneaker"); }
});

test("promoções iguais, ausentes e invertidas não entram", async () => {
  for (const old of ["199.90 BRL", "", "99.90 BRL"]) { const values = [...base]; values[15] = old; assert.match((await candidate(values)).reason, /^promotion_/); }
});

test("estoque, links, imagem, marca, feed e identidade são gates", async () => {
  for (const [index, value, reason] of [[16, "0", "not_in_stock"], [0, "", "invalid_affiliate_url"], [11, "", "invalid_merchant_url"], [4, "", "missing_image"], [13, "", "missing_brand"], [12, "", "missing_data_feed_id"], [3, "", "unsafe_variant_identity"]] as const) {
    const values = [...base]; values[index] = value; assert.equal((await candidate(values)).reason, reason);
  }
});

test("GTIN ausente não é inventado e merchant_product_id mantém Variant segura", async () => {
  const result = await candidate(base); assert.ok(result.item); assert.equal(result.item.variant.validGtin, null); assert.equal(result.item.product.identifiers.merchantProductId, "SKU-40");
});
