import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {gzipSync} from "node:zlib";
import express from "express";
import type {AddressInfo} from "node:net";
import {createAwinFeedUploadRouter} from "./awinFeedUpload";

test("importação AWIN reconhece a fonte automaticamente e exige sessão administrativa",async()=>{
 const previous={admins:process.env.UPPULSE_CURATOR_ADMIN_USER_IDS,dir:process.env.UPPULSE_FEED_INBOX_DIR,node:process.env.NODE_ENV,demo:process.env.PUBLIC_DEMO_MODE,temporary:process.env.UPPULSE_CURATOR_TEST_NO_AUTH};
 const dir=await mkdtemp(join(tmpdir(),"uppulse-feed-upload-test-"));
 process.env.NODE_ENV="test";
 process.env.UPPULSE_CURATOR_ADMIN_USER_IDS="test-user";
 process.env.UPPULSE_FEED_INBOX_DIR=dir;
 const app=express();
 let authenticated=false;
 app.use((req,_res,next)=>{
  if(authenticated)(req as any).session={userId:"test-user"};
  next();
 });
 app.use("/api/admin/awin-feeds",createAwinFeedUploadRouter(async()=>({id:"test-user",email:"admin@test.local",isActive:true})));
 const server=app.listen(0);
 try{
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const port=(server.address() as AddressInfo).port;
  const url="http://127.0.0.1:"+port+"/api/admin/awin-feeds/upload";
  const raw=readFileSync(new URL("../integrations/awin/fixtures/sample.csv",import.meta.url),"utf8").replaceAll("feed-7","51837").replaceAll(",42,BRL",",17698,BRL");
  const data=gzipSync(raw);
  const base={"Content-Type":"application/gzip","X-Awin-File-Name":"17698-51837-pt_BR-Default.csv.gz",Origin:"http://127.0.0.1:"+port};
  const unauthorized=await fetch(url,{method:"POST",headers:base,body:data});
  assert.equal(unauthorized.status,401);
  process.env.NODE_ENV="development";
  process.env.PUBLIC_DEMO_MODE="false";
  process.env.UPPULSE_CURATOR_TEST_NO_AUTH="true";
  const noLogin=await fetch(url,{method:"POST",headers:base,body:data});
  assert.equal(noLogin.status,201);
  process.env.NODE_ENV="production";
  const inProduction=await fetch(url,{method:"POST",headers:base,body:data});
  assert.equal(inProduction.status,401);
  process.env.NODE_ENV="test";
  process.env.UPPULSE_CURATOR_TEST_NO_AUTH="false";
  authenticated=true;
  const badOrigin=await fetch(url,{method:"POST",headers:{...base,Origin:"https://hostile.test"},body:data});
  assert.equal(badOrigin.status,403);
  const result=await fetch(url,{method:"POST",headers:base,body:data});
  const report=await result.json();
  assert.equal(result.status,201,JSON.stringify(report));
  assert.equal(report.stats.rows,2);
  assert.equal(report.imported,0);assert.equal(report.published,0);
  assert.equal(report.merchant,"17698");assert.equal(report.feedId,"51837");
  assert.equal(report.accepted+report.discarded+report.review+report.stats.invalid,report.stats.rows);
  assert.ok(Array.isArray(report.issues));
  assert.ok(Number.isInteger(report.issuesTotal));
  assert.equal(report.issuesTotal,report.issues.length);
  assert.equal(report.masterSummary.inspected,report.stats.normalized);
  assert.equal(report.masterSummary.parserVersion,"product-identity-v1.5");
  assert.ok(Array.isArray(report.masterReviews));
  assert.equal(report.masterReviewsTotal,report.masterReviews.length);
  const masterUrl=`http://127.0.0.1:${port}/api/admin/awin-feeds/report/${report.merchant}/${report.feedId}/${report.sha256}/master-reviews?page=1`;
  const masterResponse=await fetch(masterUrl);
  assert.equal(masterResponse.status,200);
  const masterBody=await masterResponse.json();
  assert.equal(masterBody.total,report.masterReviewsTotal);
  assert.deepEqual(masterBody.items,report.masterReviews);
  const issuesUrl=`http://127.0.0.1:${port}/api/admin/awin-feeds/report/${report.merchant}/${report.feedId}/${report.sha256}/issues?page=1`;
  const issuesResponse=await fetch(issuesUrl);
  assert.equal(issuesResponse.status,200);
  const issuesPage=await issuesResponse.json();
  assert.equal(issuesPage.total,report.issuesTotal);
  assert.deepEqual(issuesPage.issues,report.issues);
  const badPage=await fetch(issuesUrl.replace("page=1","page=0"));
  assert.equal(badPage.status,400);
  assert.match(report.storedName,/^17698-51837-[0-9a-f]{16}\.csv\.gz$/);
  assert.equal(statSync(join(dir,report.storedName)).size,data.length);
  const duplicate=await fetch(url,{method:"POST",headers:base,body:data});
  const duplicateReport=await duplicate.json();
  assert.equal(duplicate.status,201);
  assert.equal(duplicateReport.sha256,report.sha256);
  assert.equal((await (await fetch(masterUrl)).json()).total,report.masterReviewsTotal);
  const mismatch=await fetch(url,{method:"POST",headers:{...base,"X-Awin-File-Name":"99999-51837-x.csv.gz"},body:data});
  assert.equal(mismatch.status,422);
 }finally{
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await rm(dir,{recursive:true,force:true});
  for(const [name,value] of Object.entries(previous)){
   const key=({admins:"UPPULSE_CURATOR_ADMIN_USER_IDS",dir:"UPPULSE_FEED_INBOX_DIR",node:"NODE_ENV",demo:"PUBLIC_DEMO_MODE",temporary:"UPPULSE_CURATOR_TEST_NO_AUTH"} as Record<string,string>)[name];
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});

test("auditoria da loja compara ofertas, Master, classificação e projeção sem modificar o banco",async()=>{
 const previous={demo:process.env.PUBLIC_DEMO_MODE,node:process.env.NODE_ENV,temporary:process.env.UPPULSE_CURATOR_TEST_NO_AUTH};
 process.env.NODE_ENV="development";process.env.PUBLIC_DEMO_MODE="false";process.env.UPPULSE_CURATOR_TEST_NO_AUTH="true";
 const queries:string[]=[];let released=false;
 const tables=["commerce_merchants","commerce_feeds","offers","product_variants","external_product_identities",
  "offer_promotion_evidence","product_catalog_classifications","product_variant_normalizations",
  "catalog_search_products","product_master_memberships","product_identity_jobs"];
 const db={
  query:async(sql:string)=>{
   queries.push(sql);
   if(sql.includes("information_schema.tables"))return {rows:tables.map(table_name=>({table_name}))};
   if(sql.includes("SELECT id,name,external_merchant_id FROM commerce_merchants"))return {rows:[{id:"merchant-uuid",name:"Olympikus",external_merchant_id:"17698"}]};
   if(sql.startsWith("SELECT count"))return {rows:[{n:sql.includes("FROM offers WHERE")?5167:sql.includes("FROM product_variants WHERE")?813:sql.includes("FROM external_product_identities WHERE")?813:sql.includes("product_master_memberships")?0:sql.includes("catalog_search_products")?0:0}]};
   return {rows:[]};
  },release:()=>{released=true}
 };
 const app=express();app.use("/api/admin/awin-feeds",createAwinFeedUploadRouter(undefined,{connect:async()=>db}));
 const server=app.listen(0);
 try{
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const port=(server.address() as AddressInfo).port;
  const response=await fetch("http://127.0.0.1:"+port+"/api/admin/awin-feeds/merchant/17698/audit");
  const report=await response.json();
  assert.equal(response.status,200,JSON.stringify(report));
  assert.equal(report.merchant.name,"Olympikus");
  assert.equal(report.counts.offers,5167);
  assert.equal(report.counts.distinctProducts,813);
  assert.equal(report.counts.masterMemberships,0);
  assert.equal(report.counts.searchProducts,0);
  assert.equal(report.steps.masterCovered,false);
  assert.equal(report.steps.storeVisibleInFilter,false);
  assert.ok(queries.some(query=>query.includes("READ ONLY")));
  assert.ok(queries.includes("COMMIT"));
  assert.equal(queries.some(query=>/^(INSERT|UPDATE|DELETE|ALTER|TRUNCATE)/.test(query)),false);
  assert.equal(released,true);
 }finally{
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  for(const [name,key] of [["demo","PUBLIC_DEMO_MODE"],["node","NODE_ENV"],["temporary","UPPULSE_CURATOR_TEST_NO_AUTH"]] as const){
   const value=previous[name];if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});

test("simulação histórica Master é exposta pela Curadoria somente leitura, sem autorizar publicação",async()=>{
 const previous={node:process.env.NODE_ENV,demo:process.env.PUBLIC_DEMO_MODE,temporary:process.env.UPPULSE_CURATOR_TEST_NO_AUTH};
 process.env.NODE_ENV="development";process.env.PUBLIC_DEMO_MODE="false";process.env.UPPULSE_CURATOR_TEST_NO_AUTH="true";
 const sql:string[]=[];let released=false;
 const db={query:async(query:string)=>{
  sql.push(query);return {rows:[]}
 },release:()=>{released=true}};
 const app=express();
 app.use("/api/admin/awin-feeds",createAwinFeedUploadRouter(undefined,{connect:async()=>db}));
 const server=app.listen(0);
 try{
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const port=(server.address() as AddressInfo).port;
  const base=`http://127.0.0.1:${port}/api/admin/awin-feeds/merchant/17698/master-shadow`;
  const denied=await fetch(base+"?limit=999");
  assert.equal(denied.status,400);
  const accepted=await fetch(base+"?limit=20");
  assert.equal(accepted.status,200);
  const report=await accepted.json();
  assert.equal(report.mode,"READ_ONLY_SHADOW");
  assert.equal(report.scanned,0);
  assert.equal(report.published,0);
  assert.equal(report.merged,0);
  assert.equal(report.coverageLimited,true);
  assert.equal(released,true);
  assert.ok(sql.includes("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"));
  assert.ok(sql.includes("COMMIT"));
  assert.equal(sql.some(q=>/^(INSERT|UPDATE|DELETE|ALTER|TRUNCATE)/i.test(q)),false);
 }finally{
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  for(const [name,key] of [["node","NODE_ENV"],["demo","PUBLIC_DEMO_MODE"],["temporary","UPPULSE_CURATOR_TEST_NO_AUTH"]] as const){
   const value=previous[name];if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});
