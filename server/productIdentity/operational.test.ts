import 'dotenv/config';
import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {persistIdentities,loadSources} from './operational';
import {readMaster} from './reader';
import {notifyIdentityAfterReconciliation,planIdentityBatches,processIdentityJob,acknowledgeIdentityEvents} from './jobs';
import {SQL} from '../../scripts/product-identity-real-shadow';
import {SQL as readerSQL} from './reconciledReader';
import {DafitiStagingRepository} from '../integrations/awin/dafitiStaging';
import {PostgresAwinRepository} from '../integrations/awin/repository';
const url=new URL(process.env.MASTER_DATABASE_URL!);
if(url.hostname!=='127.0.0.1'||url.port!=='5437'||url.pathname!=='/uppulse_missao8_test')throw Error('DISPOSABLE_DATABASE_REQUIRED');
const pool=new pg.Pool({connectionString:url.toString()});
const ids:string[]=[],productIds:string[]=[];let first:any,baseFingerprint:string;
const fingerprint=async()=>JSON.stringify((await pool.query(`SELECT
 (SELECT md5(string_agg(row_to_json(c)::text,'' ORDER BY c.product_id,c.merchant_id)) FROM catalog_search_products c) projection,
 (SELECT md5(string_agg(row_to_json(o)::text,'' ORDER BY o.id)) FROM offers o) offers`)).rows[0]);
before(async()=>{
 baseFingerprint=await fingerprint();
 await persistIdentities(pool,["15b771b6-613a-49cb-8f0e-6472a4b06b4d", "270f17de-43b0-488d-a215-c762cb5ac55e", "ea5fb22e-fabf-4068-8e5b-85a0e3ca5b36"]);
 const provider=randomUUID(),otherProvider=randomUUID(),brand=(await pool.query("SELECT id FROM brands WHERE name='Adidas'")).rows[0].id;
 for(const providerId of [provider,otherProvider])await pool.query(`INSERT INTO commerce_providers(id,code,name,provider_type) VALUES($1,$2,'Mission7 synthetic provider','affiliate_network')`,[providerId,'m7-'+providerId]);
 for(const [index,name] of ['Tênis Adidas Duramo SL Preto','Tênis Adidas Duramo SL Azul','Tênis Adidas Duramo SL 2 Preto','Tênis Adidas Duramo SL 3 Preto'].entries()){
  const originProvider=index===1?otherProvider:provider;
  const merchant=randomUUID(),product=randomUUID(),identity=randomUUID(),variant=randomUUID();
  await pool.query(`INSERT INTO commerce_merchants(id,provider_id,external_merchant_id,name) VALUES($1,$2,$3,'Mission7 fixture merchant')`,[merchant,originProvider,merchant]);
  await pool.query(`INSERT INTO products(id,main_name,slug,brand_id,catalog_status) VALUES($1,$2,$4,$3,'draft')`,[product,name,brand,product]);
  await pool.query(`INSERT INTO external_product_identities(id,product_id,provider_id,merchant_id,external_product_key,identity_method) VALUES($1,$2,$3,$4,$1,'fixture_parent_id')`,[identity,product,originProvider,merchant]);
  await pool.query(`INSERT INTO product_variants(id,product_id,provider_id,merchant_id,external_variant_key,size,colour) VALUES($1,$2,$3,$4,$1,'40',$5)`,[variant,product,originProvider,merchant,name.endsWith('Azul')?'Azul':'Preto']);
  ids.push(identity);productIds.push(product);
 }
 first=await persistIdentities(pool,ids);
});
after(async()=>{assert.equal(await fingerprint(),baseFingerprint,'No commercial prices, links, discounts or V4 projection changed');await pool.end();});
test('same Master across merchants, different observed variant; REVIEW and incompatible models remain separate',async()=>{
 const l=first.shadow.logical;assert.equal(l.providers.length,2);
 const key=(id:string)=>l.snapshots.find((s:any)=>s.externalIdentityId===id).key;
 const pair=(a:number,b:number)=>l.pairs.find((p:any)=>[p.left,p.right].includes(key(ids[a]))&&[p.left,p.right].includes(key(ids[b]))).result;
 assert.equal(pair(0,1).masterDecision,'AUTO_MATCH');assert.equal(pair(0,1).variantDecision,'NO_MATCH');
 assert.equal(pair(0,2).masterDecision,'REVIEW');assert.equal(pair(2,3).masterDecision,'NO_MATCH');
 const rows=(await pool.query('SELECT external_product_identity_id id,master_product_id master FROM product_master_memberships WHERE external_product_identity_id=ANY($1::text[]) AND valid_to IS NULL',[ids])).rows;
 const master=(id:string)=>rows.find(r=>r.id===id).master;
 assert.equal(master(ids[0]),master(ids[1]));assert.notEqual(master(ids[0]),master(ids[2]));assert.notEqual(master(ids[2]),master(ids[3]));
});
test('retry is idempotent; complete live group is mandatory; failed write leaves no run',async()=>{
 const repeat=await persistIdentities(pool,ids);assert.equal(repeat.runId,first.runId);assert.equal(repeat.reused,true);
 const count=Number((await pool.query('SELECT count(*) n FROM product_identity_runs')).rows[0].n);
 await assert.rejects(persistIdentities(pool,[ids[0]]),/EXISTING_MASTER_REQUIRES_ALL_MEMBERS/);
 assert.equal(Number((await pool.query('SELECT count(*) n FROM product_identity_runs')).rows[0].n),count);
});
test('audit cannot be overwritten or deleted; singleton has no fabricated confidence',async()=>{
 await assert.rejects(pool.query("UPDATE product_identity_decisions SET master_decision='AUTO_MATCH' WHERE run_id=$1",[first.runId]),/IDENTITY_HISTORY_IMMUTABLE/);
 await assert.rejects(pool.query('DELETE FROM product_identity_runs WHERE id=$1',[first.runId]),/IDENTITY_HISTORY_IMMUTABLE/);
 const singleton=(await pool.query(`SELECT * FROM product_master_memberships WHERE external_product_identity_id=$1 AND valid_to IS NULL`,[ids[3]])).rows[0];
 assert.equal(singleton.assignment_method,'SINGLETON');assert.equal(singleton.decision_id,null);
});
test('input drift reprocesses, closes old membership, reuses Master only with full current proof',async()=>{
 const original=(await pool.query('SELECT master_product_id id FROM product_master_memberships WHERE external_product_identity_id=$1 AND valid_to IS NULL',[ids[0]])).rows[0].id;
 await pool.query('UPDATE products SET updated_at=clock_timestamp() WHERE id=$1',[productIds[0]]);
 const next=await persistIdentities(pool,ids);assert.notEqual(next.runId,first.runId);
 const current=(await pool.query('SELECT master_product_id id FROM product_master_memberships WHERE external_product_identity_id=$1 AND valid_to IS NULL',[ids[0]])).rows[0].id;
 assert.equal(current,original);
 assert.equal(Number((await pool.query('SELECT count(*) n FROM product_master_memberships WHERE external_product_identity_id=$1',[ids[0]])).rows[0].n),2);
});
test('historical real groups have full proof and REVIEW is never a membership decision',async()=>{
 const bad=(await pool.query(`SELECT count(*) n FROM product_master_memberships m JOIN product_identity_decisions d ON d.id=m.decision_id WHERE m.assignment_method='AUTO_MATCH' AND d.master_decision<>'AUTO_MATCH'`)).rows[0].n;assert.equal(Number(bad),0);
 const product=(await pool.query(`SELECT min(e.product_id) id FROM product_master_memberships m JOIN external_product_identities e ON e.id=m.external_product_identity_id JOIN catalog_search_products c ON c.product_id=e.product_id AND c.merchant_id=e.merchant_id WHERE m.valid_to IS NULL GROUP BY m.master_product_id HAVING count(DISTINCT c.merchant_id)>1 ORDER BY 1 LIMIT 1`)).rows[0].id;
 const view=await readMaster(pool,product);assert.ok(view);assert.equal(view.master.canonicalName,null);assert.equal(view.skuEquivalence,false);
 assert.ok(new Set(view.offers.map(o=>o.merchant_id)).size>1);assert.equal(new Set(view.offers.map(o=>o.offer_id)).size,view.offers.length);
 for(const offer of view.offers){const original=(await pool.query(`SELECT o.affiliate_url,c.current_price,c.previous_price,c.discount_percent FROM offers o JOIN catalog_search_products c ON c.representative_offer_id=o.id WHERE o.id=$1`,[offer.offer_id])).rows[0];
  for(const field of ['affiliate_url','current_price','previous_price','discount_percent'])assert.equal(offer[field],original[field]);}
});
test('unpublished fixture never exposes identity or offers',async()=>{assert.equal(await readMaster(pool,productIds[0]),null);});
test('source drift hides entire enrichment without changing publication',async()=>{
 const db=await pool.connect();try{await db.query('BEGIN');
 const row=(await db.query(`SELECT c.product_id id FROM catalog_search_products c JOIN external_product_identities e ON e.product_id=c.product_id JOIN product_master_memberships m ON m.external_product_identity_id=e.id WHERE m.valid_to IS NULL LIMIT 1`)).rows[0];
 assert.ok(await readMaster(db as any,row.id));await db.query('SAVEPOINT before_drift');await db.query('UPDATE products SET main_name=main_name||$2 WHERE id=$1',[row.id,' changed']);
 assert.equal(await readMaster(db as any,row.id),null);
 await db.query('ROLLBACK TO SAVEPOINT before_drift');
 await db.query("UPDATE product_variants SET size=coalesce(size,'')||'__drift' WHERE product_id=$1",[row.id]);
 assert.equal(await readMaster(db as any,row.id),null);
 }finally{await db.query('ROLLBACK');db.release();}
});
test('batch planning covers every source once and keeps existing Masters together without identity inference',async()=>{
 const sources=await loadSources(pool,ids),membership=[{master_product_id:'master',external_product_identity_id:ids[0]},{master_product_id:'master',external_product_identity_id:ids[1]}];
 const batches=planIdentityBatches(sources,membership,3);assert.equal(new Set(batches.flat()).size,4);assert.ok(batches.every(b=>b.length<=3));assert.ok(batches.some(b=>b.includes(ids[0])&&b.includes(ids[1])));
 assert.throws(()=>planIdentityBatches(sources,membership,1),/EXISTING_MASTER_COHORT_LIMIT/);
});
test('simulated import queues only after COMMIT; queue failure preserves commercial success',async()=>{
 for(const fail of [false,true]){
 const calls:string[]=[];const fake:any={release(){},async query(sql:string){calls.push(sql);
  if(sql.includes('INSERT INTO product_identity_jobs')&&fail)throw Error('synthetic unavailable');
  if(sql.includes('RETURNING id')&&sql.includes('commerce_providers'))return{rows:[{id:'synthetic-provider'}]};
  if(sql.includes('WITH classified AS'))return{rows:[{created:0,updated:0,unchanged:0,changed:0}]};
  if(sql.startsWith('SELECT count(*)::int count FROM commerce_raw'))return{rows:[{count:0}]};
  return {rows:[],rowCount:0};}};
 const previous=process.env.MASTER_IDENTITY_ENABLED;process.env.MASTER_IDENTITY_ENABLED='true';
 try{const result=await new PostgresAwinRepository({connect:async()=>fake} as any).import([],{feedId:'simulated'});assert.equal(result.seen,0);
  assert.ok(calls.indexOf('COMMIT')<calls.findIndex(s=>s.includes('INSERT INTO product_identity_jobs')));assert.ok(!calls.includes('ROLLBACK'));
 }finally{if(previous===undefined)delete process.env.MASTER_IDENTITY_ENABLED;else process.env.MASTER_IDENTITY_ENABLED=previous;}
 }
});
test('generic post-reconciliation event is idempotent and provider independent',async()=>{
 const event={providerId:randomUUID(),feedId:randomUUID(),reconciledAt:new Date().toISOString()};
 assert.equal(await notifyIdentityAfterReconciliation(pool as any,event,true),'QUEUED');await notifyIdentityAfterReconciliation(pool as any,event,true);
 const count=(await pool.query("SELECT count(*) n FROM product_identity_jobs WHERE scope->>'providerId'=$1",[event.providerId])).rows[0].n;assert.equal(Number(count),1);
 assert.equal(await notifyIdentityAfterReconciliation({query:async()=>{throw Error('offline')}} as any,event,true),'ENQUEUE_FAILED');
});

test('simulated reconciliation worker persists, checkpoints and reuses an existing Master',async()=>{
 const event={providerId:randomUUID(),feedId:randomUUID(),reconciledAt:new Date().toISOString()};
 await notifyIdentityAfterReconciliation(pool as any,event,true);
 const job=(await pool.query("SELECT id FROM product_identity_jobs WHERE scope->>'providerId'=$1",[event.providerId])).rows[0].id;
 const scopedPool={connect:pool.connect.bind(pool),query:async(sql:string,params?:any[])=>{
  if(sql===SQL.sources)return {rows:await loadSources(pool,ids)};
  if(sql==='SELECT master_product_id,external_product_identity_id FROM product_master_memberships WHERE valid_to IS NULL')return pool.query(sql+' AND external_product_identity_id=ANY($1::text[])',[ids]);
  return pool.query(sql,params);
 }};
 const result=await processIdentityJob(scopedPool as any,job);
 assert.equal(result.completedBatches,1);assert.equal(result.universe,4);assert.equal(result.crossBatchPairs,'NOT_EVALUATED');
 const row=(await pool.query('SELECT status,result FROM product_identity_jobs WHERE id=$1',[job])).rows[0];assert.equal(row.status,'COMPLETE');
 const repeat=await processIdentityJob(scopedPool as any,job);assert.deepEqual(repeat,result);
});

test('operational reader preserves historical SQL exactly without importing the manual CLI',()=>{assert.deepEqual(readerSQL,SQL);});
test('Dafiti simulated unchanged batch notifies generic queue strictly after commercial commit',async()=>{
 const calls:string[]=[];const fake:any={release(){},async query(sql:string){calls.push(sql);
  if(sql.startsWith('SELECT r.identity_hash'))return {rows:[{identity_hash:'identity',content_hash:'content',feed_id:'feed-db'}]};
  return {rows:[],rowCount:0};}};
 const repository:any=new DafitiStagingRepository({connect:async()=>fake} as any);
 repository.providerId='another-provider';repository.merchantDbIds.set('merchant','merchant-db');repository.feedDbIds.set('feed','feed-db');
 const previous=process.env.MASTER_IDENTITY_ENABLED;process.env.MASTER_IDENTITY_ENABLED='true';
 try{const result=await repository.importBatch([{provenance:{merchantId:'merchant'},dafiti:{dataFeedId:'feed'},raw:{identityHash:'identity',contentHash:'content'}}],new Date());
  assert.equal(result.unchanged,1);assert.ok(calls.indexOf('COMMIT')<calls.findIndex(s=>s.includes('INSERT INTO product_identity_jobs')));
 }finally{if(previous===undefined)delete process.env.MASTER_IDENTITY_ENABLED;else process.env.MASTER_IDENTITY_ENABLED=previous;}
});

test('concurrent retries serialize before their snapshots and create only one new run',async()=>{
 await pool.query('UPDATE products SET updated_at=clock_timestamp() WHERE id=$1',[productIds[0]]);
 const results=await Promise.all([persistIdentities(pool,ids),persistIdentities(pool,ids)]);
 assert.equal(results[0].runId,results[1].runId);assert.equal(results.filter(r=>r.reused).length,1);
});

test('catalog persistence resumes interrupted tiles atomically, retries concurrently and processes a new reconciled identity',async()=>{
 const cache=new Map();const checkpoint={tileSize:1,load:async(k:string)=>cache.get(k)??null,save:async(k:string,v:any)=>{cache.set(k,v);}};
 const before=Number((await pool.query('SELECT count(*) n FROM product_identity_runs')).rows[0].n);
 await assert.rejects(persistIdentities(pool,ids,{}, {...checkpoint,progress:async(c:number)=>{if(c===2)throw Error('INTERRUPTED');}}),/INTERRUPTED/);
 assert.equal(Number((await pool.query('SELECT count(*) n FROM product_identity_runs')).rows[0].n),before);
 const results=await Promise.all([persistIdentities(pool,ids,{},checkpoint),persistIdentities(pool,ids,{},checkpoint)]);
 assert.equal(results[0].runId,results[1].runId);assert.equal(results.filter(r=>r.reused).length,1);
 const priorCache=cache.size,source=(await pool.query('SELECT * FROM external_product_identities WHERE id=$1',[ids[3]])).rows[0];
 const identity=randomUUID();await pool.query(`INSERT INTO external_product_identities(id,product_id,provider_id,merchant_id,external_product_key,identity_method) VALUES($1,$2,$3,$4,$1,'synthetic_incremental_test')`,[identity,source.product_id,source.provider_id,source.merchant_id]);
 const extended=await persistIdentities(pool,[...ids,identity],{},checkpoint);
 assert.notEqual(extended.runId,results[0].runId);assert.equal(extended.shadow.logical.identityCoverage.merchantProducts,5);assert.ok(cache.size>priorCache);
 assert.equal(Number((await pool.query('SELECT count(*) n FROM product_master_memberships WHERE external_product_identity_id=$1 AND valid_to IS NULL',[identity])).rows[0].n),1);
 const repeat=await persistIdentities(pool,[...ids,identity],{},checkpoint);assert.equal(repeat.reused,true);
});

test('durable scan acknowledges only pre-snapshot pending notifications after successful commit',async()=>{
 const event={providerId:randomUUID(),feedId:randomUUID(),reconciledAt:new Date().toISOString()};
 await notifyIdentityAfterReconciliation(pool as any,event,true);
 const cutoff=(await pool.query('SELECT clock_timestamp()::text cutoff')).rows[0].cutoff;
 const newer={...event,providerId:randomUUID()};await notifyIdentityAfterReconciliation(pool as any,newer,true);
 await acknowledgeIdentityEvents(pool as any,cutoff,first.runId);
 const states=(await pool.query("SELECT scope->>'providerId' provider,status,result FROM product_identity_jobs WHERE scope->>'providerId'=ANY($1::text[])",[[event.providerId,newer.providerId]])).rows;
 assert.equal(states.find(s=>s.provider===event.providerId).status,'COMPLETE');
 assert.equal(states.find(s=>s.provider===newer.providerId).status,'PENDING');
 assert.equal(states.find(s=>s.provider===event.providerId).result.deliveredBy,'RECONCILED_STATE_SCAN');
 await acknowledgeIdentityEvents(pool as any,cutoff,first.runId);
});
