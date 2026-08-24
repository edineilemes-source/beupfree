import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { auditDafitiFeed, classifyDafitiPromotion, classifyDafitiSneaker, parseDafitiMoney } from "./dafitiAudit";

const header = "aw_deep_link,product_name,aw_product_id,merchant_product_id,merchant_image_url,description,merchant_category,search_price,merchant_name,merchant_id,currency,merchant_deep_link,data_feed_id,brand_name,colour,product_price_old,in_stock,stock_status,ean,parent_product_id,Fashion:size,product_type";
const rows = [
  "https://awin.example/a,Tênis Runner,101,SKU-40,https://img.example/a.jpg,Descrição compartilhada,tenis,199.90,Dafiti BR,17697,BRL,https://www.dafiti.com.br/runner-1.html,53075,Nike,preto,399.90 BRL,1,in stock,4006381333931,,40,calcado",
  "https://awin.example/b,Tênis Runner,102,SKU-41,https://img.example/a.jpg,Descrição compartilhada,tenis,199.90,Dafiti BR,17697,BRL,https://www.dafiti.com.br/runner-1.html,53075,Nike,preto,399.90 BRL,1,in stock,96385074,,41,calcado",
  "https://awin.example/c,Camiseta Runner,103,SKU-C,https://img.example/c.jpg,,camiseta,99.90,Dafiti BR,17697,BRL,https://www.dafiti.com.br/camiseta.html,53075,Nike,preto,99.90 BRL,1,in stock,0,,M,roupa",
].join("\n");

test("parser monetário Dafiti aceita sufixo BRL e rejeita conteúdo inconsistente", () => {
  assert.equal(parseDafitiMoney("109.9 BRL"), 109.9);
  assert.equal(parseDafitiMoney("R$ 1.299,90"), 1299.9);
  assert.equal(parseDafitiMoney("-1 BRL"), -1);
  assert.equal(parseDafitiMoney("12x R$ 9"), null);
});

test("promoção distingue confirmada, igual, ausente e old menor", () => {
  assert.equal(classifyDafitiPromotion({ search_price: "100", product_price_old: "200 BRL" }).classification, "PROMOTION_CONFIRMED");
  assert.equal(classifyDafitiPromotion({ search_price: "100", product_price_old: "100 BRL" }).classification, "NOT_PROMOTIONAL");
  assert.equal(classifyDafitiPromotion({ search_price: "100", product_price_old: "" }).classification, "PROMOTION_UNCERTAIN");
  assert.equal(classifyDafitiPromotion({ search_price: "200", product_price_old: "100 BRL" }).classification, "PROMOTION_UNCERTAIN");
});

test("tênis confirmado exige categoria estruturada; nome isolado é incerto", () => {
  assert.equal(classifyDafitiSneaker({ merchant_category: "tenis", product_name: "Calçado X" }).classification, "FOOTWEAR_SNEAKER_CONFIRMED");
  assert.equal(classifyDafitiSneaker({ merchant_category: "calcados", product_name: "Tênis X" }).classification, "FOOTWEAR_SNEAKER_UNCERTAIN");
  assert.equal(classifyDafitiSneaker({ description: "ótimo tênis", merchant_category: "camiseta", product_name: "Camiseta" }).classification, "NOT_SNEAKER");
});

test("auditoria agrupa tamanhos no Product e mantém Variant/Offer; link fica sanitizado", async () => {
  const csv = `${header}\n${rows}\n`;
  const report = await auditDafitiFeed(Readable.from(csv), { file: "fixture.csv.gz", compressedBytes: 500, gzipValid: true, encoding: "UTF-8", delimiter: "," });
  assert.equal(report.rows.raw, 3);
  assert.equal(report.funnel.uniqueProducts, 1);
  assert.equal(report.funnel.variants, 2);
  assert.equal(report.funnel.offers, 2);
  assert.equal(report.sizes.candidateProductsMultipleSizes, 1);
  assert.equal(report.gtin.valid, 2);
  assert.equal(report.links.fullUrlsExposed, false);
  assert.equal(report.top50CommercialOpportunities[0].affiliateLinkAvailable, true);
  assert.ok(!JSON.stringify(report).includes("https://awin.example/a"));
});

test("desconto extremo matematicamente impossível não vira confirmado", () => {
  const promotion = classifyDafitiPromotion({ search_price: "-1", product_price_old: "100 BRL" });
  assert.equal(promotion.classification, "PROMOTION_UNCERTAIN");
  assert.equal(promotion.discountPercent, null);
});
