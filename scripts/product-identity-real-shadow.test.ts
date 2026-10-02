import test from "node:test";
import assert from "node:assert/strict";
import { executeRealShadow, selectCohort, sourceBrand, SQL, OUTPUT, type Source, type ReadClient } from "./product-identity-real-shadow";
import { shadowFixture } from "../server/productIdentity/fixtures";
import { runReconciledShadow } from "../server/productIdentity/shadow";
const fixture=shadowFixture();
const sources: Source[]=fixture.map(r=>({id:r.identity.id,productId:r.product.id,providerId:r.provider.id,
  merchantId:r.merchant.id,feedId:r.identity.feedId??null,externalProductKey:r.identity.externalProductKey,
  name:r.product.mainName,brandId:r.product.brandId??null,brandName:r.brand?.name??null,rawBrand:null,rawBrandCount:0,
  merchantName:r.merchant.id,providerCode:r.provider.id,updatedAt:r.product.updatedAt as string,
  lastSeenAt:r.identity.lastSeenAt as string,provenanceMethod:r.identity.provenanceMethod??"normalized"}));
const secret="postgres://user:fixture-password@host/db";
function mock(readOnly="on", fail?:string) {
  const calls:string[]=[]; let ended=false;
  const client:ReadClient={async connect(){calls.push("CONNECT");if(fail==="CONNECT")throw new Error(secret);},
    async query(sql){calls.push(sql);if(sql===fail)throw new Error(secret);
      if(sql==="SHOW transaction_read_only")return {rows:[{transaction_read_only:readOnly}]};
      if(sql===SQL.universe)return {rows:[{products:12,identities:12,providers:2,merchants:3}]};
      if(sql===SQL.sources)return {rows:sources};
      if(sql===SQL.feeds)return {rows:fixture.map(r=>r.feed)};
      if(sql===SQL.variants)return {rows:[]};
      return {rows:[]};},async end(){ended=true;}};
  return {client,calls,ended:()=>ended};
}
test("requires only explicit admin connection; no fallback",async()=>{
  let called=false;
  await assert.rejects(executeRealShadow({AWIN_CURATOR_DATABASE_URL:secret,DATABASE_URL:secret},()=>{called=true;throw Error();}),/AWIN_CATALOG_ADMIN_DATABASE_URL_REQUIRED/);
  assert.equal(called,false);
});
test("READ ONLY proof gates all catalog reads and failure rolls back",async()=>{
  for(const proof of ["off","ON",""]) {
    const m=mock(proof);let saved=false;
    await assert.rejects(executeRealShadow({AWIN_CATALOG_ADMIN_DATABASE_URL:secret},()=>m.client,async()=>{saved=true;}),/REAL_SHADOW_READ_ONLY_FAILED/);
    assert.deepEqual(m.calls,["CONNECT","BEGIN READ ONLY","SHOW transaction_read_only","ROLLBACK"]);
    assert.equal(saved,false);assert.equal(m.ended(),true);
  }
});
test("cohort deterministic, bounded and represents small merchants",()=>{
  const rows=Array.from({length:4200},(_,i)=>({...sources[i%sources.length],id:String(i).padStart(5,"0"),merchantId:i<3000?"a":i<4000?"b":"c",providerId:"p"}));
  const a=selectCohort(rows),b=selectCohort([...rows].reverse());
  assert.deepEqual(a,b);assert.equal(a.length,2000);
  assert.equal(a.filter(s=>s.merchantId==="c").length,200);
  assert.equal(new Set(a.map(s=>s.merchantId)).size,3);
  assert.throws(()=>selectCohort(rows,2001),/COHORT_LIMIT/);
});
test("shared brand-token evidence ranks ahead of isolated names",()=>{
  const base={...sources[0],brandName:"Acme",providerId:"p"};
  const rows=[{...base,id:"a",name:"Unique",merchantId:"a"},{...base,id:"z",name:"Comet shoes",merchantId:"a"},{...base,id:"b",name:"Comet shoes",merchantId:"b"}];
  assert.deepEqual(selectCohort(rows,2).map(s=>s.id),["b","z"]);
  assert.equal(sourceBrand({...base,brandName:null,rawBrand:"Acme",rawBrandCount:2}),null);
});
test("existing Shadow reused; SQL read-only; output secret-free after rollback",async()=>{
  const m=mock();let content="";
  const report=await executeRealShadow({AWIN_CATALOG_ADMIN_DATABASE_URL:secret},url=>{assert.equal(url,secret);return m.client;},async(path,data)=>{
    assert.equal(path,OUTPUT);assert.equal(m.calls.at(-1),"ROLLBACK");content=data;
  });
  const expected=runReconciledShadow(fixture);assert.equal(expected.status,"COMPLETE");
  if(expected.status!=="COMPLETE")throw Error();
  assert.deepEqual(report.shadow.logical,expected.logical);
  assert.equal(report.transactionReadOnly,"on");assert.equal(report.rollback,true);
  assert.equal(report.cohort.total,fixture.length);assert.equal(report.groups.total,report.shadow.logical.groups.length);
  assert.equal(content.includes(secret),false);assert.equal(content.includes("fixture-password"),false);
  for(const sql of m.calls.filter(s=>s!=="CONNECT")) {
    assert.match(sql.trim(),/^(SELECT|WITH|BEGIN READ ONLY|SHOW transaction_read_only|ROLLBACK)\b/);
    assert.doesNotMatch(sql,/\b(INSERT|UPDATE|DELETE|UPSERT|CREATE|ALTER|DROP|TRUNCATE|COMMIT)\b/i);
  }
  assert.equal(m.ended(),true);
});
test("query failures rollback, close and never expose errors or save partial reports",async()=>{
  for(const failure of ["CONNECT","BEGIN READ ONLY","SHOW transaction_read_only",SQL.sources]) {
    const m=mock("on",failure);let saved=false;
    await assert.rejects(executeRealShadow({AWIN_CATALOG_ADMIN_DATABASE_URL:secret},()=>m.client,async()=>{saved=true;}),error=>error instanceof Error && !error.message.includes(secret));
    assert.equal(m.ended(),true);assert.equal(saved,false);
    if(failure!=="CONNECT")assert.equal(m.calls.at(-1),"ROLLBACK");
  }
});
test("output failure occurs after rollback and connection closes",async()=>{
  const m=mock();await assert.rejects(executeRealShadow({AWIN_CATALOG_ADMIN_DATABASE_URL:secret},()=>m.client,async()=>{throw Error(secret);}),/REAL_SHADOW_OUTPUT_FAILED/);
  assert.equal(m.calls.at(-1),"ROLLBACK");assert.equal(m.ended(),true);
});
test("operational raw brand enriches input without fabricated brands provenance; PostgreSQL timestamps normalized",async()=>{
  const rows=sources.map(s=>({...s,brandId:null,brandName:null,rawBrand:s.brandName,rawBrandCount:s.brandName?1:0,
    updatedAt:"2026-09-29 00:00:00+00",lastSeenAt:"2026-09-29 00:00:00+00"}));
  const m=mock();const query=m.client.query.bind(m.client);
  m.client.query=async(sql,params)=>sql===SQL.sources?{rows}:query(sql,params);
  const report=await executeRealShadow({AWIN_CATALOG_ADMIN_DATABASE_URL:secret},()=>m.client,async()=>{});
  const snap=report.shadow.logical.snapshots.find(s=>s.externalIdentityId===sources[0].id)!;
  assert.equal(snap.input.brand,sources[0].brandName);
  assert.equal(snap.timestamps.updatedAt,"2026-09-29T00:00:00.000Z");
  assert.equal(snap.provenance.some(p=>p.entity==="brands"),false);
  assert.match(report.cohort.brandEvidence[0].source,/commerce_raw_feed_items/);
});
test("unproven READ ONLY and failed rollback cannot produce a report",async()=>{
  const m=mock("off","ROLLBACK");let saved=false;
  await assert.rejects(executeRealShadow({AWIN_CATALOG_ADMIN_DATABASE_URL:secret},()=>m.client,async()=>{saved=true;}),/REAL_SHADOW_ROLLBACK_FAILED/);
  assert.equal(saved,false);assert.equal(m.ended(),true);
});
