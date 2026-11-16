import test from "node:test";
import assert from "node:assert/strict";
import {brazilianTechnicalText} from "./technicalPresentation";
import {createSuperCatalogCard} from "./superCatalog";
import {createCustomerKnowledge} from "./customerKnowledge";
test("translates actual V2 running shoe vocabulary without changing source evidence",()=>{
 const cases:[string,string,string][]=[
  ["amortecimento","thick layer of Lightstrike Pro","Camada espessa de espuma Lightstrike Pro"],
  ["cabedal","Lightweight engineered mesh with strategic two-ply reinforcement and Adidas three-stripe overlays","Mesh técnico leve, com reforços estratégicos de duas camadas e sobreposições das três listras da Adidas"],
  ["entressola","Full-length Lightstrike Pro superfoam with a stiff composite/nylon midfoot shank","Espuma Lightstrike Pro em toda a entressola, com reforço rígido de compósito/nylon na região central"],
  ["indicacao_de_uso","Daily training, long runs, uptempo","Treinos diários, corridas longas e treinos em ritmo acelerado"],
  ["indicacao_de_uso","Performance Lightweight Trainer/Racer","Tênis leve de desempenho para treinos e competições"],
  ["material","engineered mesh","Mesh técnico"],
  ["material","synthetic and textile upper","Cabedal de materiais sintéticos e têxteis"],
  ["solado","Continental rubber at the forefoot with clear rubber at the heel","Borracha Continental na parte dianteira e borracha transparente no calcanhar"],
  ["tecnologia","Lightstrike Pro midsole with midfoot nylon shank","Entressola Lightstrike Pro com reforço de nylon na região central do pé"],
  ["tecnologia","Lightstrike Pro midsole, Continental rubber outsole","Entressola Lightstrike Pro e solado de borracha Continental"],
 ];
 for(const [field,value,translated] of cases)assert.equal(brazilianTechnicalText(field,value),translated,field);
});
test("weights show grams and keep separate male and female reference sizes",()=>{
 assert.equal(brazilianTechnicalText("peso","7.9 oz (224 g) for a US M9, 6.6 oz (188 g) for a US W7.5"),
  "224 g (masculino, tamanho US 9); 188 g (feminino, tamanho US 7,5)");
 assert.equal(brazilianTechnicalText("peso","8.3oz / 235g"),"235 g (numeração não informada na evidência)");
 assert.equal(brazilianTechnicalText("peso","8.1 oz, 230 g (men’s size 9), 7.2 oz, 204 g (women’s size 8)"),
  "230 g (masculino, tamanho US 9); 204 g (feminino, tamanho US 8)");
 assert.equal(brazilianTechnicalText("peso","8.1 oz"),"229,6 g");
 assert.equal(brazilianTechnicalText("peso","1 kg"),"1 kg");
});
test("metric measurements convert inches to mm and retain different drops",()=>{
 assert.equal(brazilianTechnicalText("drop","0.23 in"),"5,8 mm");
 assert.equal(brazilianTechnicalText("altura_do_solado","Heel: 1.49 in / Forefoot: 1.25 in"),
 "Calcanhar 37,8 mm / antepé 31,8 mm");
 const evidence=[
  {field:"drop",value:"6 mm",sourceUrl:"https://a.example",sourceType:"RETAILER" as const,observedAt:"2026-11-16"},
  {field:"drop",value:"6.5 mm",sourceUrl:"https://b.example",sourceType:"RETAILER" as const,observedAt:"2026-11-16"},
 ];
 const card=createSuperCatalogCard({masterId:"test",brand:"Adidas",model:"Evo SL"},evidence);
 assert.equal(createCustomerKnowledge(card.fields).fields.find(f=>f.field==="drop")?.summary,"6 mm ou 6,5 mm");
 assert.equal(card.fields.find(f=>f.field==="drop")?.sources[1].value,"6.5 mm");
});
test("unrecognized product claims are preserved rather than guessed",()=>{
 assert.equal(brazilianTechnicalText("material","HyperFlux X prototype fabric"),"HyperFlux X prototype fabric");
});
