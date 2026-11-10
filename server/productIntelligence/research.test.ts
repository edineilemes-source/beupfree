import test from "node:test";
import assert from "node:assert/strict";
import { enrichProduct, type ResearchCache, type ResearchProvider, type ResearchResult } from "./research";
import { createSuperCatalogCard } from "./superCatalog";
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

test("ten concurrent requests share one search while a different product proceeds", async () => {
 const storage = new Map<string, ResearchResult>();
 const cache: ResearchCache = { get: async key => storage.get(key) ?? null, set: async (key, result) => { storage.set(key, result); } };
 let unblock!: () => void;
 const blocked = new Promise<void>(resolve => { unblock = resolve; });
 let searches = 0;
 let extractions = 0;
 const provider: ResearchProvider = {
  async search(query) {
   searches++;
   if (query.includes("Adidas")) await blocked;
   return [{ url: "https://example.org/spec", title: "", snippet: "", sourceType: "RETAILER" }];
  },
  async extract(_, hit) {
   extractions++;
   return [{ field: "cabedal", value: "Mesh", sourceUrl: hit.url, sourceType: hit.sourceType, observedAt: "2026-11-09" }];
  },
 };
 const requests = Array.from({ length: 10 }, () => enrichProduct(identity, provider, cache));
 try {
  const independent = await enrichProduct({ ...identity, masterId: "other", brand: "Other" }, provider, cache);
  assert.equal(independent.state, "ENRICHED");
  assert.equal(searches, 2);
  assert.equal(extractions, 1);
 } finally {
  unblock();
 }
 const results = await Promise.all(requests);
 assert.equal(results.filter(result => result.queried).length, 1);
 assert.ok(results.every(result => result.state === "ENRICHED"));
 assert.equal((await enrichProduct(identity, provider, cache)).queried, false);
 assert.equal(searches, 2);
 assert.equal(extractions, 2);
});

test("timeout, cancellation and search failure release local coordination", async () => {
 const keepAlive = setTimeout(() => {}, 2_000);
 const cache: ResearchCache = { get: async () => null, set: async () => {} };
 const hanging: ResearchProvider = { search: () => new Promise(() => {}), extract: async () => [] };
 let calls = 0;
 const healthy: ResearchProvider = { search: async () => { calls++; return []; }, extract: async () => [] };
 try {
  const timedOut = await enrichProduct(identity, hanging, cache, { timeoutMs: 10 });
  assert.deepEqual(timedOut.warnings, ["RESEARCH_TIMEOUT"]);
  const controller = new AbortController();
  const cancelled = enrichProduct(identity, hanging, cache, { signal: controller.signal });
  controller.abort();
  assert.deepEqual((await cancelled).warnings, ["RESEARCH_CANCELLED"]);
  const offline: ResearchProvider = { ...healthy, search: async () => { throw Error("private data"); } };
  assert.deepEqual((await enrichProduct(identity, offline, cache)).warnings, ["SEARCH_FAILED"]);
  assert.equal((await enrichProduct(identity, healthy, cache)).state, "NO_EVIDENCE");
  assert.equal(calls, 1);
 } finally {
  clearTimeout(keepAlive);
 }
});

test("cache identity conflict blocks the provider and cache write conflicts stay visible", async () => {
 const seed: ResearchResult = {
  card: { ...createSuperCatalogCard(identity), masterId: "wrong" },
  state: "ENRICHED", queried: false, warnings: [],
 };
 const provider: ResearchProvider = {
  search: async () => [{ url: "https://example.org/spec", title: "", snippet: "", sourceType: "RETAILER" }],
  extract: async (_, hit) => [{ field: "cabedal", value: "Mesh", sourceUrl: hit.url, sourceType: hit.sourceType, observedAt: "2026-11-09" }],
 };
 await assert.rejects(enrichProduct(identity, {
  ...provider, search: async () => assert.fail("cache conflict must stop search"),
 }, { get: async () => seed, set: async () => {} }), /CACHE_MASTER_ID_MISMATCH/);
 await assert.rejects(enrichProduct(identity, provider, {
  get: async () => null, set: async () => { throw Error("CACHE_MASTER_ID_MISMATCH"); },
 }), /CACHE_MASTER_ID_MISMATCH/);
 const result = await enrichProduct(identity, provider, {
  get: async () => null, set: async () => { throw Error("private database error"); },
 });
 assert.equal(result.state, "ENRICHED");
 assert.deepEqual(result.warnings, ["CACHE_WRITE_FAILED"]);
});
