import test from "node:test";
import assert from "node:assert/strict";
import {planCurationWorkflow,CURATION_STAGE_ORDER} from "./curationOrchestrator";
const base={offers:5167,distinctProducts:813,activeOffers:0,identities:813,stagedIdentities:813,
 promotionEvidence:0,classifiedProducts:0,eligibleClassifications:0,
 normalizedVariants:0,totalVariants:5167,masterMemberships:0,masterIdentities:0,
 searchProducts:0,availableSearchProducts:0};
test("nova loja recebe plano completo sem inventar publicação",()=>{
 const result=planCurationWorkflow("17698","51837",base);
 assert.equal(result.nextAction,"PROCESS_PRODUCT_MASTER");
 assert.equal(result.publicationAuthorized,false);
 assert.equal(result.noSideEffects,true);
 assert.equal(result.executeMode,"READ_ONLY_PREFLIGHT");
 assert.equal(Object.keys(result.stages).length,CURATION_STAGE_ORDER.length);
 assert.ok(result.blockers.includes("INCOMPLETE_MASTER_COVERAGE"));
 assert.ok(result.blockers.includes("INCOMPLETE_COMMERCIAL_EVIDENCE"));
 assert.ok(result.blockers.includes("INCOMPLETE_CLASSIFICATION"));
 assert.ok(result.blockers.includes("INCOMPLETE_NORMALIZATION"));
 assert.ok(result.blockers.includes("CATALOG_PROJECTION_NOT_VERIFIED"));
});
test("falta de feed começa na ingestão",()=>{
 const report=planCurationWorkflow("17698",null,{...base,offers:0,distinctProducts:0,identities:0});
 assert.equal(report.nextAction,"IMPORT_FEED");
 assert.equal(report.publicationAuthorized,false);
});
test("cobertura total nunca equivale à autorização comercial",()=>{
 const plan=planCurationWorkflow("17698","51837",{...base,masterMemberships:813,promotionEvidence:5167,
  classifiedProducts:813,eligibleClassifications:813,normalizedVariants:5167,
  searchProducts:813,availableSearchProducts:813});
 assert.equal(plan.nextAction,"VERIFY_STORE_VISIBILITY");
 assert.equal(plan.readyToRequestPublication,true);
 assert.deepEqual(plan.blockers,["PUBLICATION_NOT_APPROVED"]);
 assert.equal(plan.publicationAuthorized,false);
});
test("contagens ausentes bloqueiam, sem lançar workers",()=>{
 const plan=planCurationWorkflow("17698","51837",{...base,totalVariants:null,searchProducts:null});
 assert.ok(plan.blockers.includes("INCOMPLETE_NORMALIZATION"));
 assert.ok(plan.blockers.includes("CATALOG_PROJECTION_NOT_VERIFIED"));
 assert.equal(plan.executeMode,"READ_ONLY_PREFLIGHT");
});
test("identificadores estranhos são recusados",()=>{
 assert.throws(()=>planCurationWorkflow("17698;DELETE",null,base),/MERCHANT_ID_INVALID/);
 assert.throws(()=>planCurationWorkflow("17698","feed/1",base),/FEED_ID_INVALID/);
});
