import test from "node:test";
import assert from "node:assert/strict";
import {verifyCrossStoreMaster} from "./masterAcrossStores";

test("confirmed Master shows regular 0% and promotional offers from two actual merchants without writes",async()=>{
 const sql:string[]=[];
 const db={query:async(query:string,_params?:unknown[])=>{
  sql.push(query);
  if(query.includes("count(*)::int total FROM"))return {rows:[{total:1}]};
  if(query.includes("min(e.product_id) product_id"))return {rows:[{master_product_id:"master1",product_id:"prod1"}]};
  if(query.includes("SELECT DISTINCT m.master_product_id FROM"))return {rows:[{master_product_id:"master1"}]};
  if(query.includes("SELECT * FROM master_products"))return {rows:[{
   id:"master1",canonical_name:"Tênis Teste",brand_normalized:"Teste",
   product_type:"sneaker",model_tokens:["teste"],generation:null,technical_qualifiers:[],
   attribute_evidence:{master:{modelFamily:"Teste"},canonicalNameStatus:"SOURCE_NAME"}
  }]};
  if(query.includes("m.evidence->'snapshot'->'observedVariants' variants"))return {rows:[
   {external_identity_id:"id1",product_id:"prod1",merchant_id:"m1",main_name:"Tênis Teste"},
   {external_identity_id:"id2",product_id:"prod2",merchant_id:"m2",main_name:"Tênis Teste"}
  ]};
  if(query.includes("SELECT count(*) n FROM product_master_memberships"))return {rows:[{n:"2"}]};
  if(query.includes("SELECT DISTINCT c.product_id"))return {rows:[
   {product_id:"prod1",merchant_name:"Loja A",product_name:"Tênis Teste",
    current_price:"150.00",previous_price:"150.00",discount_percent:"0",
    promotion_status:"REGULAR_PRICE",affiliate_url:"https://shop.example/a"},
   {product_id:"prod2",merchant_name:"Loja B",product_name:"Tênis Teste",
    current_price:"130.00",previous_price:"180.00",discount_percent:"27.78",
    promotion_status:"PROMOTION_CONFIRMED",affiliate_url:"https://shop.example/b"}
  ]};
  if(query.startsWith("SELECT v.gtin"))return {rows:[]};
  if(query.includes("SELECT c.product_id,c.product_name,c.current_price"))return {rows:[]};
  throw Error("QUERY_UNEXPECTED:"+query.slice(0,100));
 }};
 const result=await verifyCrossStoreMaster(db,8);
 assert.equal(result.mode,"READ_ONLY");assert.equal(result.publication,false);
 assert.equal(result.changes,0);assert.equal(result.masterGroupsWithMultipleMerchants,1);
 assert.equal(result.confirmed.length,1);
 assert.equal(result.confirmed[0].offers.length,2);
 assert.deepEqual(result.confirmed[0].offers.map(x=>x.merchant),["Loja B","Loja A"]);
 const regular=result.confirmed[0].offers.find(x=>x.merchant==="Loja A")!;
 assert.equal(regular.discountPercent,0);assert.equal(regular.previousPrice,null);
 assert.ok(sql.find(x=>x.includes("SELECT DISTINCT c.product_id"))?.includes("c.promotion_status='REGULAR_PRICE'"));
 assert.ok(sql.every(x=>!/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i.test(x)));
});

test("same GTIN across stores is shown for manual review, never confirmed automatically",async()=>{
 const sql:string[]=[];
 const db={query:async(query:string)=>{
  sql.push(query);
  if(query.includes("count(*)::int total FROM"))return {rows:[{total:0}]};
  if(query.includes("min(e.product_id) product_id"))return {rows:[]};
  if(query.startsWith("SELECT v.gtin"))return {rows:[{gtin:"7891234567890"}]};
  if(query.includes("SELECT c.product_id,c.product_name,c.current_price"))return {rows:[]};
  if(query.includes("SELECT DISTINCT ON (c.merchant_id)"))return {rows:[
   {product_id:"a",product_name:"Tênis Teste Azul",merchant_name:"Loja A",
    current_price:200,previous_price:200,discount_percent:0,
    promotion_status:"REGULAR_PRICE",affiliate_url:"https://example.test/a"},
   {product_id:"b",product_name:"Tênis Teste Azul",merchant_name:"Loja B",
    current_price:170,previous_price:170,discount_percent:0,
    promotion_status:"REGULAR_PRICE",affiliate_url:"https://example.test/b"}
  ]};
  throw Error("QUERY_UNEXPECTED");
 }};
 const result=await verifyCrossStoreMaster(db);
 assert.equal(result.confirmed.length,0);
 assert.equal(result.gtinCandidates.length,1);
 assert.equal(result.gtinCandidates[0].reason,"SAME_GTIN_REVIEW_REQUIRED");
 assert.equal(result.gtinCandidates[0].offers[1].price,200);
 assert.ok(sql.every(x=>!/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i.test(x)));
});

test("invalid limits are rejected before database access",async()=>{
 const db={query:async()=>{throw Error("DB_MUST_NOT_BE_CALLED")}};
 await assert.rejects(verifyCrossStoreMaster(db,0),/CROSS_STORE_LIMIT_INVALID/);
 await assert.rejects(verifyCrossStoreMaster(db,21),/CROSS_STORE_LIMIT_INVALID/);
});


test("historical matcher suggests a same-model pair across two stores without merging their Master records",async()=>{
 const db={query:async(query:string)=>{
  if(query.includes("count(*)::int total FROM"))return {rows:[{total:0}]};
  if(query.includes("min(e.product_id) product_id"))return {rows:[]};
  if(query.startsWith("SELECT v.gtin"))return {rows:[]};
  if(query.includes("SELECT c.product_id,c.product_name,c.current_price"))return {rows:[
   {product_id:"a",merchant_id:"ma",merchant_name:"Loja A",product_name:"Tênis Nike Air Max Excee",
    brand_name:"Nike",current_price:199,previous_price:199,discount_percent:0,
    promotion_status:"REGULAR_PRICE",affiliate_url:"https://example.test/a"},
   {product_id:"b",merchant_id:"mb",merchant_name:"Loja B",product_name:"Tênis Nike Air Max Excee",
    brand_name:"Nike",current_price:189,previous_price:189,discount_percent:0,
    promotion_status:"REGULAR_PRICE",affiliate_url:"https://example.test/b"}
  ]};
  throw Error("QUERY_UNEXPECTED:"+query);
 }};
 const report=await verifyCrossStoreMaster(db);
 assert.equal(report.confirmed.length,0);
 assert.equal(report.matcherCandidates.length,1);
 assert.equal(report.matcherCandidates[0].reason,"MATCHER_AUTO_MATCH_NOT_PERSISTED");
 assert.equal(report.matcherCandidates[0].offers.length,2);
 assert.equal(report.matcherCandidates[0].offers[0].price,189);
 assert.equal(report.changes,0);
});
