import test from "node:test";
import assert from "node:assert/strict";
import {normalizeAwinItem,isInvalidAwinItem} from "./normalize";
import {createCatalogPriceEvidence} from "./regularPriceEvidence";

function item(overrides:Record<string,string>={}){
 const raw:Record<string,string>={merchant_id:"17698",merchant_name:"Olympikus BR",aw_product_id:"123",merchant_product_id:"456",
  product_name:"Tênis Olympikus Corre 4",brand_name:"Olympikus",merchant_image_url:"https://img.test/1",
  aw_deep_link:"https://awin.test/ref",search_price:"299.90",currency:"BRL",in_stock:"1",
  product_price_old:"",savings_percent:"","Fashion:size":"40",...overrides};
 const normalized=normalizeAwinItem({raw,rowNumber:1},{feedId:"51837"});
 if(isInvalidAwinItem(normalized))throw new Error("INVALID_FIXTURE");
 return normalized;
}
test("preço regular preserva ausência real e cria apenas compatibilidade interna",()=>{
 const e=createCatalogPriceEvidence(item());
 assert.equal(e.status,"REGULAR_PRICE");
 assert.equal(e.rawPreviousPrice,null);
 assert.equal(e.compatibilityPreviousPrice,299.9);
 assert.equal(e.discountPercent,0);
 assert.equal(e.evidenceType,"AWIN_FEED_CURRENT_ONLY");
 assert.equal(e.merchantId,"17698");
 assert.equal(e.feedId,"51837");
});
test("promoção com desconto comprovado preserva preço anterior",()=>{
 const e=createCatalogPriceEvidence(item({product_price_old:"499.90",savings_percent:"40"}));
 assert.equal(e.status,"PROMOTION_CONFIRMED");
 assert.equal(e.rawPreviousPrice,499.9);
 assert.equal(e.compatibilityPreviousPrice,499.9);
 assert.equal(e.discountPercent,40.008);
});
test("inconsistência fica em revisão, não vira oferta falsa",()=>{
 const e=createCatalogPriceEvidence(item({savings_percent:"30"}));
 assert.equal(e.status,"REVIEW_REQUIRED");
 assert.equal(e.compatibilityPreviousPrice,null);
});
