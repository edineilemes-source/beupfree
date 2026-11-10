import test from "node:test";
import assert from "node:assert/strict";
import { enrichProduct, type ResearchCache, type ResearchProvider, type ResearchResult } from "./research";
const identity={masterId:"master-1",brand:"Adidas",model:"Adizero Adios Pro",version:"4",manufacturerCode:"ABC123"};
test("research enriches once and reuses cached knowledge",async()=>{
 const storage=new Map<string,ResearchResult>();let searches=0;
 const cache:ResearchCache={get:async k=>storage.get(k)??null,set:async(k,v)=>{storage.set(k,v);}};
 const provider:ResearchProvider={
  search:async()=>{searches++;return [{url:"https://example.org/shoe",title:"Specs",snippet:"",sourceType:"RETAILER"}];},
  extract:async(_,hit)=>[{field:"cabedal",value:"Malha",sourceUrl:hit.url,sourceType:hit.sourceType,observedAt:"2026-11-09"}],
 };
 const first=await enrichProduct(identity,provider,cache);
 const second=await enrichProduct(identity,provider,cache);
 assert.equal(first.state,"ENRICHED");assert.equal(first.card.fields.find(f=>f.field==="cabedal")?.value,"Malha");
 assert.equal(second.queried,false);assert.equal(searches,1);
});
test("rejects citations not present in research results",async()=>{
 const cache:ResearchCache={get:async()=>null,set:async()=>{throw Error("unexpected cache write");}};
 const provider:ResearchProvider={search:async()=>[{url:"https://example.org/a",title:"",snippet:"",sourceType:"RETAILER"}],
  extract:async()=>[{field:"drop",value:"6 mm",sourceUrl:"https://invented.example/drop",sourceType:"RETAILER",observedAt:"2026-11-09"}]};
 const result=await enrichProduct(identity,provider,cache);
 assert.equal(result.state,"NO_EVIDENCE");assert.ok(result.warnings.includes("UNTRUSTED_CITATION"));
});
test("provider failures do not create fictitious data",async()=>{
 const cache:ResearchCache={get:async()=>null,set:async()=>{}};
 const provider:ResearchProvider={search:async()=>{throw Error("offline");},extract:async()=>[]};
 const result=await enrichProduct(identity,provider,cache);
 assert.equal(result.state,"RESEARCH_FAILED");assert.equal(result.card.sourcesConsulted,0);
});
