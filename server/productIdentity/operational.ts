/** Operational sidecar. The historical parser, matcher, retrieval and grouping are unchanged. */
import {randomUUID} from 'node:crypto';
import type {Pool, PoolClient} from 'pg';
import {adaptReconciledRows, type ReconciledRow} from './adapter';
import {canonical, digest, pairKey, snapshot, type MerchantProduct} from './contracts';
import {runShadow} from './shadow';
import {runCatalogShadow, type CatalogCheckpoint} from './catalog';
import type {Config} from './candidates';
import {SQL, sourceBrand, type Source} from './reconciledReader';

type Queryable=Pick<PoolClient,'query'>;
export const CATALOG_REVISION='missao8-catalog-tiles-v1';
export const CODE_REVISION='missao7-sidecar-v2;engine:ebc66532aa7dec9644e7cf12764c2bd92ad199bb';
export async function loadSources(db:Queryable, ids?:string[]):Promise<Source[]> {
 const sql=ids ? SQL.sources.replace('ORDER BY e.id','WHERE e.id=ANY($1::text[]) ORDER BY e.id') : SQL.sources;
 return (await db.query(sql,ids?[ids]:[])).rows;
}
export async function sourceInputs(db:Queryable,sources:Source[]):Promise<MerchantProduct[]> {
 if(sources.length>2000)throw Error('SHADOW_INPUT_LIMIT');
 const feeds=(await db.query(SQL.feeds,[[...new Set(sources.map(s=>s.feedId).filter(Boolean))]])).rows;
 const variants=(await db.query(SQL.variants,[[...new Set(sources.map(s=>s.productId))]])).rows;
 const iso=(v:any)=>v==null?null:new Date(v).toISOString();
 const rows:ReconciledRow[]=sources.map(s=>({
  product:{id:s.productId,mainName:s.name,brandId:s.brandId,updatedAt:iso(s.updatedAt)},
  identity:{id:s.id,productId:s.productId,providerId:s.providerId,merchantId:s.merchantId,feedId:s.feedId,externalProductKey:s.externalProductKey,provenanceMethod:s.provenanceMethod,lastSeenAt:iso(s.lastSeenAt)},
  provider:{id:s.providerId},merchant:{id:s.merchantId,providerId:s.providerId},feed:s.feedId?feeds.find(f=>f.id===s.feedId):null,
  brand:s.brandId&&s.brandName?{id:s.brandId,name:s.brandName}:null,
  variants:variants.filter(v=>v.productId===s.productId&&v.providerId===s.providerId&&v.merchantId===s.merchantId).map(v=>({...v,updatedAt:iso(v.updatedAt),lastSeenAt:iso(v.lastSeenAt)})),
 }));
 const inputs=adaptReconciledRows(rows), byId=new Map(sources.map(s=>[s.id,s]));
 // Same local raw-brand fallback as the approved real shadow runner. No fabricated brands.id.
 for(const input of inputs){const s=byId.get(input.externalIdentityId)!;if(!input.input.brand&&sourceBrand(s)) input.input.brand=sourceBrand(s);}
 return inputs;
}

export async function persistIdentities(pool:Pick<Pool,'connect'>, ids:string[], options:Partial<Config>={}, catalog?:CatalogCheckpoint) {
 if(new Set(ids).size!==ids.length||(!catalog&&ids.length>2000)||!ids.length)throw Error('INVALID_IDENTITY_COHORT');
 const db=await pool.connect();let locked=false;
 try{
  // Acquire before the snapshot so concurrent retries can observe the previous commit.
  // Session lock is always released; no locks/writes on commercial entities.
  await db.query("SELECT pg_advisory_lock(771050018)");locked=true;
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
  const sources=await loadSources(db,ids);
  if(sources.length!==ids.length)throw Error('SOURCE_NOT_FOUND');
  const products=[];
  for(let offset=0;offset<sources.length;offset+=2000)products.push(...await sourceInputs(db,sources.slice(offset,offset+2000)));
  const shadow=catalog?await runCatalogShadow(products,catalog):runShadow(products,options), l=shadow.logical;
  const revision=catalog?CATALOG_REVISION:CODE_REVISION;
  const logicalHash=digest(l), key=digest({runKey:l.runKey,snapshots:l.snapshots,sourceRevisions:sources.map(s=>[s.id,s.updatedAt,s.lastSeenAt,s.rawBrandCount]),codeRevision:revision});
  const previous=(await db.query('SELECT id,logical_hash FROM product_identity_runs WHERE idempotency_key=$1',[key])).rows[0];
  if(previous){
   if(previous.logical_hash!==logicalHash)throw Error('DIVERGENT_IDEMPOTENT_RUN');
   const live=(await db.query('SELECT run_id FROM product_master_memberships WHERE external_product_identity_id=ANY($1::text[]) AND valid_to IS NULL',[ids])).rows;
   if(live.length!==ids.length||live.some(m=>m.run_id!==previous.id))throw Error('HISTORICAL_RUN_REPLAY_REQUIRES_NEW_REVISION');
   await db.query('COMMIT');return {runId:previous.id,reused:true,shadow};
  }
  const active=(await db.query(`SELECT m.* FROM product_master_memberships m WHERE valid_to IS NULL AND master_product_id IN
    (SELECT master_product_id FROM product_master_memberships WHERE valid_to IS NULL AND external_product_identity_id=ANY($1::text[])) FOR UPDATE`,[ids])).rows;
  // Never merge into an existing Master by representative/signature/transitive evidence.
  if(active.some(m=>!ids.includes(m.external_product_identity_id)))throw Error('EXISTING_MASTER_REQUIRES_ALL_MEMBERS');
  const runId=randomUUID();
  const sourceById=new Map(sources.map(s=>[s.id,s]));
  const sourceEvidence=new Map(sources.map(s=>[s.id,{brand:sourceBrand(s),rawBrandCount:s.rawBrandCount,
   source:s.brandName?.trim()?'brands.name':sourceBrand(s)?'commerce_raw_feed_items.raw_payload.brand_name via same provider/merchant/feed, one distinct value':'NONE'}]));
  await db.query(`INSERT INTO product_identity_runs(id,idempotency_key,versions,code_revision,config,input_manifest,coverage,logical_hash,status)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,'COMPLETE')`,[runId,key,l.versions,revision,l.config,JSON.stringify(l.snapshots),{...l.identityCoverage,coverageLimited:l.coverageLimited,unevaluatedPairs:l.unevaluatedPairs,withoutCandidate:l.withoutCandidate,groupConflicts:l.groupConflicts,...(catalog?{catalog:(shadow as any).catalog}: {})},logicalHash]);
  const byKey=new Map(l.snapshots.map(s=>[s.key,s])), parses=new Map(l.parses.map(p=>[p.key,p.parsed]));
  const decisions=new Map<string,string>();
  for(const pair of l.pairs){
   let left=byKey.get(pair.left)!,right=byKey.get(pair.right)!;
   if(left.externalIdentityId>right.externalIdentityId)[left,right]=[right,left];
   const decisionId=randomUUID();decisions.set(pair.key,decisionId);
   await db.query(`INSERT INTO product_identity_decisions(id,run_id,comparison_key,left_external_identity_id,right_external_identity_id,
    left_variant_id,right_variant_id,master_decision,variant_decision,master_confidence,variant_confidence,evidence)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [decisionId,runId,digest({ids:[left.externalIdentityId,right.externalIdentityId],inputs:[left.inputHash,right.inputHash],scopes:[left.scope,right.scope]}),left.externalIdentityId,right.externalIdentityId,
     left.scope.kind==='SELECTED_VARIANT'?left.scope.variantId:null,right.scope.kind==='SELECTED_VARIANT'?right.scope.variantId:null,
     pair.result.masterDecision,pair.result.variantDecision,pair.result.masterConfidence,pair.result.variantConfidence,
     {left,right,leftParse:parses.get(left.key),rightParse:parses.get(right.key),result:pair.result,purpose:pair.purpose,leftBrandEvidence:sourceEvidence.get(left.externalIdentityId),rightBrandEvidence:sourceEvidence.get(right.externalIdentityId)}]);
  }
  const proofByKey=new Map(l.pairs.map(p=>[p.key,p]));
  const assigned=new Set<string>();
  for(const group of l.groups){
   const members=group.members.map(k=>byKey.get(k)!);
   for(let a=0;a<members.length;a++)for(let b=a+1;b<members.length;b++){
    const pair=proofByKey.get(pairKey(members[a].key,members[b].key));
    if(pair?.result.masterDecision!=='AUTO_MATCH')throw Error('INCOMPLETE_GROUP_PROOF');
   }
   // Reuse an existing Master only if its entire live member set stays together.
   const reusable=[...new Set(active.filter(m=>members.some(s=>s.externalIdentityId===m.external_product_identity_id)).map(m=>m.master_product_id))]
    .filter(id=>!assigned.has(id)&&active.filter(m=>m.master_product_id===id).every(m=>members.some(s=>s.externalIdentityId===m.external_product_identity_id))).sort();
   const parsed=parses.get(members[0].key)!;
   let reuseId:string|undefined;
   for(const id of reusable){const old=(await db.query('SELECT attribute_evidence FROM master_products WHERE id=$1',[id])).rows[0];
    if(canonical(old.attribute_evidence.master)===canonical(parsed.master)){reuseId=id;break;}
   }
   const masterId=reuseId??randomUUID();assigned.add(masterId);
   if(!reuseId){
    await db.query(`INSERT INTO master_products(id,canonical_name,brand_normalized,product_type,model_tokens,generation,technical_qualifiers,attribute_evidence)
     VALUES($1,NULL,$2,$3,$4,$5,$6,$7)`,[masterId,parsed.master.brand,parsed.master.productType,JSON.stringify(parsed.master.modelTokens),parsed.master.version,JSON.stringify(parsed.master.technicalQualifiers),{source:'historical-parser',parserVersion:l.versions.parser,sourceIdentity:members[0].externalIdentityId,master:parsed.master,canonicalNameStatus:'HISTORICAL_RULE_NOT_LOCATED'}]);
   }
   for(const member of members){
    await db.query(`UPDATE product_master_memberships SET valid_to=GREATEST(clock_timestamp(),valid_from+interval '1 microsecond') WHERE external_product_identity_id=$1 AND valid_to IS NULL`,[member.externalIdentityId]);
    const partner=members.find(s=>s.key!==member.key), decisionId=partner?decisions.get(pairKey(member.key,partner.key)):null;
    await db.query(`INSERT INTO product_master_memberships(id,external_product_identity_id,master_product_id,run_id,decision_id,assignment_method,input_hash,evidence)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[randomUUID(),member.externalIdentityId,masterId,runId,decisionId,partner?'AUTO_MATCH':'SINGLETON',member.inputHash,{group:group.members,completePairCheck:true,groupingVersion:l.versions.grouping,scope:member.scope,snapshot:member,sourceRevision:{productUpdatedAt:sourceById.get(member.externalIdentityId)!.updatedAt,identityLastSeenAt:sourceById.get(member.externalIdentityId)!.lastSeenAt},brandEvidence:sourceEvidence.get(member.externalIdentityId),notSkuEquivalence:true}]);
   }
  }
  await db.query('COMMIT');
  return {runId,reused:false,shadow};
 }catch(error){await db.query('ROLLBACK');throw error;}finally{
  let releaseError:Error|undefined;
  if(locked)try{await db.query('SELECT pg_advisory_unlock(771050018)');}catch{releaseError=new Error('IDENTITY_UNLOCK_FAILED');}
  db.release(releaseError);
 }

}
