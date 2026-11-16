import test from "node:test";
import assert from "node:assert/strict";
import {evoSlPilotResult,EVO_SL_PILOT_SOURCES} from "./evoSlPilot";
test("piloto tem três domínios e não se apresenta como extração automática",async()=>{
 const result=await evoSlPilotResult();
 assert.equal(result.pilot,true);
 assert.equal(result.pipelineState,"ENRICHED");
 assert.equal(result.pipelineQueried,true);
 assert.equal(result.status,"PRE_EXTRACTED_NOT_LIVE");
 assert.equal(result.metrics.sourcePages,3);
 assert.equal(new Set(EVO_SL_PILOT_SOURCES.map(x=>new URL(x.url).hostname)).size,3);
 assert.ok(result.warnings.some(s=>s.includes("Não gravado")));
});
test("a ficha identifica atributos e conserva conflitos com evidências",()=>{
 const result=evoSlPilotResult();
 assert.ok(result.metrics.fields>=8);
 assert.ok(result.metrics.conflictingFields>=1);
 assert.equal(result.card.masterId,"pilot-evo-sl-not-a-commercial-master");
 const drop=result.card.fields.find(f=>f.field==="drop");
 assert.equal(drop?.value,"6 mm");
 assert.equal(drop?.status,"VERIFIED");
 assert.equal(drop?.sources.length,2);
 const cabedal=result.card.fields.find(f=>f.field==="cabedal");
 assert.equal(cabedal?.status,"CONFLICT");
 assert.ok(cabedal?.sources.every(s=>s.sourceUrl.startsWith("https://")));
});
