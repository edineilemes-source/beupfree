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

test("v3 confirma tipo de calçado sem exigir tênis na categoria",()=>{
 for(const name of ["Tênis Adidas Lite Racer 4.0","Tênis Olympikus Circuito","Tênis Asics Gel Excite 11","Tênis Adidas Runfalcon 5","Chuteira Adidas","Sapatênis","Sapatenis","Sneaker"]){
  for(const category of ["Calçados","Calçados > Casual","Calçados de treino","Calçados de corrida","Calçados de basquete","Fitness e Musculação","Artes Marciais","Calçados de automobilismo",""])
   assert.equal(classify(category,name).universe,"SNEAKER_CONFIRMED",`${category}: ${name}`);
 }
});
test("v3 bloqueia acessórios de tênis mesmo com categoria esportiva",()=>{
 for(const name of ["Bola de Tênis Wilson","Pack Bolas de Tênis","Faixa de Cabeça para Tênis","Raquete de Tênis","Bolsa para Tênis","Mochila para Tênis","Grip para Tênis","Overgrip para Tênis","Munhequeira para Tênis","Rede para Tênis","Corda para Tênis","Sapato social Democrata"])
  for(const category of ["Tênis","Tennis","Esportes > Tênis"])
   assert.equal(classify(category,name).universe,"NON_SNEAKER",`${category}: ${name}`);
});
test("v3 não confunde nomes de modelos com acessórios",()=>{
 for(const name of ["Tênis Fila Corda","Tênis Fila Grip 3"])
  assert.equal(classify("Calçados > Casual",name).universe,"SNEAKER_CONFIRMED");
});
test("v3 categoria de esporte não confirma sozinha um calçado",()=>{
 for(const category of ["Tênis","Tennis","Esportes > Tênis"])
  assert.notEqual(classify(category,"Produto Wilson").universe,"SNEAKER_CONFIRMED");
});
test("v3 preserva exclusões de outros calçados",()=>{
 for(const name of ["Chinelo","Sandália","Bota","Sapato social Democrata"])
  assert.equal(classify("Calçados",name).universe,"NON_SNEAKER");
});
test("v3 separa tênis confirmado dos requisitos comerciais obrigatórios",()=>{
 const taxonomy=classify("Fitness e Musculação","Tênis Adidas Lite Racer 4.0");
 assert.equal(taxonomy.universe,"SNEAKER_CONFIRMED");
 for(const requirement of ["promotionConfirmed","validCurrentPrice","validOldPrice","discountConsistent"] as const)
  assert.equal(classifyCatalogEligibility(taxonomy,{...commercial,[requirement]:false}).status,"REVIEW_REQUIRED",requirement);
});

test("v3 tipo explícito no nome prevalece sobre categoria de calçado incorreta",()=>{
 for(const name of ["Tênis New Balance 480 Low Marinho Com Branco","Tênis Mormaii Urban Pulse II Preto e Azul"]){
  const result=classify("Calçados > Chinelos e Sandálias",name);
  assert.equal(result.universe,"SNEAKER_CONFIRMED");
  assert.ok(result.reasons.includes("NEGATIVE_FOOTWEAR_SIGNAL"));
  assert.ok(!result.reasons.includes("CONFLICTING_SIGNALS"));
 }
});
test("v3 menção a chuteira em acessório não identifica calçado",()=>{
 for(const name of ["Porta Chuteira Adidas Tiro","Chaveiro Palmeiras Chuteira","Kit Caneta e Chaveiro Corinthians Chuteira"])
  assert.equal(classify("Artigos e acessórios",name).universe,"UNRESOLVED");
 assert.equal(classify("Esportes > Tênis","Kit 10 Packs de Bolas Tênis Wilson Championship").universe,"NON_SNEAKER");
});
