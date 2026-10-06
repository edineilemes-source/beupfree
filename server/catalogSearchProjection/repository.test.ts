import {DEMOGRAPHIC_TAXONOMY_VERSION} from "@shared/demographicTaxonomy";
import {COLOR_TAXONOMY_VERSION} from "@shared/colorTaxonomy";
import assert from "node:assert/strict";import test from "node:test";import{PgCatalogSearchProjectionRepository}from"./repository";
test("repository parametriza filtros multi-select, busca, paginação e ordenação",async()=>{const calls:{text:string;params:unknown[]}[]=[];const db:any={async query(text:string,params:unknown[]){calls.push({text,params});return{rows:[{affiliate_url:"https://literal.test/x"}]}}};const repo=new PgCatalogSearchProjectionRepository(db);const rows=await repo.listProducts({externalMerchantId:"17697",merchant:"Dafiti",brands:[" NÍKE ","Adidas"],audiences:["UNISSEX"],sizes:[40,41],priceMin:100,priceMax:500,styles:["PERFORMANCE"],activities:["RUNNING"],colors:["preto"],discountBuckets:["30% - 39%"],search:"Tênis azul",available:true,page:3,pageSize:24,sort:"price-asc"});assert.equal(rows[0].affiliate_url,"https://literal.test/x");const q=calls[0];for(const x of["catalog_search_products","representative_offer_id","external_merchant_id","brand_normalized = ANY","audience_normalized = ANY","normalized_sizes &&","discount_percent>=30","current_price>=","current_price<=","style = ANY","activities &&","color_family_ids &&","lower(c.product_name","available=","ORDER BY c.current_price ASC","LIMIT","OFFSET"])assert.ok(q.text.includes(x),x);assert.deepEqual(q.params.slice(0,12),["17697","Dafiti",["níke","adidas"],["preto"],COLOR_TAXONOMY_VERSION,["UNISSEX"],[40,41],["RUNNING"],["PERFORMANCE"],100,500,true]);assert.equal(q.params.at(-2),24);assert.equal(q.params.at(-1),48);assert.equal(q.text.includes("https://literal.test"),false);});
test("count e facets leem somente elegíveis da projeção",async()=>{const calls:string[]=[];const db:any={async query(text:string){calls.push(text);return{rows:[text.includes("count(*)::int total")?{total:11424}:{facets:{brands:[]}}]}}};const repo=new PgCatalogSearchProjectionRepository(db);assert.equal(await repo.countProducts({externalMerchantId:"17697"}),11424);await repo.getFacets({externalMerchantId:"17697",available:true});assert.ok(calls.every(q=>q.includes("catalog_search_products")));assert.ok(calls.every(q=>!q.includes("commerce_raw_feed_items")&&!q.includes("raw_payload")));assert.ok(calls.every(q=>q.includes("catalog_state='CATALOG_ELIGIBLE'")));});
test("detalhe e clique resolvem somente ofertas elegíveis e disponíveis",async()=>{const calls:{text:string;params:unknown[]}[]=[];const db:any={async query(text:string,params:unknown[]){calls.push({text,params});return{rows:[{product_id:"p1",representative_offer_id:"o1",affiliate_url:"https://affiliate.test/x"}]}}};const repo=new PgCatalogSearchProjectionRepository(db);assert.equal((await repo.getProduct("p1")).length,1);assert.equal((await repo.getOffer("o1"))?.affiliate_url,"https://affiliate.test/x");for(const call of calls){assert.ok(call.text.includes("catalog_state='CATALOG_ELIGIBLE'"));assert.ok(call.text.includes("c.available=true"));assert.deepEqual(call.params,call===calls[0]?["p1",DEMOGRAPHIC_TAXONOMY_VERSION]:["o1"]);}});


test("substituição da projeção recusa escopo vazio antes de consultar o banco",async()=>{
 const {removeStaleMerchantProjection}=await import("./repository");
 let calls=0;const db:any={query:async()=>{calls++;return{rowCount:0};}};
 await assert.rejects(removeStaleMerchantProjection(db,"17893",[]),/SCOPE_REQUIRED/);
 await assert.rejects(removeStaleMerchantProjection(db,"",["p1"]),/SCOPE_REQUIRED/);
 await assert.rejects(removeStaleMerchantProjection(db,"17893",[""]),/SCOPE_REQUIRED/);
 assert.equal(calls,0);
});
test("substituição remove somente projeções obsoletas do merchant solicitado",async()=>{
 const {removeStaleMerchantProjection}=await import("./repository");
 const calls:any[]=[];const db:any={query:async(sql:string,params:unknown[])=>{calls.push({sql,params});return{rowCount:13};}};
 assert.equal(await removeStaleMerchantProjection(db,"17893",["p1","p2"]),13);
 assert.deepEqual(calls[0].params,["17893",["p1","p2"]]);
 assert.match(calls[0].sql,/DELETE FROM catalog_search_products WHERE merchant_id=/);
 assert.match(calls[0].sql,/external_merchant_id=\$1/);
 assert.match(calls[0].sql,/NOT \(product_id=ANY\(\$2::text\[\]\)\)/);
});

test("V3 facets unnest deduplicated family IDs, never parse raw, gate version",async()=>{
 const calls:string[]=[];const repo=new PgCatalogSearchProjectionRepository({query:async(sql:string)=>{calls.push(sql);return {rows:[{facets:{}}]};}} as any);
 await repo.getFacets({colors:["azul"],brands:["Nike"],sizes:[40]});
 assert.match(calls[0],/SELECT DISTINCT unnest\(color_family_ids\)/);
 assert.match(calls[0],/color_taxonomy_version/);assert.doesNotMatch(calls[0],/colour_raw|raw_payload|regexp_split/);
 await assert.rejects(repo.listProducts({colors:["pretolino"],page:1,pageSize:21,sort:"recommended"}),/INVALID_COLOR_FAMILY/);
 assert.equal(calls.length,1);
});
