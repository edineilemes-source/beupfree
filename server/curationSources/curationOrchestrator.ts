/**
 * Curadoria V3: pure, deterministic execution planning for existing modules.
 * No duplicate parser, matcher, classifier, or catalogue projection.
 * This is a safety/interlock contract; persistence workers remain separate.
 */
import {CURATION_STAGES,masterPipelineCoverage,type CoverageCounts,type CurationStage} from "./masterPipeline";

export type CurationNextAction =
 | "IMPORT_FEED" | "PROCESS_PRODUCT_MASTER" | "CHECK_PRICE_EVIDENCE"
 | "CLASSIFY_PRODUCTS" | "NORMALIZE_VARIANTS"
 | "BUILD_SEARCH_PROJECTION" | "VERIFY_STORE_VISIBILITY"
 | "NONE";
export type BlockerCode=
 | "NO_RECEIVED_PRODUCTS" | "INCOMPLETE_MASTER_COVERAGE" | "INCOMPLETE_COMMERCIAL_EVIDENCE"
 | "INCOMPLETE_CLASSIFICATION" | "INCOMPLETE_NORMALIZATION"
 | "CATALOG_PROJECTION_NOT_VERIFIED" | "PUBLICATION_NOT_APPROVED";
export type PipelinePlan={
 merchantId:string;feedId:string|null;workflowVersion:"curadoria-v3-plan-v1";
 stages:ReturnType<typeof masterPipelineCoverage>["stages"];
 nextAction:CurationNextAction;blockers:BlockerCode[];
 readyToRequestPublication:boolean;publicationAuthorized:boolean;
 executeMode:"READ_ONLY_PREFLIGHT";noSideEffects:true;
};
const toNumber=(value:number|null|undefined)=>value??0;
export function planCurationWorkflow(
 merchantId:string,feedId:string|null,counts:CoverageCounts
):PipelinePlan{
 if(!/^[0-9]{2,12}$/.test(merchantId))throw Error("MERCHANT_ID_INVALID");
 if(feedId!==null&&!/^[0-9]{2,12}$/.test(feedId))throw Error("FEED_ID_INVALID");
 const stages=masterPipelineCoverage(counts).stages;
 const blockers:BlockerCode[]=[];
 const identities=toNumber(counts.identities);
 const variants=counts.totalVariants;
 let nextAction:CurationNextAction="NONE";
 if(counts.offers<1||counts.distinctProducts<1){
  nextAction="IMPORT_FEED";blockers.push("NO_RECEIVED_PRODUCTS");
 }else{
  if(identities<counts.distinctProducts||toNumber(counts.masterMemberships)<identities){
   blockers.push("INCOMPLETE_MASTER_COVERAGE");nextAction="PROCESS_PRODUCT_MASTER";
  }
  if(toNumber(counts.promotionEvidence)<counts.offers){
   blockers.push("INCOMPLETE_COMMERCIAL_EVIDENCE");
   if(nextAction==="NONE")nextAction="CHECK_PRICE_EVIDENCE";
  }
  if(toNumber(counts.classifiedProducts)<counts.distinctProducts){
   blockers.push("INCOMPLETE_CLASSIFICATION");
   if(nextAction==="NONE")nextAction="CLASSIFY_PRODUCTS";
  }
  if(variants===undefined||variants===null||toNumber(counts.normalizedVariants)<variants){
   blockers.push("INCOMPLETE_NORMALIZATION");
   if(nextAction==="NONE")nextAction="NORMALIZE_VARIANTS";
  }
  if(counts.searchProducts===null||counts.availableSearchProducts===null
    ||counts.searchProducts===0||counts.availableSearchProducts===0){
   blockers.push("CATALOG_PROJECTION_NOT_VERIFIED");
   if(nextAction==="NONE")nextAction="BUILD_SEARCH_PROJECTION";
  }else if(nextAction==="NONE")nextAction="VERIFY_STORE_VISIBILITY";
 }
 // Coverage alone must never trigger publication: freshness, link, identity and
 // business eligibility need separate per-record verifications in the actual workers.
 blockers.push("PUBLICATION_NOT_APPROVED");
 return {merchantId,feedId,workflowVersion:"curadoria-v3-plan-v1",stages,
  nextAction,blockers,readyToRequestPublication:blockers.length===1&&blockers[0]==="PUBLICATION_NOT_APPROVED",
  publicationAuthorized:false,executeMode:"READ_ONLY_PREFLIGHT",noSideEffects:true};
}
export const CURATION_STAGE_ORDER:readonly CurationStage[]=CURATION_STAGES;
