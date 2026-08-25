import test from "node:test";
import assert from "node:assert/strict";
import { assessSize, classifyCatalogEligibility, classifyProductTaxonomy } from "./productTaxonomy";

const classify = (merchantCategory:string, name:string, description="", brand="Unknown") => classifyProductTaxonomy({merchantCategory,name,description,brand});
const commercial = {promotionConfirmed:true,validCurrentPrice:true,validOldPrice:true,discountConsistent:true,imageAvailable:true,brandAvailable:true,affiliateAvailable:true,inStock:true,identitySufficient:true};

test("separa universo, style e activity para tênis explícito",()=>{
  const result=classify("Tênis","Tênis urbano em couro");
  assert.equal(result.universe,"SNEAKER_CONFIRMED"); assert.equal(result.style,"LIFESTYLE"); assert.deepEqual(result.activities,["GENERAL"]); assert.equal(result.confidence,"HIGH");
});
test("classifica running, caminhada, treino, trail e múltiplas activities",()=>{
  assert.deepEqual(classify("Tênis Running","Tênis para corrida").activities,["RUNNING"]);
  assert.deepEqual(classify("Tênis Caminhada","Tênis walking").activities,["WALKING"]);
  assert.deepEqual(classify("Tênis Training","Tênis academia").activities,["TRAINING"]);
  assert.deepEqual(classify("Tênis Trail Running","Tênis trilha").activities,["TRAIL","RUNNING"]);
});
test("classifica futebol, futsal, basquete, tennis/court, vôlei e skate",()=>{
  assert.deepEqual(classify("Tênis","Chuteira futebol").activities,["FOOTBALL"]);
  assert.deepEqual(classify("Tênis Futsal","Tênis").activities,["FUTSAL"]);
  assert.deepEqual(classify("Tênis Basquete","Tênis basketball").activities,["BASKETBALL"]);
  assert.deepEqual(classify("Tênis de quadra","Tênis tennis court").activities,["TENNIS_COURT"]);
  assert.deepEqual(classify("Tênis Vôlei","Tênis volleyball").activities,["VOLLEYBALL"]);
  assert.deepEqual(classify("Tênis Skate","Tênis sk8").activities,["SKATE"]);
});
test("distingue performance, sportswear, lifestyle e hybrid",()=>{
  assert.equal(classify("Tênis Performance","Tênis").style,"PERFORMANCE");
  assert.equal(classify("Tênis Sportswear","Tênis").style,"SPORTSWEAR");
  assert.equal(classify("Tênis","Sapatênis casual").style,"LIFESTYLE");
  assert.equal(classify("Tênis Performance","Tênis casual").style,"HYBRID");
});
test("rejeita produto claramente não tênis e revisa sinais conflitantes",()=>{
  assert.equal(classify("Tênis","Sandália papete infantil").universe,"NON_SNEAKER");
  assert.equal(classify("Tênis performance","Mochila NBA").universe,"NON_SNEAKER");
  assert.equal(classify("Tênis performance","Kit de calções esportivos").universe,"NON_SNEAKER");
  const conflict=classify("Tênis","Kit Tênis e Sandália"); assert.equal(conflict.universe,"SNEAKER_PROBABLE"); assert.ok(conflict.reasons.includes("CONFLICTING_SIGNALS"));
});
test("não usa marca como identidade e aceita marca desconhecida com evidência forte",()=>{
  assert.equal(classifyProductTaxonomy({brand:"Nike",name:"Produto X"}).universe,"UNRESOLVED");
  assert.equal(classifyProductTaxonomy({brand:"Marca Nunca Vista",merchantCategory:"Tênis",name:"Tênis X"}).universe,"SNEAKER_CONFIRMED");
});
test("description é complementar e não transforma sozinha camiseta em tênis",()=>{
  const result=classify("Camiseta","Camiseta","ideal para corrida"); assert.equal(result.universe,"NON_SNEAKER"); assert.deepEqual(result.activities,["RUNNING"]);
});
test("elegibilidade é independente de activity e desconto baixo",()=>{
  const taxonomy=classify("Tênis","Tênis lifestyle"); assert.equal(classifyCatalogEligibility(taxonomy,commercial).status,"IN_SCOPE_CONFIRMED");
  assert.equal(classifyCatalogEligibility(taxonomy,{...commercial,imageAvailable:false}).status,"REVIEW_REQUIRED");
  assert.equal(classifyCatalogEligibility(classify("Tênis","Sandália"),commercial).status,"OUT_OF_SCOPE_CONFIRMED");
});
test("tamanho suspeito preserva contexto infantil, fracionário, único e roupa",()=>{
  assert.deepEqual(assessSize("10","Infantil"),{suspicious:false,reason:"SIZE_CHILD_NUMERIC_PLAUSIBLE"});
  assert.deepEqual(assessSize("40 1/2"),{suspicious:false,reason:"SIZE_FRACTIONAL_PLAUSIBLE"});
  assert.equal(assessSize("único").reason,"SIZE_UNIQUE_REVIEW"); assert.equal(assessSize("EG").reason,"SIZE_APPAREL_SIGNAL");
});
test("regressão: modalidades existentes continuam representáveis",()=>{
  for(const [text,activity] of [["Running","RUNNING"],["Futebol","FOOTBALL"],["Futsal","FUTSAL"],["Basquete","BASKETBALL"],["Caminhada","WALKING"],["Training","TRAINING"],["Skate","SKATE"]] as const)
    assert.ok(classify(`Tênis ${text}`,"Tênis").activities.includes(activity));
});
