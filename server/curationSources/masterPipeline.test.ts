import test from "node:test";
import assert from "node:assert/strict";
import {masterPipelineCoverage,CURATION_STAGES} from "./masterPipeline";
import {VERSIONS} from "../productIdentity/contracts";
const counts={
 offers:5167,distinctProducts:813,activeOffers:0,identities:813,stagedIdentities:813,
 promotionEvidence:0,classifiedProducts:0,eligibleClassifications:0,
 normalizedVariants:0,totalVariants:5167,masterMemberships:0,masterIdentities:0,
 searchProducts:0,availableSearchProducts:0
};
test("Curadoria preserva as versões reais do parser/matcher do Produto Mestre",()=>{
 const report=masterPipelineCoverage(counts);
 assert.deepEqual(report.versions.identity,VERSIONS);
 assert.deepEqual(Object.keys(report.stages),[...CURATION_STAGES]);
 assert.equal(report.publicationApproved,false);
});
test("não confunde 5167 ofertas recebidas com produto master, promoção nem publicação",()=>{
 const report=masterPipelineCoverage(counts).stages;
 assert.equal(report.RECEIVED.status,"DONE");
 assert.equal(report.MASTER_IDENTIFIED.status,"PENDING");
 assert.equal(report.COMMERCIAL_VALIDATED.status,"PENDING");
 assert.equal(report.VARIANTS_NORMALIZED.status,"PENDING");
 assert.equal(report.STORE_VISIBLE.status,"PENDING");
});
test("cobertura parcial jamais significa homologação completa",()=>{
 const report=masterPipelineCoverage({...counts,masterMemberships:100,classifiedProducts:700,
  promotionEvidence:5000,normalizedVariants:4000,eligibleClassifications:700,
  searchProducts:500,availableSearchProducts:300}).stages;
 assert.equal(report.MASTER_IDENTIFIED.status,"PARTIAL");
 assert.equal(report.CLASSIFIED.status,"PARTIAL");
 assert.equal(report.COMMERCIAL_VALIDATED.status,"PARTIAL");
 assert.equal(report.VARIANTS_NORMALIZED.status,"PARTIAL");
 assert.equal(report.SEARCH_INDEXED.status,"PARTIAL");
 assert.equal(report.STORE_VISIBLE.status,"PARTIAL");
});
test("sem tabela de variantes verificada, relatório não inventa cobertura",()=>{
 const report=masterPipelineCoverage({...counts,totalVariants:null,normalizedVariants:100});
 assert.equal(report.stages.VARIANTS_NORMALIZED.status,"NOT_VERIFIED");
 assert.equal(report.publicationApproved,false);
});
