import {randomUUID} from 'node:crypto';
import type {Pool,QueryResult} from 'pg';
type Queryable={query(text:string,values?:unknown[]):Promise<QueryResult<any>>};
import {digest, VERSIONS} from './contracts';
import {loadSources,persistIdentities} from './operational';
import {sourceBrand,type Source} from './reconciledReader';
import {parseProductIdentity} from '../../shared/product-identity/parser';
export type ReconciliationEvent={providerId:string;feedId:string;reconciledAt:string};
export async function enqueueIdentity(db:Queryable,event:ReconciliationEvent){
 const key=digest({event,versions:VERSIONS});
 await db.query(`INSERT INTO product_identity_jobs(id,event_key,scope) VALUES($1,$2,$3) ON CONFLICT(event_key) DO NOTHING`,[randomUUID(),key,event]);
}
/** Must be called only after commercial commit. Failure never changes import success. */
export async function notifyIdentityAfterReconciliation(db:Queryable,event:ReconciliationEvent,enabled:boolean){
 if(!enabled)return 'DISABLED';
 try{await enqueueIdentity(db,event);return 'QUEUED';}catch{return 'ENQUEUE_FAILED';}
}
/** Cohorts are processing units only; never identity decisions. Keep all existing live Master members together. */
export function planIdentityBatches(sources:Source[], memberships:Array<{master_product_id:string;external_product_identity_id:string}>,limit=2000){
 if(!Number.isInteger(limit)||limit<1||limit>2000)throw Error('INVALID_BATCH_LIMIT');
 const byId=new Map(sources.map(s=>[s.id,s]));
 const masterById=new Map(memberships.map(m=>[m.external_product_identity_id,m.master_product_id]));
 const units=new Map<string,Source[]>();
 for(const source of [...sources].sort((a,b)=>a.id.localeCompare(b.id))){
  const unit=masterById.get(source.id)??source.id;
  const rows=units.get(unit)??[];rows.push(source);units.set(unit,rows);
 }
 if(memberships.some(m=>!byId.has(m.external_product_identity_id)))throw Error('INCOMPLETE_SOURCE_UNIVERSE');
 const ordered=[...units.values()].sort((a,b)=>{
  const brand=(s:Source)=>parseProductIdentity({name:s.name,brand:sourceBrand(s)}).brand??'';
  return brand(a[0]).localeCompare(brand(b[0]))||a[0].id.localeCompare(b[0].id);
 });
 const batches:string[][]=[];
 for(const unit of ordered){if(unit.length>limit)throw Error('EXISTING_MASTER_COHORT_LIMIT');
  if(!batches.length||batches[batches.length-1].length+unit.length>limit)batches.push([]);
  batches[batches.length-1].push(...unit.map(s=>s.id));
 }
 return batches;
}
/** Explicit bounded worker: no imports or network calls. Retry resumes versioned batches. */
export async function processIdentityJob(pool:Pool,jobId:string,maxBatches=1){
 if(!Number.isInteger(maxBatches)||maxBatches<1)throw Error('INVALID_BATCH_BUDGET');
 const job=(await pool.query('SELECT * FROM product_identity_jobs WHERE id=$1',[jobId])).rows[0];
 if(!job)throw Error('IDENTITY_JOB_NOT_FOUND');
 if(job.status==='COMPLETE')return job.result;
 try{
  const sources=await loadSources(pool as any);
  const live=(await pool.query('SELECT master_product_id,external_product_identity_id FROM product_master_memberships WHERE valid_to IS NULL')).rows;
  const batches:string[][]=job.result?.batches??planIdentityBatches(sources,live);
  const planHash=digest({ids:batches,versions:VERSIONS});
  const previous=job.result?.planHash===planHash?job.result.completedBatches??0:0;
  await pool.query("UPDATE product_identity_jobs SET status='PARTIAL',result=$2 WHERE id=$1",[jobId,{...job.result,batches,planHash,completedBatches:previous}]);
  const runs:string[]=job.result?.planHash===planHash?job.result.runs??[]:[];
  let completed=previous;
  for(;completed<batches.length&&completed<previous+maxBatches;completed++){
   const result=await persistIdentities(pool,batches[completed]);runs.push(result.runId);
   await pool.query("UPDATE product_identity_jobs SET status='PARTIAL',result=$2 WHERE id=$1",[jobId,{batches,planHash,completedBatches:completed+1,runs}]);
  }
  const summary={batches,planHash,completedBatches:completed,totalBatches:batches.length,universe:sources.length,runs,
   coverageLimited:true,crossBatchPairs:'NOT_EVALUATED',note:'All inputs processed does not mean all pairs evaluated; historical top-K/budgets preserved.'};
  await pool.query('UPDATE product_identity_jobs SET status=$2,result=$3 WHERE id=$1',[jobId,completed===batches.length?'COMPLETE':'PARTIAL',summary]);
  return summary;
 }catch(error){await pool.query("UPDATE product_identity_jobs SET status='FAILED',result=COALESCE(result,'{}'::jsonb)||$2::jsonb WHERE id=$1",[jobId,{code:'IDENTITY_JOB_FAILED'}]);throw error;}
}

/** A successful full snapshot can acknowledge older notifications even if their
 * original enqueue delivery was delayed. New events stay pending for the next scan.
 * Call only after the sidecar transaction commits. Retrying is harmless.
 */
export async function acknowledgeIdentityEvents(db:Queryable,cutoff:string,runId:string){
 return db.query(`UPDATE product_identity_jobs SET status='COMPLETE',result=COALESCE(result,'{}'::jsonb)||$2::jsonb
  WHERE status='PENDING' AND scope ? 'providerId' AND created_at <= $1::timestamptz`,
  [cutoff,{deliveredBy:'RECONCILED_STATE_SCAN',runId,versions:VERSIONS}]);
}
