/**
 * Durable PG journal adapter for Curadoria V3.
 * Requires the reviewed additive curation_workflow_runs migration; never runs it.
 * Session advisory locks prevent concurrent processing of one feed snapshot.
 */
import type {Pool,PoolClient} from "pg";
import type {WorkflowJournal,WorkflowSnapshot,WorkflowStep} from "./workflowRunner";

const fullKey=/^[a-f0-9]{64}$/;
const snapshot=(r:any):WorkflowSnapshot=>({
 workflowKey:r.workflow_key,merchantId:r.merchant_external_id,feedId:r.feed_external_id,
 sha256:r.file_sha256,status:r.status,completed:r.completed??[],
 blockedAt:r.blocked_at??null,blockReasons:r.block_reasons??[],
 updatedAt:String(r.updated_at)
});
export class PostgresWorkflowJournal implements WorkflowJournal{
 private readonly locks=new Map<string,PoolClient>();
 constructor(private readonly pool:Pick<Pool,"connect"|"query">){}
 async read(key:string){
  if(!fullKey.test(key))throw Error("WORKFLOW_KEY_INVALID");
  const result=await this.pool.query("SELECT * FROM curation_workflow_runs WHERE workflow_key=$1",[key]);
  return result.rows[0]?snapshot(result.rows[0]):null;
 }
 async claim(input:{workflowKey:string;merchantId:string;feedId:string;sha256:string}){
  if(!fullKey.test(input.workflowKey)||!fullKey.test(input.sha256))throw Error("WORKFLOW_KEY_INVALID");
  if(this.locks.has(input.workflowKey))throw Error("WORKFLOW_ALREADY_CLAIMED");
  const db=await this.pool.connect();
  let locked=false;
  try{
   // Transaction-independent session lock remains held until explicit release.
   const result=await db.query("SELECT pg_try_advisory_lock(hashtext($1)) acquired",[input.workflowKey]);
   if(!result.rows[0]?.acquired)throw Error("WORKFLOW_CONCURRENT_EXECUTION");
   locked=true;
   await db.query(`INSERT INTO curation_workflow_runs(
    workflow_key,merchant_external_id,feed_external_id,file_sha256,status
   ) VALUES($1,$2,$3,$4,'PENDING') ON CONFLICT(workflow_key) DO NOTHING`,
    [input.workflowKey,input.merchantId,input.feedId,input.sha256]);
   const current=(await db.query("SELECT * FROM curation_workflow_runs WHERE workflow_key=$1",[input.workflowKey])).rows[0];
   if(!current||current.merchant_external_id!==input.merchantId||
    current.feed_external_id!==input.feedId||current.file_sha256!==input.sha256)
    throw Error("WORKFLOW_PERSISTED_SOURCE_MISMATCH");
   this.locks.set(input.workflowKey,db);
   return snapshot(current);
  }catch(error){
   if(locked)await db.query("SELECT pg_advisory_unlock(hashtext($1))",[input.workflowKey]).catch(()=>{});
   db.release();throw error;
  }
 }
 private owned(key:string){
  const db=this.locks.get(key);if(!db)throw Error("WORKFLOW_NOT_CLAIMED");return db;
 }
 async checkpoint(key:string,step:WorkflowStep,processed:number){
  const db=this.owned(key);
  const current=(await db.query("SELECT completed FROM curation_workflow_runs WHERE workflow_key=$1",[key])).rows[0];
  const completed=current?.completed as unknown[];
  if(!Array.isArray(completed))throw Error("WORKFLOW_CHECKPOINT_CORRUPT");
  const next=[...completed,{step,status:"COMPLETE",processed,completedAt:new Date().toISOString()}];
  const result=await db.query(`UPDATE curation_workflow_runs
   SET completed=$2::jsonb,status='PARTIAL',blocked_at=NULL,
   block_reasons='[]'::jsonb,updated_at=clock_timestamp()
   WHERE workflow_key=$1 AND status IN ('PENDING','PARTIAL','RUNNING')`,
   [key,JSON.stringify(next)]);
  if(result.rowCount!==1)throw Error("WORKFLOW_CHECKPOINT_REJECTED");
 }
 async block(key:string,step:WorkflowStep,reasonCodes:string[]){
  const result=await this.owned(key).query(`UPDATE curation_workflow_runs
   SET status='BLOCKED',blocked_at=$2,block_reasons=$3::jsonb,updated_at=clock_timestamp()
   WHERE workflow_key=$1 AND status IN ('PENDING','PARTIAL','RUNNING')`,
   [key,step,JSON.stringify(reasonCodes)]);
  if(result.rowCount!==1)throw Error("WORKFLOW_BLOCK_REJECTED");
 }
 async finish(key:string){
  const result=await this.owned(key).query(`UPDATE curation_workflow_runs
   SET status='COMPLETE',updated_at=clock_timestamp() WHERE workflow_key=$1
   AND status IN ('PENDING','PARTIAL','RUNNING')`,[key]);
  if(result.rowCount!==1)throw Error("WORKFLOW_FINISH_REJECTED");
 }
 async release(key:string){
  const db=this.locks.get(key);if(!db)return;
  this.locks.delete(key);
  try{await db.query("SELECT pg_advisory_unlock(hashtext($1))",[key])}
  finally{db.release()}
 }
}
