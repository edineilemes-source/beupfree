import test from "node:test";
import assert from "node:assert/strict";
import {decideAutomaticCuration} from "./automatedDecision";
import {normalizeAwinItem,isInvalidAwinItem} from "../integrations/awin/normalize";
import {parseProductIdentity} from "../../shared/product-identity/parser";
import {VERSIONS} from "../productIdentity/contracts";
test("usa parser original em produto Olympikus sem deduzir tamanho BR ou publicar",()=>{
 const normalized=normalizeAwinItem({rowNumber:1,raw:{
  merchant_id:"17698",product_name:"Tênis Olympikus Corre 4 Preto",
  merchant_product_id:"CORRE-4-PRETO",aw_deep_link:"https://example.org/affiliate",
  search_price:"299.90",currency:"BRL",brand_name:"Olympikus",colour:"Preto",
  "Fashion:size":"40",merchant_category:"Tênis"
 }},{feedId:"51837"});
 assert.equal(isInvalidAwinItem(normalized),false);
 if(isInvalidAwinItem(normalized))return;
 const d=decideAutomaticCuration(normalized);
 const parsed=parseProductIdentity({name:normalized.product.name,brand:normalized.product.brand});
 assert.equal(d.master.parserVersion,VERSIONS.parser);
 assert.deepEqual(d.master.modelTokens,parsed.master.modelTokens);
 assert.deepEqual(d.master.ambiguities,parsed.ambiguities);
 assert.notEqual(d.variant.size,null);
 assert.ok(!("published" in d));
 assert.ok(!("masterProductId" in d));
});
