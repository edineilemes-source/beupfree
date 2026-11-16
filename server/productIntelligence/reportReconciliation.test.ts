import test from "node:test";
import assert from "node:assert/strict";
import {reconcileLiveReport} from "./reportReconciliation";
const a="https://believeintherun.com/evo",b="https://www.alastairrunning.com/evo",c="https://www.doctorsofrunning.com/evo";
const make=(field:string,values:Array<[string,string]>)=>({field,sources:values.map(([url,value])=>({url,value,observedAt:"2026-11-16"}))});
test("real V2 measurements keep two partial majorities and never auto-approve the conflicting third",()=>{
 const report={fields:[
  make("drop",[[a,"6 mm"],[b,"6mm"],[c,"6.5 mm"]]),
  make("altura_do_solado",[[a,"38 mm in heel, 32 mm in forefoot"],[b,"38mm heel / 32mm forefoot"],[c,"37 mm heel / 30.5 mm forefoot"]]),
  make("peso",[[a,"7.9 oz (224 g) for a US M9, 6.6 oz (188 g) for a US W7.5"],[b,"8.3oz / 235g"],[c,"8.1 oz, 230 g (men’s size 9), 7.2 oz, 204 g (women’s size 8)"]]),
  make("tecnologia",[[a,"Lightstrike Pro midsole, Continental rubber outsole"],[c,"Lightstrike Pro midsole with midfoot nylon shank"]]),
 ]};
 const resolved=reconcileLiveReport(report);
 assert.equal(resolved.metrics.verified,0);
 assert.equal(resolved.metrics.conflicts,4);
 assert.equal(resolved.metrics.conflictsWithMajority,2);
 const drop=resolved.fields.find(f=>f.field==="drop")!;
 assert.deepEqual(drop.agreements.map(a=>a.count),[2,1]);
 const stack=resolved.fields.find(f=>f.field==="altura_do_solado")!;
 assert.deepEqual(stack.agreements.map(a=>a.count),[2,1]);
 assert.equal(resolved.fields.find(f=>f.field==="peso")?.agreements.length,3);
 assert.equal(resolved.fields.find(f=>f.field==="tecnologia")?.agreements.length,2);
});
