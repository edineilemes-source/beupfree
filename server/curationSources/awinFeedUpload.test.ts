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

test("upload AWIN requer autenticação, confirma origem e não publica produtos",async()=>{
 const previous={enabled:process.env.UPPULSE_FEED_UPLOAD_ENABLED,token:process.env.UPPULSE_FEED_UPLOAD_TOKEN,dir:process.env.UPPULSE_FEED_INBOX_DIR,node:process.env.NODE_ENV};
 const dir=await mkdtemp(join(tmpdir(),"uppulse-feed-upload-test-"));
 process.env.NODE_ENV="test";
 process.env.UPPULSE_FEED_UPLOAD_ENABLED="true";
 process.env.UPPULSE_FEED_UPLOAD_TOKEN="a".repeat(48);
 process.env.UPPULSE_FEED_INBOX_DIR=dir;
 const app=express();app.use("/api/admin/awin-feeds",createAwinFeedUploadRouter());
 const server=app.listen(0);
 try{
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const port=(server.address() as AddressInfo).port;
  const url="http://127.0.0.1:"+port+"/api/admin/awin-feeds/upload";
  const raw=readFileSync(new URL("../integrations/awin/fixtures/sample.csv",import.meta.url),"utf8").replaceAll("feed-7","51837").replaceAll(",42,BRL",",17698,BRL");
  const data=gzipSync(raw);
  const base={"Content-Type":"application/gzip","X-Awin-Merchant-Id":"17698","X-Awin-Feed-Id":"51837",Origin:"http://127.0.0.1:"+port};
  const unauthorized=await fetch(url,{method:"POST",headers:base,body:data});
  assert.equal(unauthorized.status,403);
  const badOrigin=await fetch(url,{method:"POST",headers:{...base,Origin:"https://hostile.test","X-UpPulse-Admin-Token":"a".repeat(48)},body:data});
  assert.equal(badOrigin.status,403);
  const result=await fetch(url,{method:"POST",headers:{...base,"X-UpPulse-Admin-Token":"a".repeat(48)},body:data});
  const report=await result.json();
  assert.equal(result.status,201,JSON.stringify(report));
  assert.equal(report.stats.rows,2);
  assert.equal(report.imported,0);assert.equal(report.published,0);
  assert.equal(report.merchant,"17698");assert.equal(report.feedId,"51837");
  assert.match(report.storedName,/^17698-51837-[0-9a-f]{16}\.csv\.gz$/);
  assert.equal(statSync(join(dir,report.storedName)).size,data.length);
 }finally{
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  await rm(dir,{recursive:true,force:true});
  for(const [name,value] of Object.entries(previous)){
   const key=({enabled:"UPPULSE_FEED_UPLOAD_ENABLED",token:"UPPULSE_FEED_UPLOAD_TOKEN",dir:"UPPULSE_FEED_INBOX_DIR",node:"NODE_ENV"} as Record<string,string>)[name];
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});
