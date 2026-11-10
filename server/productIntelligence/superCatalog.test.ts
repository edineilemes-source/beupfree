import test from "node:test";
import assert from "node:assert/strict";
import { candidateMatch, createSuperCatalogCard } from "./superCatalog";
const id = {masterId:"master-1",brand:"Adidas",model:"Adizero Adios Pro",version:"4",manufacturerCode:"ABC123"};
test("stable superhash ignores evidence order and merchant offer", () => {
 const a = createSuperCatalogCard(id);
 const b = createSuperCatalogCard({...id,brand:"ADÍDAS",model:"  Adizero  Adios Pro "});
 assert.equal(a.superHash,b.superHash);
 assert.equal(a.masterId,"master-1");
});
test("different version and variants are not collapsed", () => {
 const a = createSuperCatalogCard(id);
 const b = createSuperCatalogCard({...id,version:"3"});
 const c = createSuperCatalogCard({...id,color:"Branco"});
 assert.notEqual(a.modelKey,b.modelKey);
 assert.notEqual(a.superHash,c.superHash);
 assert.equal(candidateMatch(id,{...id,masterId:"master-2",version:"3"}),"DIFFERENT");
});
test("conflicting sources are exposed, never invented or silently resolved", () => {
 const evidence = [
 {field:"Drop",value:"6 mm",sourceUrl:"https://example.com/a",sourceType:"MANUFACTURER" as const,observedAt:"2026-10-01"},
 {field:"Drop",value:"8 mm",sourceUrl:"https://example.org/b",sourceType:"INDEPENDENT_TEST" as const,observedAt:"2026-10-02"},
 {field:"Peso",value:"200 g",sourceUrl:"https://example.com/c",sourceType:"RETAILER" as const,observedAt:"2026-10-02"},
 {field:"Drop",value:"100 mm",sourceUrl:"javascript:alert(1)",sourceType:"FEED" as const,observedAt:"2026-10-02"},
 ];
 const card = createSuperCatalogCard(id,evidence);
 assert.equal(card.fields.find(f=>f.field==="drop")?.status,"CONFLICT");
 assert.equal(card.fields.find(f=>f.field==="drop")?.value,null);
 assert.equal(card.fields.find(f=>f.field==="peso")?.status,"SINGLE_SOURCE");
 assert.equal(card.sourcesConsulted,3);
});
test("matching never merges distinct Master IDs automatically",()=>{
 assert.equal(candidateMatch(id,{...id,masterId:"another"}),"CANDIDATE");
 assert.equal(candidateMatch(id,{...id,masterId:"another",manufacturerCode:"OTHER"}),"DIFFERENT");
 assert.equal(candidateMatch(id,id),"SAME_MASTER");
});
test("reject evidence for different manufacturer code",()=>{
 const card=createSuperCatalogCard(id,[{field:"Solado",value:"Borracha",sourceUrl:"https://example.org/a",sourceType:"RETAILER",observedAt:"2026-11-01",modelCode:"WRONG"}]);
 assert.equal(card.fields.find(f=>f.field==="solado")?.status,"UNAVAILABLE");
});
