import test from "node:test";
import assert from "node:assert/strict";
import {createCustomerKnowledge} from "./customerKnowledge";
import {createSuperCatalogCard} from "./superCatalog";
const id={masterId:"test-evo",brand:"Adidas",model:"Adizero Evo SL"};
const source=(field:string,value:string,host:string,sourceType:"INDEPENDENT_TEST"|"MANUFACTURER"="INDEPENDENT_TEST")=>({
 field,value,sourceUrl:"https://"+host+"/evo",sourceType,observedAt:"2026-11-16"
});
test("consumer summary shows both drops, short blue references metadata, no fake majority decision",()=>{
 const card=createSuperCatalogCard(id,[
  source("drop","6mm","a.example"),source("drop","6 mm","b.example"),source("drop","6.5 mm","c.example"),
  source("entressola","Lightstrike Pro","a.example"),
 ]);
 const knowledge=createCustomerKnowledge(card.fields);
 const drop=knowledge.fields.find(f=>f.field==="drop")!;
 assert.equal(drop.status,"CONFLICT");
 assert.equal(drop.alternatives,2);
 assert.match(drop.summary,/6 mm ou 6,5 mm/);
 assert.equal(drop.citations.length,2);
 assert.equal(knowledge.sources.length,3);
 assert.ok(knowledge.notice.includes("diferentes"));
 assert.ok(knowledge.summary.includes("Lightstrike Pro"));
});
test("long ten-source field remains short for consumers but audit retains all",()=>{
 const evidence=Array.from({length:10},(_,i)=>source("cabedal",i%2?"Mesh estruturado":"Malha leve","source"+i+".example"));
 const card=createSuperCatalogCard(id,evidence);
 const knowledge=createCustomerKnowledge(card.fields);
 const cabedal=knowledge.fields.find(f=>f.field==="cabedal")!;
 assert.equal(cabedal.citations.length,2);
 assert.equal(cabedal.evidenceCount,10);
 assert.equal(knowledge.sources.length,10);
 assert.equal(cabedal.alternatives,2);
});
test("the manufacturer citation receives precedence but does not suppress alternatives",()=>{
 const card=createSuperCatalogCard(id,[
  source("solado","Borracha Continental","review.example"),
  source("solado","Composto de borracha","adidas.com.br","MANUFACTURER"),
 ]);
 const field=createCustomerKnowledge(card.fields).fields.find(f=>f.field==="solado")!;
 assert.equal(field.status,"CONFLICT");
 assert.equal(field.citations[0].label,"adidas.com.br");
 assert.equal(field.alternatives,2);
});
test("identity-only card never invents specifications",()=>{
 const knowledge=createCustomerKnowledge(createSuperCatalogCard(id).fields);
 assert.deepEqual(knowledge.fields,[]);
 assert.equal(knowledge.sources.length,0);
});
