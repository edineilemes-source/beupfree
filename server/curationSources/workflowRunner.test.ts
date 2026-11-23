import test from "node:test";
import assert from "node:assert/strict";
import {WORKFLOW_STEPS,runCurationWorkflow,workflowIdentity,type WorkflowJournal,type WorkflowSnapshot,type WorkflowHandlers} from "./workflowRunner";
const source={merchantId:"17698",feedId:"51837",sha256:"a".repeat(64)};
function fixture(){
 let record:WorkflowSnapshot|null=null;
 const log:string[]=[];
 const journal:WorkflowJournal={
  async read(){return record},
  async claim(input){
   if(!record)record={...input,status:"RUNNING",completed:[],blockedAt:null,blockReasons:[],updatedAt:"2026-11-23"};
   return structuredClone(record);
  },
  async checkpoint(key,step,processed){assert.equal(record?.workflowKey,key);record!.completed.push({step,status:"COMPLETE",processed,completedAt:"2026-11-23"});log.push("checkpoint:"+step)},
  async block(_key,step,reasons){record!.status="BLOCKED";record!.blockedAt=step;record!.blockReasons=reasons;log.push("block:"+step)},
  async finish(){record!.status="COMPLETE";log.push("finished")}
 };
 const handlers=Object.fromEntries(WORKFLOW_STEPS.map(step=>[step,async()=>{log.push("run:"+step);return{status:"COMPLETE",reasonCodes:[],processed:1}}])) as WorkflowHandlers;
 return {journal,handlers,log,record:()=>record};
}
test("retoma o lote a partir do último checkpoint, sem repetir trabalho",async()=>{
 const f=fixture();
 const a=await runCurationWorkflow(source,f.journal,f.handlers,2);
 assert.equal(a.status,"PARTIAL");assert.equal(a.executed.length,2);
 const b=await runCurationWorkflow(source,f.journal,f.handlers,2);
 assert.equal(b.status,"PARTIAL");assert.equal(b.executed[0],WORKFLOW_STEPS[2]);
 const c=await runCurationWorkflow(source,f.journal,f.handlers,4);
 assert.equal(c.status,"COMPLETE");assert.equal(c.executed.at(-1),"VERIFY_STORE_VISIBILITY");
 const d=await runCurationWorkflow(source,f.journal,f.handlers,8);
 assert.equal(d.status,"COMPLETE");assert.deepEqual(d.executed,[]);
 assert.equal(f.log.filter(v=>v.startsWith("run:")).length,WORKFLOW_STEPS.length);
 assert.equal(f.log.filter(v=>v==="finished").length,1);
});
test("ambiguidades do matcher bloqueiam a projeção e preservam o histórico",async()=>{
 const f=fixture();
 f.handlers.PROCESS_PRODUCT_MASTER=async()=>({status:"BLOCKED",reasonCodes:["MASTER_REVIEW_REQUIRED"],processed:0});
 const r=await runCurationWorkflow(source,f.journal,f.handlers,8);
 assert.equal(r.status,"BLOCKED");
 assert.equal(r.next,"PROCESS_PRODUCT_MASTER");
 assert.equal(f.record()?.completed.length,2);
 assert.ok(!f.log.includes("run:BUILD_SEARCH_PROJECTION"));
 assert.ok(!f.log.includes("run:VERIFY_STORE_VISIBILITY"));
 const second=await runCurationWorkflow(source,f.journal,f.handlers,8);
 assert.deepEqual(second.executed,[]);
});
test("falha técnica impede etapas seguintes e gera motivo controlado",async()=>{
 const f=fixture();
 f.handlers.CLASSIFY_PRODUCTS=async()=>{throw Error("secret must not be logged")};
 const r=await runCurationWorkflow(source,f.journal,f.handlers,8);
 assert.equal(r.status,"BLOCKED");assert.equal(r.next,"CLASSIFY_PRODUCTS");
 assert.deepEqual(f.record()?.blockReasons,["STEP_EXECUTION_FAILED"]);
 assert.ok(!f.log.includes("run:NORMALIZE_VARIANTS"));
});
test("não permite identidade de feed inválida nem executar orçamento ilimitado",async()=>{
 const f=fixture();
 assert.equal(workflowIdentity("17698","51837",source.sha256),workflowIdentity("17698","51837",source.sha256));
 assert.notEqual(workflowIdentity("17698","51837",source.sha256),workflowIdentity("17698","51838",source.sha256));
 assert.throws(()=>workflowIdentity("17698","51837","bad"),/WORKFLOW_SOURCE_INVALID/);
 await assert.rejects(runCurationWorkflow(source,f.journal,f.handlers,9),/WORKFLOW_BUDGET_INVALID/);
});
test("snapshot com checkpoint faltando é rejeitado, não salta etapa",async()=>{
 const f=fixture();
 await f.journal.claim({...source,workflowKey:workflowIdentity(source.merchantId,source.feedId,source.sha256)});
 await f.journal.checkpoint(workflowIdentity(source.merchantId,source.feedId,source.sha256),"PROCESS_PRODUCT_MASTER",1);
 await assert.rejects(runCurationWorkflow(source,f.journal,f.handlers,1),/WORKFLOW_CHECKPOINT_GAP/);
});
