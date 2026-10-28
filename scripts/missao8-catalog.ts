import 'dotenv/config';
import pg from 'pg';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {loadSources,persistIdentities} from '../server/productIdentity/operational';
import {digest} from '../server/productIdentity/contracts';
import {acknowledgeIdentityEvents} from '../server/productIdentity/jobs';
import {randomUUID} from 'node:crypto';
const url=new URL(process.env.MASTER_DATABASE_URL!);
if(url.hostname!=='127.0.0.1'||url.port!=='5437'||url.pathname!=='/uppulse_missao8')throw Error('ISOLATED_DATABASE_REQUIRED');
const pool=new pg.Pool({connectionString:url.toString(),options:'-c enable_mergejoin=off -c work_mem=128MB'});
const dir='/tmp/uppulse-missao8-checkpoints';await mkdir(dir,{recursive:true,mode:0o700});
let locked=false;
const lease=await pool.connect();
try{
 locked=(await lease.query('SELECT pg_try_advisory_lock(771050019) acquired')).rows[0].acquired;
 if(!locked)throw Error('CATALOG_WORKER_ALREADY_RUNNING');
 // Durable level-triggered reconciliation: reads current reconciled rows even when enqueue failed.
 // Repeated scans reuse unchanged tile inputs; commercial import has no dependency on this worker.
 const cutoff=(await pool.query('SELECT clock_timestamp()::text cutoff')).rows[0].cutoff;
 const sources=(await pool.query(`SELECT e.id,p.updated_at::text "updatedAt",e.last_seen_at::text "lastSeenAt" FROM external_product_identities e JOIN products p ON p.id=e.product_id ORDER BY e.id`)).rows,ids=sources.map(s=>s.id);
 const eventKey=digest({scheduler:'missao8',sources:sources.map(s=>[s.id,s.updatedAt,s.lastSeenAt])});
 const job=(await pool.query(`INSERT INTO product_identity_jobs(id,event_key,scope) VALUES($1,$2,$3) ON CONFLICT(event_key) DO UPDATE SET scope=EXCLUDED.scope RETURNING id`,[randomUUID(),eventKey,{kind:'FULL_RECONCILIATION_SCAN',universe:ids.length}])).rows[0];
 await pool.query("UPDATE product_identity_jobs SET status='PARTIAL' WHERE id=$1",[job.id]);
 try{
 const result=await persistIdentities(pool,ids,{}, {
  async load(key){try{return JSON.parse(await readFile(`${dir}/${key}.json`,'utf8'));}catch(e:any){if(e.code==='ENOENT')return null;throw e;}},
  async save(key,tile){const target=`${dir}/${key}.json`,temp=`${target}.${process.pid}.tmp`;await writeFile(temp,JSON.stringify(tile),{mode:0o600});await rename(temp,target);},
  async progress(cursor,total){await pool.query("UPDATE product_identity_jobs SET result=$2 WHERE id=$1",[job.id,{cursor,total,versions:'missao8-tiles-v1',universe:ids.length}]);console.log('tile',cursor,'/',total);}
 });
 await acknowledgeIdentityEvents(pool as any,cutoff,result.runId);
 const summary={runId:result.runId,reused:result.reused,coverage:result.shadow.logical.identityCoverage,catalog:(result.shadow as any).catalog};
 await pool.query("UPDATE product_identity_jobs SET status='COMPLETE',result=$2 WHERE id=$1",[job.id,summary]);
 await writeFile('../catalog-result.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 }catch(error){await pool.query("UPDATE product_identity_jobs SET status='FAILED',result=coalesce(result,'{}')||'{\"error\":\"CATALOG_RUN_FAILED\"}'::jsonb WHERE id=$1",[job.id]);throw error;}
}finally{if(locked)await lease.query('SELECT pg_advisory_unlock(771050019)');lease.release();await pool.end();}
