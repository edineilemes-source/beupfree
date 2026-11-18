/**
 * Curadoria V3 — contrato de etapas do Produto Mestre.
 * Esta camada NÃO substitui parser, matcher, candidatos, agrupamento nem persistência.
 * Valores de cobertura vêm das tabelas existentes e não certificam equivalência.
 */
import {VERSIONS} from "../productIdentity/contracts";
import {CATALOG_CLASSIFIER_VERSION,CATALOG_NORMALIZER_VERSION} from "../integrations/awin/operationalCatalog";
import {SEARCH_PROJECTION_VERSION} from "../catalogSearchProjection/builder";

export const CURATION_STAGES=[
 "RECEIVED","TRIAGED","MASTER_IDENTIFIED","COMMERCIAL_VALIDATED",
 "CLASSIFIED","VARIANTS_NORMALIZED","SEARCH_INDEXED","STORE_VISIBLE"
] as const;
export type CurationStage=(typeof CURATION_STAGES)[number];
export type StageStatus="DONE"|"PARTIAL"|"PENDING"|"NOT_VERIFIED";
export type CoverageCounts={
 offers:number;distinctProducts:number;activeOffers:number;identities:number|null;
 stagedIdentities:number|null;promotionEvidence:number|null;classifiedProducts:number|null;
 eligibleClassifications:number|null;normalizedVariants:number|null;
 totalVariants?:number|null;masterMemberships:number|null;masterIdentities:number|null;
 searchProducts:number|null;availableSearchProducts:number|null;
};
export type StageResult={stage:CurationStage;status:StageStatus;done:number|null;expected:number|null;reason:string};
const stage=(name:CurationStage,done:number|null,expected:number|null):StageResult=>{
 if(done===null||expected===null)return {stage:name,status:"NOT_VERIFIED",done,expected,reason:"DATA_NOT_VERIFIED"};
 if(expected===0)return {stage:name,status:"PENDING",done,expected,reason:"NO_ELIGIBLE_INPUT"};
 return {stage:name,status:done>=expected?"DONE":done>0?"PARTIAL":"PENDING",done,expected,
  reason:done>=expected?"COVERAGE_RECORDED":done>0?"COVERAGE_INCOMPLETE":"STAGE_NOT_EXECUTED"};
};
/**
 * Stages are independent coverage facts; they are NOT an automatic promotion gate.
 * A valid historical membership can still be stale according to readMaster().
 * A published offer must independently pass commercial policy.
 */
export function masterPipelineCoverage(c:CoverageCounts){
 const rows=[
  stage("RECEIVED",c.offers,c.offers||1),
  stage("TRIAGED",c.identities,c.distinctProducts),
  stage("MASTER_IDENTIFIED",c.masterMemberships,c.identities),
  stage("COMMERCIAL_VALIDATED",c.promotionEvidence,c.offers),
  stage("CLASSIFIED",c.classifiedProducts,c.distinctProducts),
  stage("VARIANTS_NORMALIZED",c.normalizedVariants,c.totalVariants??null),
  stage("SEARCH_INDEXED",c.searchProducts,c.eligibleClassifications),
  stage("STORE_VISIBLE",c.availableSearchProducts,c.searchProducts),
 ];
 const stages=Object.fromEntries(rows.map(r=>[r.stage,r])) as Record<CurationStage,StageResult>;
 return {stages,versions:{
  identity:{...VERSIONS},
  catalogClassifier:CATALOG_CLASSIFIER_VERSION,
  variantNormalizer:CATALOG_NORMALIZER_VERSION,
  searchProjection:SEARCH_PROJECTION_VERSION,
 },publicationApproved:false,
  note:"Relatório de cobertura não substitui a validação de equivalência, vigência do Produto Mestre ou de descontos. Nenhuma publicação é disparada pelo relatório."};
}
