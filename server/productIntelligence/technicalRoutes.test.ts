import {test} from "node:test";
import assert from "node:assert/strict";
import {TECHNICAL_TERMS,technicalTermPredicate} from "./technicalRoutes";
test("consulta campo técnico parametrizado, nunca concatena descrição de usuário no SQL",()=>{
 assert.equal(technicalTermPredicate("drop","$2"),"f->>'field' = $2");
 assert.equal(technicalTermPredicate("amortecimento","$3"),"f->>'field' = $3");
 assert.equal(technicalTermPredicate("maciez","$4"),"lower(coalesce(f->>'value','')) LIKE $4");
 assert.equal(Object.keys(TECHNICAL_TERMS).length,7);
});
