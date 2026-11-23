/**
 * Engine for an eventual durable Curadoria V3 queue. No database schema changes,
 * network calls, or commercial writes in this module.
 *
 * Executor adapters must be the existing AWIN + historical Product Identity
 * implementations; never implement matching or promotion checks here.
 */
import {digest} from "../productIdentity/contracts";

export const WORKFLOW_STEPS=[
 "IMPORT_FEED","TRIAGE_PRODUCTS","PROCESS_PRODUCT_MASTER","CHECK_PRICE_EVIDENCE",
 "CLASSIFY_PRODUCTS","NORMALIZE_VARIANTS","BUILD_SEARCH_PROJECTION","VERIFY_STORE_VISIBILITY"
] as const;
export type WorkflowStep=(typeof WORKFLOW_STEPS)[number];
export type WorkflowState="PENDING"|"RUNNING"|"PARTIAL"|"BLOCKED"|"COMPLETE";
export type WorkflowStepResult={status:"COMPLETE"|"BLOCKED";reasonCodes:string[];processed:number};
export type WorkflowCheckpoint={step:WorkflowStep;status:"COMPLETE";processed:number;completedAt:string};
export type WorkflowSnapshot={
 workflowKey:string;merchantId:string;feedId:string;sha256:string;
 status:WorkflowState;completed:WorkflowCheckpoint[];blockedAt:WorkflowStep|null;
 blockReasons:string[];updatedAt:string;
};
/** Persistence, atomic claiming and leasing belong to the injected backend, not process memory. */
export type WorkflowJournal={
 read(key:string):Promise<WorkflowSnapshot|null>;
 claim(input:{workflowKey:string;merchantId:string;feedId:string;sha256:string}):Promise<WorkflowSnapshot>;
 checkpoint(key:string,step:WorkflowStep,processed:number):Promise<void>;
 block(key:string,step:WorkflowStep,reasonCodes:string[]):Promise<void>;
 finish(key:string):Promise<void>;
};
export type WorkflowHandlers=Record<WorkflowStep,()=>Promise<WorkflowStepResult>>;
export function workflowIdentity(merchantId:string,feedId:string,sha256:string){
 if(!/^\d{2,12}$/.test(merchantId)||!/^\d{2,12}$/.test(feedId)||!/^[a-f0-9]{64}$/.test(sha256))
  throw Error("WORKFLOW_SOURCE_INVALID");
 return digest({kind:"curadoria-v3",merchantId,feedId,sha256});
}
export async function runCurationWorkflow(
 source:{merchantId:string;feedId:string;sha256:string},
 journal:WorkflowJournal,
 handlers:WorkflowHandlers,
 maxSteps=1
):Promise<{workflowKey:string;status:"PARTIAL"|"BLOCKED"|"COMPLETE";executed:WorkflowStep[];next:WorkflowStep|null}>{
 if(!Number.isSafeInteger(maxSteps)||maxSteps<1||maxSteps>WORKFLOW_STEPS.length)throw Error("WORKFLOW_BUDGET_INVALID");
 const workflowKey=workflowIdentity(source.merchantId,source.feedId,source.sha256);
 // Claim must be atomic and reject concurrent workers for the same workflowKey.
 const snapshot=await journal.claim({...source,workflowKey});
 if(snapshot.workflowKey!==workflowKey||snapshot.merchantId!==source.merchantId||
  snapshot.feedId!==source.feedId||snapshot.sha256!==source.sha256)throw Error("WORKFLOW_CLAIM_MISMATCH");
 if(snapshot.status==="COMPLETE")return {workflowKey,status:"COMPLETE",executed:[],next:null};
 if(snapshot.status==="BLOCKED")return {workflowKey,status:"BLOCKED",executed:[],next:snapshot.blockedAt};
 const completed=new Set(snapshot.completed.map(item=>item.step));
 // Missing predecessors are never skipped. All snapshots should be prefix-complete.
 const prefix=WORKFLOW_STEPS.slice(0,completed.size);
 if(completed.size!==snapshot.completed.length||prefix.some(s=>!completed.has(s))||
  snapshot.completed.some(item=>!WORKFLOW_STEPS.includes(item.step)))
  throw Error("WORKFLOW_CHECKPOINT_GAP");
 const executed:WorkflowStep[]=[];
 for(const step of WORKFLOW_STEPS.slice(completed.size,completed.size+maxSteps)){
  const handler=handlers[step];
  if(typeof handler!=="function")throw Error("WORKFLOW_HANDLER_MISSING");
  let result:WorkflowStepResult;
  try{result=await handler();}
  catch{
   // Fail closed. Never mark a failed step as complete.
   await journal.block(workflowKey,step,["STEP_EXECUTION_FAILED"]);
   return {workflowKey,status:"BLOCKED",executed,next:step};
  }
  if(result.status!=="COMPLETE"||result.reasonCodes.length>0){
   await journal.block(workflowKey,step,result.reasonCodes.length?result.reasonCodes:["STEP_NOT_APPROVED"]);
   return {workflowKey,status:"BLOCKED",executed,next:step};
  }
  if(!Number.isSafeInteger(result.processed)||result.processed<0)throw Error("WORKFLOW_RESULT_INVALID");
  await journal.checkpoint(workflowKey,step,result.processed);
  executed.push(step);
 }
 const done=completed.size+executed.length;
 if(done===WORKFLOW_STEPS.length){
  await journal.finish(workflowKey);
  return {workflowKey,status:"COMPLETE",executed,next:null};
 }
 return {workflowKey,status:"PARTIAL",executed,next:WORKFLOW_STEPS[done]};
}
