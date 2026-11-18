import assert from "node:assert/strict";
import test from "node:test";
import {normalizeAwinItem,isInvalidAwinItem} from "./normalize";
import {assessAwinCatalogCandidate} from "./catalogCandidate";

function candidate(changes:Record<string,string>={}){
 const raw:Record<string,string>={
  merchant_id:"17698",merchant_name:"Olympikus BR",data_feed_id:"51837",
  product_name:"Tênis Olympikus Corre 4 Masculino 40",product_type:"Masculino - Calçados - Corrida",
  brand_name:"Olympikus",search_price:"299.99",currency:"BRL",
  aw_product_id:"46051948595",merchant_product_id:"58208",
  merchant_image_url:"https://img.example/tenis.jpg",aw_deep_link:"https://awin.example/merchant?id=17698",
  "Fashion:size":"40",in_stock:"1",product_price_old:"",savings_percent:"",...changes
 };
 const item=normalizeAwinItem({raw,rowNumber:1},{feedId:"51837"});
 if(isInvalidAwinItem(item))throw new Error("INVALID_FIXTURE");
 return assessAwinCatalogCandidate(item);
}

test("Olympikus: tênis sem preço anterior entra como preço regular sem desconto",()=>{
 const result=candidate();
 assert.equal(result.taxonomy.universe,"SNEAKER_CONFIRMED");
 assert.equal(result.price.status,"REGULAR_PRICE");
 assert.equal(result.price.previousPrice,null);
 assert.equal(result.price.discountPercent,0);
 assert.equal(result.eligibility.status,"IN_SCOPE_CONFIRMED");
});

test("feed de roupa fica fora do catálogo mesmo com preço regular",()=>{
 const x=candidate({product_name:"Camiseta Olympikus Masculina",product_type:"Masculino - Roupas - Camisetas","Fashion:size":"m"});
 assert.equal(x.taxonomy.universe,"NON_SNEAKER");
 assert.equal(x.eligibility.status,"OUT_OF_SCOPE_CONFIRMED");
});

test("oferta promocional comprovada continua elegível",()=>{
 const x=candidate({product_price_old:"499.99",search_price:"299.99",savings_percent:"40.001"});
 assert.equal(x.price.status,"PROMOTION_CONFIRMED");
 assert.equal(x.eligibility.status,"IN_SCOPE_CONFIRMED");
});

test("sem estoque ou imagem o preço regular não libera publicação",()=>{
 assert.equal(candidate({in_stock:"0"}).eligibility.status,"REVIEW_REQUIRED");
 assert.equal(candidate({merchant_image_url:""}).eligibility.status,"REVIEW_REQUIRED");
});

test("porcentagem sem histórico não vira promoção inventada",()=>{
 const x=candidate({savings_percent:"30"});
 assert.equal(x.price.status,"REVIEW_REQUIRED");
 assert.equal(x.eligibility.status,"REVIEW_REQUIRED");
});
