import test from "node:test";
import assert from "node:assert/strict";
import {normalizedValue,evidenceAgreements} from "./technicalNormalization";
import {createSuperCatalogCard} from "./superCatalog";
const ids={masterId:"evo-lab",brand:"Adidas",model:"Adizero Evo SL"};
const ev=(field:string,value:string,host:string)=>({field,value,sourceUrl:"https://"+host+"/evo-sl",sourceType:"INDEPENDENT_TEST" as const,observedAt:"2026-11-16"});
test("drop 6mm and 6 mm group together but 6.5 mm remains a conflict",()=>{
 const card=createSuperCatalogCard(ids,[ev("drop","6 mm","a.example"),ev("drop","6mm","b.example"),ev("drop","6.5 mm","c.example")]);
 const f=card.fields.find(f=>f.field==="drop")!;
 assert.equal(f.status,"CONFLICT");
 assert.equal(f.value,null);
 assert.deepEqual(f.agreements?.map(g=>[g.value,g.count]),[["6 mm",2],["6,5 mm",1]]);
});
test("height 38/32 in distinct English formats agrees; 37/30.5 remains distinct",()=>{
 const card=createSuperCatalogCard(ids,[
  ev("altura_do_solado","38 mm in heel, 32 mm in forefoot","a.example"),
  ev("altura_do_solado","38mm heel / 32mm forefoot","b.example"),
  ev("altura_do_solado","37 mm heel / 30.5 mm forefoot","c.example"),
 ]);
 const f=card.fields.find(f=>f.field==="altura_do_solado")!;
 assert.equal(f.status,"CONFLICT");
 assert.equal(f.agreements?.length,2);
 assert.equal(f.agreements?.[0].count,2);
 assert.equal(f.agreements?.[0].value,"Calcanhar 38 mm / antepé 32 mm");
});
test("exact matching drop variants become VERIFIED without losing original citations",()=>{
 const card=createSuperCatalogCard(ids,[ev("drop","6mm","a.example"),ev("drop","6 mm","b.example")]);
 const f=card.fields.find(f=>f.field==="drop")!;
 assert.equal(f.status,"VERIFIED");
 assert.equal(f.value,"6 mm");
 assert.deepEqual(f.sources.map(s=>s.value),["6mm","6 mm"]);
});
test("weight across sizes and non-equivalent technologies are NOT normalized into consensus",()=>{
 const card=createSuperCatalogCard(ids,[
  ev("peso","7.9 oz (224 g) US M9","a.example"),ev("peso","8.3oz / 235g","b.example"),
  ev("tecnologia","Lightstrike Pro and Continental rubber","a.example"),
  ev("tecnologia","Lightstrike Pro and nylon shank","b.example"),
 ]);
 assert.equal(card.fields.find(f=>f.field==="peso")?.status,"CONFLICT");
 assert.equal(card.fields.find(f=>f.field==="tecnologia")?.status,"CONFLICT");
});
test("unit conversion is dimension specific, and unparseable claims are not coerced",()=>{
 assert.equal(normalizedValue("drop","0.23 in")?.display,"5,8 mm");
 assert.equal(normalizedValue("drop","6 mm")?.display,"6 mm");
 assert.equal(normalizedValue("drop","6mm or 6.5mm"),null);
 assert.equal(normalizedValue("peso","224 g"),null);
 assert.deepEqual(evidenceAgreements("drop",[{value:"6 mm",sourceUrl:"a"},{value:"6mm",sourceUrl:"a"}]).map(x=>x.count),[1]);
});
