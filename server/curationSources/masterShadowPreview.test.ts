import test from "node:test";
import assert from "node:assert/strict";
import {previewMerchantMasterShadow} from "./masterShadowPreview";
test("simulação Mestre com loja vazia não inventa identidade ou publicação",async()=>{
 const calls:Array<{sql:string;params:unknown[]|undefined}>=[];
 const db={query:async(sql:string,params?:unknown[])=>{
  calls.push({sql,params});return {rows:[]};
 }};
 const result=await previewMerchantMasterShadow(db,"17698",25);
 assert.equal(result.scanned,0);
 assert.equal(result.crossMerchantCandidates,0);
 assert.equal(result.published,0);
 assert.equal(result.merged,0);
 assert.equal(result.coverageLimited,true);
 assert.equal(result.mode,"READ_ONLY_SHADOW");
 assert.deepEqual(result.warnings,["NO_IDENTITIES"]);
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0].params,["17698",26]);
 assert.ok(!calls.some(c=>/\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i.test(c.sql)));
});
test("prévia Mestre bloqueia ID incorreto e processamento sem orçamento",async()=>{
 const db={query:async()=>({rows:[]})};
 await assert.rejects(previewMerchantMasterShadow(db,"17698;drop",10),/MERCHANT_ID_INVALID/);
 await assert.rejects(previewMerchantMasterShadow(db,"17698",101),/SHADOW_LIMIT_INVALID/);
 await assert.rejects(previewMerchantMasterShadow(db,"17698",1),/SHADOW_LIMIT_INVALID/);
});
