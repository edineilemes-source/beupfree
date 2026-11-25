import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp,writeFile,rm,readFile,mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
 publicationEnabled,publicationJobKey,startAutomaticPublication,
 getPublicationJob,verifyStagedSource
} from "./autoPublication";

const digest=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
function env(jobs:string,inbox:string):NodeJS.ProcessEnv{
 return {NODE_ENV:"development",PUBLIC_DEMO_MODE:"false",
  UPPULSE_CURATOR_AUTO_PUBLISH:"true",UPPULSE_PUBLIC_CATALOG_APPROVED:"true",
  UPPULSE_PREVIEW_SOURCE_SHA:"a".repeat(40),PORT:"5013",
  DATABASE_URL:"postgresql://curator:private@127.0.0.1:5436/uppulse_catalog",
  UPPULSE_CURATOR_JOB_DIR:jobs,UPPULSE_FEED_INBOX_DIR:inbox};
}

test("automatic publisher is gated to the inspected 5013 recovery clone",()=>{
 const valid=env("/tmp/jobs","/tmp/inbox");
 assert.equal(publicationEnabled(valid),true);
 for(const [key,value] of [
  ["NODE_ENV","production"],["PUBLIC_DEMO_MODE","true"],["PORT","5011"],
  ["UPPULSE_CURATOR_AUTO_PUBLISH","false"],
  ["UPPULSE_PUBLIC_CATALOG_APPROVED","false"],
  ["DATABASE_URL","postgresql://curator:private@127.0.0.1:5435/uppulse_catalog"],
  ["DATABASE_URL","postgresql://curator:private@evil.test:5436/uppulse_catalog"],
  ["UPPULSE_PREVIEW_SOURCE_SHA","invalid"]
 ]){
  assert.equal(publicationEnabled({...valid,[key]:value}),false,key);
 }
});

test("Curadoria starts publication only once from a verified uploaded file and returns durable job",async()=>{
 const root=await mkdtemp(join(tmpdir(),"uppulse-curadoria-auto-"));
 const jobs=join(root,"jobs"),inbox=join(root,"inbox");
 const accepted=env(jobs,inbox);
 await mkdir(inbox);
 const bytes=Buffer.from("gzip-sample-data-for-verified-feed-not-network".repeat(3));
 const source={merchant:"107702",feedId:"98680",sha256:digest(bytes)};
 const file=join(inbox,"107702-98680-"+source.sha256.slice(0,16)+".csv.gz");
 let starts=0;
 try{
  await writeFile(file,bytes);
  const first=await startAutomaticPublication(source,{env:accepted,dispatch:()=>{starts++}});
  assert.equal(first.status,"QUEUED");
  assert.equal(first.phase,"RECEIVED_AND_STAGED");
  const second=await startAutomaticPublication(source,{env:accepted,dispatch:()=>{starts++}});
  assert.equal(second.status,"QUEUED");
  assert.equal(starts,1,"duplicate Curadoria actions must not launch another pipeline");
  assert.deepEqual(await getPublicationJob(source,accepted),first);
  assert.ok(publicationJobKey(source).startsWith("107702-98680-"));
  const stored=JSON.parse(await readFile(join(jobs,publicationJobKey(source)+".json"),"utf8"));
  assert.equal(stored.published,0);
  await assert.rejects(verifyStagedSource({...source,sha256:"f".repeat(64)},accepted),
   /ENOENT|HASH_MISMATCH/);
  await assert.rejects(startAutomaticPublication(source,{
   env:{...accepted,PORT:"5014"},dispatch:()=>{starts++}
  }),/NOT_ALLOWED/);
  assert.equal(starts,1);
 }finally{await rm(root,{recursive:true,force:true});}
});

test("dispatch failure is recorded as BLOCKED while staging remains intact",async()=>{
 const root=await mkdtemp(join(tmpdir(),"uppulse-curadoria-failure-"));
 const jobs=join(root,"jobs"),inbox=join(root,"inbox");await mkdir(inbox);
 const raw=Buffer.from("valid-bytes-whose-content-hash-is-verified".repeat(2));
 const source={merchant:"17698",feedId:"51837",sha256:digest(raw)};
 await writeFile(join(inbox,source.merchant+"-"+source.feedId+"-"+source.sha256.slice(0,16)+".csv.gz"),raw);
 try{
  const response=await startAutomaticPublication(source,{
   env:env(jobs,inbox),dispatch:()=>{throw Error("test spawn failure")}
  });
  assert.equal(response.status,"BLOCKED");
  assert.equal(response.reason,"PUBLICATION_JOB_DISPATCH_FAILED");
  assert.equal((await getPublicationJob(source,env(jobs,inbox)))?.status,"BLOCKED");
 }finally{await rm(root,{recursive:true,force:true});}
});
