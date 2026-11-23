/**
 * Read-only, bounded preview of the EXISTING Product Master comparison engine.
 * Neither parser/matcher nor grouping rules are duplicated or modified here.
 * A sample can never certify complete cross-merchant matching.
 */
import {loadSources,sourceInputs} from "../productIdentity/operational";
import {runShadow} from "../productIdentity/shadow";
import {VERSIONS} from "../productIdentity/contracts";
import {parseProductIdentity} from "../../shared/product-identity/parser";
import {sourceBrand} from "../productIdentity/reconciledReader";

type ReadClient={query(sql:string,values?:unknown[]):Promise<{rows:any[]}>};
export async function previewMerchantMasterShadow(
 db:ReadClient, merchantExternalId:string, limit=100
){
 if(!/^\d{2,12}$/.test(merchantExternalId))throw Error("MERCHANT_ID_INVALID");
 if(!Number.isSafeInteger(limit)||limit<2||limit>100)throw Error("SHADOW_LIMIT_INVALID");
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
  merchantExternalId,scanned:0,crossMerchantCandidates:0,limit,truncated:false,mode:"READ_ONLY_SHADOW" as const,
  versions:VERSIONS,coverageLimited:true,conclusions:"NO_SOURCE_IDENTITIES",
  stats:null,groups:[],reviewPairs:[],warnings:["NO_IDENTITIES"],
  published:0,merged:0
 };
 const merchantSources=await loadSources(db as any,ids);
 if(merchantSources.length!==ids.length)throw Error("SHADOW_SOURCES_INCOMPLETE");
 // Give the original matcher actual cross-store candidates, restricted to
 // independently parsed brands. A bounded sample is never a global match gate.
 const brands=[...new Set(merchantSources.map(source=>{
  const name=sourceBrand(source);
  return parseProductIdentity({name:source.name,brand:name}).brand;
 }).filter((brand):brand is string=>typeof brand==="string"&&/^[a-z0-9 .-]{2,60}$/.test(brand)))].slice(0,20);
 const other=brands.length?(await db.query(`
  SELECT e.id FROM external_product_identities e
  JOIN commerce_merchants m ON m.id=e.merchant_id
  JOIN products p ON p.id=e.product_id
  LEFT JOIN brands b ON b.id=p.brand_id
  WHERE m.external_merchant_id<>$1 AND (
    lower(b.name)=ANY($2::text[]) OR EXISTS (
      SELECT 1 FROM unnest($2::text[]) brand
      WHERE position(brand in lower(p.main_name))>0
    )
  )
  ORDER BY e.id LIMIT $3`,[merchantExternalId,brands,limit])).rows.map(r=>String(r.id)):[];
 const otherSources=other.length?await loadSources(db as any,other):[];
 if(otherSources.length!==other.length)throw Error("CROSS_MERCHANT_SOURCES_INCOMPLETE");
 const sources=[...merchantSources,...otherSources];
 const inputs=await sourceInputs(db as any,sources);
 const output=runShadow(inputs);
 const report=output.logical;
 return {
  merchantExternalId,scanned:ids.length,crossMerchantCandidates:otherSources.length,limit,truncated,
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
   ...(otherSources.length===0?["NO_CROSS_MERCHANT_CANDIDATES_IN_SAMPLE"]:[]),
   ...(truncated?["SOURCE_SAMPLE_TRUNCATED"]:[]),
   ...(report.coverageLimited?["MATCHER_RETRIEVAL_LIMITED"]:[])
  ],
  published:0,merged:0
 };
}
