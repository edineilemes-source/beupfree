/**
 * Read-only, bounded preview of the EXISTING Product Master comparison engine.
 * Neither parser/matcher nor grouping rules are duplicated or modified here.
 * A sample can never certify complete cross-merchant matching.
 */
import {loadSources,sourceInputs} from "../productIdentity/operational";
import {runShadow} from "../productIdentity/shadow";
import {VERSIONS} from "../productIdentity/contracts";

type ReadClient={query(sql:string,values?:unknown[]):Promise<{rows:any[]}>};
export async function previewMerchantMasterShadow(
 db:ReadClient, merchantExternalId:string, limit=100
){
 if(!/^\d{2,12}$/.test(merchantExternalId))throw Error("MERCHANT_ID_INVALID");
 if(!Number.isSafeInteger(limit)||limit<2||limit>200)throw Error("SHADOW_LIMIT_INVALID");
 // Select a bounded sample from the merchant. This is not the entire identity
 // universe and cannot be used as a merge or publication decision.
 const result=await db.query(`
  SELECT e.id FROM external_product_identities e
  JOIN commerce_merchants m ON m.id=e.merchant_id
  WHERE m.external_merchant_id=$1
  ORDER BY e.id LIMIT $2`,[merchantExternalId,limit+1]);
 const identities=result.rows.map(r=>String(r.id));
 const truncated=identities.length>limit;
 const ids=identities.slice(0,limit);
 if(ids.length===0)return {
  merchantExternalId,scanned:0,limit,truncated:false,mode:"READ_ONLY_SHADOW" as const,
  versions:VERSIONS,coverageLimited:true,conclusions:"NO_SOURCE_IDENTITIES",
  stats:null,groups:[],reviewPairs:[],warnings:["NO_IDENTITIES"],
  published:0,merged:0
 };
 const sources=await loadSources(db as any,ids);
 if(sources.length!==ids.length)throw Error("SHADOW_SOURCES_INCOMPLETE");
 const inputs=await sourceInputs(db as any,sources);
 const output=runShadow(inputs);
 const report=output.logical;
 return {
  merchantExternalId,scanned:ids.length,limit,truncated,
  mode:"READ_ONLY_SHADOW" as const,versions:VERSIONS,
  // Even when all merchant identities fit, other stores may contain
  // matching products not in the inspected sample.
  coverageLimited:true,
  conclusions:"SAMPLE_ONLY_NOT_COMPLETE_PRODUCT_MASTER" as const,
  stats:report.identityCoverage,
  groups:report.groups.slice(0,30).map(g=>({members:g.members.length})),
  reviewPairs:report.pairs.filter(p=>p.result.masterDecision==="REVIEW").slice(0,30).map(p=>({
   left:p.left,right:p.right,reasons:p.result.reasons,
   decision:p.result.masterDecision
  })),
  warnings:[
   "CROSS_MERCHANT_UNIVERSE_NOT_VERIFIED",
   ...(truncated?["SOURCE_SAMPLE_TRUNCATED"]:[]),
   ...(report.coverageLimited?["MATCHER_RETRIEVAL_LIMITED"]:[])
  ],
  published:0,merged:0
 };
}
