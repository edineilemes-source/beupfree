/** Audit selected origin variants in the disposable snapshot; no writes or SKU consolidation. */
import 'dotenv/config';
import pg from 'pg';
import {writeFileSync} from 'node:fs';
import {loadSources} from '../server/productIdentity/operational';
import {SQL,sourceBrand} from '../server/productIdentity/reconciledReader';
import {adaptReconciledRows,type ReconciledRow} from '../server/productIdentity/adapter';
import {parseProductIdentity} from '../shared/product-identity/parser';
import {matchProductIdentities} from '../shared/product-identity/matcher';
const url=new URL(process.env.MASTER_DATABASE_URL!);if(url.port!=='5436'||url.pathname!=='/uppulse_missao7')throw Error('DISPOSABLE_DATABASE_REQUIRED');
const pool=new pg.Pool({connectionString:url.toString(),options:'-c default_transaction_read_only=on',statement_timeout:30000});
try{
 const sources=await loadSources(pool),feeds=(await pool.query('SELECT id,provider_id "providerId",merchant_id "merchantId" FROM commerce_feeds')).rows;
 const variants=(await pool.query(SQL.variants,[[...new Set(sources.map(s=>s.productId))]])).rows;
 const proposed=(await pool.query(`WITH normalized AS MATERIALIZED (
   SELECT id,merchant_id,coalesce(nullif(gtin,''),nullif(ean,''),nullif(upc,'')) identifier FROM product_variants
 ), bounded AS (
   SELECT identifier FROM normalized WHERE identifier IS NOT NULL GROUP BY identifier
   HAVING count(DISTINCT merchant_id)>1 AND count(*) BETWEEN 2 AND 8 ORDER BY identifier LIMIT 50
 ) SELECT a.id left_id,b.id right_id,a.identifier FROM bounded g JOIN normalized a USING(identifier)
   JOIN normalized b ON b.identifier=g.identifier AND a.id<b.id AND a.merchant_id<>b.merchant_id
   ORDER BY a.id,b.id LIMIT 50`)).rows;
 const samples:any[]=[];const iso=(v:any)=>v==null?null:new Date(v).toISOString();
 for(const pair of proposed){
  const selected=[pair.left_id,pair.right_id].map(id=>variants.find(v=>v.id===id));
  const rows:ReconciledRow[]=[],observations:any[]=[];
  for(const variant of selected){
   const origins=sources.filter(s=>s.productId===variant.productId&&s.providerId===variant.providerId&&s.merchantId===variant.merchantId);
   if(origins.length!==1)break;const s=origins[0];
   rows.push({product:{id:s.productId,mainName:s.name,brandId:s.brandId,updatedAt:iso(s.updatedAt)},
    identity:{id:s.id,productId:s.productId,providerId:s.providerId,merchantId:s.merchantId,feedId:s.feedId,externalProductKey:s.externalProductKey,lastSeenAt:iso(s.lastSeenAt)},
    provider:{id:s.providerId},merchant:{id:s.merchantId,providerId:s.providerId},feed:s.feedId?feeds.find(f=>f.id===s.feedId):null,
    brand:s.brandId&&s.brandName?{id:s.brandId,name:s.brandName}:null,
    variants:variants.filter(v=>v.productId===s.productId&&v.providerId===s.providerId&&v.merchantId===s.merchantId).map(v=>({...v,updatedAt:iso(v.updatedAt),lastSeenAt:iso(v.lastSeenAt)})),selectedVariantId:variant.id});
   observations.push({identityId:s.id,variantId:variant.id,title:s.name,size:variant.size,colour:variant.colour,merchantId:s.merchantId,brand:sourceBrand(s)});
  }
  if(rows.length!==2){samples.push({pair,status:'NOT_EVALUATED',reason:'AMBIGUOUS_ORIGIN'});continue;}
  const inputs=adaptReconciledRows(rows);
  for(const input of inputs){if(!input.input.brand){const s=sources.find(s=>s.id===input.externalIdentityId)!;if(sourceBrand(s))input.input.brand=sourceBrand(s);}}
  const parsed=inputs.map(i=>parseProductIdentity(i.input)),result=matchProductIdentities(parsed[0],parsed[1]);
  samples.push({pair,scope:'SELECTED_VARIANT',observations,inputs:inputs.map(i=>({scope:i.scope,input:i.input})),parsed,result,
   limitations:['No structured size system was available; sizes remain observations, not compared size identities.','Observed structured colour is preserved by adapter but only title colour enters the historical parser.','No SKU equivalence inferred; no memberships or commercial records written.']});
 }
 const evaluated=samples.filter(s=>s.result),counts=(axis:string)=>Object.fromEntries(['AUTO_MATCH','REVIEW','NO_MATCH'].map(decision=>[decision,evaluated.filter(s=>s.result[axis]===decision).length]));
 writeFileSync('../real-variant-audit.json',JSON.stringify({sampleCriterion:'At most 50 pairs from raw identifiers shared across merchants in groups of 2-8 variants; bounded sampling only, validated by unchanged parser/matcher',pairs:proposed.length,NOT_EVALUATED:samples.length-evaluated.length,master:counts('masterDecision'),variant:counts('variantDecision'),skuEquivalence:'NOT_ESTABLISHED',samples},null,2));
 console.log('Audited',evaluated.length,'selected real variant pairs');
}finally{await pool.end();}
