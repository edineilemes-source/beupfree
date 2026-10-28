import 'dotenv/config';
import pg from 'pg';
import {readFileSync,writeFileSync} from 'node:fs';
import {persistIdentities} from '../server/productIdentity/operational';
const url=new URL(process.env.MASTER_DATABASE_URL!);
if(url.hostname!=='127.0.0.1'||url.port!=='5436'||url.pathname!=='/uppulse_missao7')throw Error('DISPOSABLE_DATABASE_REQUIRED');
const pool=new pg.Pool({connectionString:url.toString()});
try{
 const real=JSON.parse(readFileSync('../real-shadow-v15.json','utf8'));
 const ids=real.shadow.logical.snapshots.map((s:any)=>s.externalIdentityId);
 const before=(await pool.query(`SELECT md5(string_agg(row_to_json(c)::text,'' ORDER BY c.product_id,c.merchant_id)) hash FROM catalog_search_products c`)).rows[0];
 const result=await persistIdentities(pool,ids);
 writeFileSync('../persisted-run.json',JSON.stringify({runId:result.runId,reused:result.reused,versions:result.shadow.logical.versions,coverage:result.shadow.logical.identityCoverage,coverageLimited:result.shadow.logical.coverageLimited,sameOriginalManifest:real.shadow.logical.inputManifestHash===result.shadow.logical.inputManifestHash,commercialProjectionBefore:before},null,2));
 console.log('persisted',result.runId,result.shadow.logical.identityCoverage);
}finally{await pool.end();}
