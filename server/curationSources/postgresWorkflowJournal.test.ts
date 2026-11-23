import test from "node:test";
import assert from "node:assert/strict";
import {PostgresWorkflowJournal} from "./postgresWorkflowJournal";
import {workflowIdentity} from "./workflowRunner";
test("adapter PG cria job uma vez, registra checkpoint e libera o lock",async()=>{
 const key=workflowIdentity("17698","51837","f".repeat(64));
 const calls:Array<{sql:string;params:unknown[]|undefined}>=[];
 let released=0;
 const state:any={workflow_key:key,merchant_external_id:"17698",feed_external_id:"51837",
  file_sha256:"f".repeat(64),status:"PENDING",completed:[],blocked_at:null,
  block_reasons:[],updated_at:new Date()};
 const query=async(sql:string,params?:unknown[])=>{
  calls.push({sql,params});
  if(sql.includes("pg_try_advisory_lock"))return {rows:[{acquired:true}],rowCount:1};
  if(sql.includes("pg_advisory_unlock"))return {rows:[{pg_advisory_unlock:true}],rowCount:1};
  if(sql.startsWith("SELECT completed"))return {rows:[{completed:state.completed}],rowCount:1};
  if(sql.startsWith("SELECT *"))return {rows:[structuredClone(state)],rowCount:1};
  if(sql.includes("SET completed=")){state.completed=JSON.parse(String(params?.[1]));state.status="PARTIAL";return {rows:[],rowCount:1}}
  if(sql.includes("SET status='COMPLETE'")){state.status="COMPLETE";return {rows:[],rowCount:1}}
  return {rows:[],rowCount:1};
 };
 const pool:any={query,connect:async()=>({query,release:()=>{released++}})};
 const journal=new PostgresWorkflowJournal(pool);
 const before=await journal.claim({workflowKey:key,merchantId:"17698",feedId:"51837",sha256:"f".repeat(64)});
 assert.equal(before.status,"PENDING");
 await journal.checkpoint(key,"IMPORT_FEED",2);
 await journal.finish(key);
 await journal.release(key);
 assert.equal(released,1);
 assert.equal((await journal.read(key))?.status,"COMPLETE");
 assert.equal(state.completed.length,1);
 assert.equal(calls.filter(c=>c.sql.includes("pg_advisory_unlock")).length,1);
 assert.equal(calls.some(c=>/\b(DROP|TRUNCATE|ALTER)\b/.test(c.sql)),false);
});
test("concorrência rejeitada não modifica etapas",async()=>{
 let released=0,inserted=false;
 const pool:any={connect:async()=>({query:async(sql:string)=>{
  if(sql.includes("pg_try_advisory_lock"))return{rows:[{acquired:false}]};
  if(sql.includes("INSERT"))inserted=true;
  return {rows:[]}
 },release:()=>{released++}}),query:async()=>({rows:[]})};
 const journal=new PostgresWorkflowJournal(pool);
 const source={workflowKey:"a".repeat(64),merchantId:"17698",feedId:"51837",sha256:"b".repeat(64)};
 await assert.rejects(journal.claim(source),/WORKFLOW_CONCURRENT_EXECUTION/);
 assert.equal(inserted,false);assert.equal(released,1);
});
