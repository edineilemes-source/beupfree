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
 const previous={admins:process.env.UPPULSE_CURATOR_ADMIN_EMAILS,dir:process.env.UPPULSE_FEED_INBOX_DIR,node:process.env.NODE_ENV};
 const dir=await mkdtemp(join(tmpdir(),"uppulse-feed-upload-test-"));
 process.env.NODE_ENV="test";
 process.env.UPPULSE_CURATOR_ADMIN_EMAILS="admin@test.local";
 process.env.UPPULSE_FEED_INBOX_DIR=dir;
 const app=express();
 let authenticated=false;
 app.use((req,_res,next)=>{
  if(authenticated)(req as any).session={userId:"test-user"};
  next();
 });
 app.use("/api/admin/awin-feeds",createAwinFeedUploadRouter(async()=>({email:"admin@test.local",isActive:true})));
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
  assert.match(report.storedName,/^17698-51837-[0-9a-f]{16}\.csv\.gz$/);
  assert.equal(statSync(join(dir,report.storedName)).size,data.length);
  const mismatch=await fetch(url,{method:"POST",headers:{...base,"X-Awin-File-Name":"99999-51837-x.csv.gz"},body:data});
  assert.equal(mismatch.status,422);
 }finally{
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await rm(dir,{recursive:true,force:true});
  for(const [name,value] of Object.entries(previous)){
   const key=({admins:"UPPULSE_CURATOR_ADMIN_EMAILS",dir:"UPPULSE_FEED_INBOX_DIR",node:"NODE_ENV"} as Record<string,string>)[name];
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});
