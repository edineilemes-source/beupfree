import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type {AddressInfo} from "node:net";
import {createAwinFeedUploadRouter} from "./awinFeedUpload";

test("the four-store audit endpoint is read-only and protected by administrative configuration",async()=>{
 const prev={node:process.env.NODE_ENV,demo:process.env.PUBLIC_DEMO_MODE,temporary:process.env.UPPULSE_CURATOR_TEST_NO_AUTH};
 process.env.NODE_ENV="development";process.env.PUBLIC_DEMO_MODE="false";
 process.env.UPPULSE_CURATOR_TEST_NO_AUTH="true";
 const queries:string[]=[];
 let released=false;
 const client={query:async(sql:string)=>{
  queries.push(sql);
  if(sql.includes("SELECT count(*)::int total FROM"))return {rows:[{total:0}]};
  return {rows:[]};
 },release:()=>{released=true}};
 const app=express();
 app.use("/api/admin/awin-feeds",createAwinFeedUploadRouter(undefined,{connect:async()=>client}));
 const server=app.listen(0);
 try{
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const port=(server.address() as AddressInfo).port;
  const base="http://127.0.0.1:"+port+"/api/admin/awin-feeds/master-across-stores";
  let response=await fetch(base);
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.mode,"READ_ONLY");
  assert.equal(result.masterGroupsWithMultipleMerchants,0);
  assert.equal(result.confirmed.length,0);
  assert.equal(result.publication,false);
  assert.equal(result.changes,0);
  response=await fetch(base+"?limit=21");
  assert.equal(response.status,400);
  assert.equal(queries[0],"BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.ok(queries.includes("COMMIT"));
  assert.equal(released,true);
  assert.ok(queries.every(s=>!/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i.test(s)));
 }finally{
  await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  for(const [key,value] of [["NODE_ENV",prev.node],["PUBLIC_DEMO_MODE",prev.demo],["UPPULSE_CURATOR_TEST_NO_AUTH",prev.temporary]] as const){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
});
