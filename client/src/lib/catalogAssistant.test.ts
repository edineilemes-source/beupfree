import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCatalogIntent, interpretCatalogRequest, catalogAssistantParams, catalogFilterLabels, assistantExplanation } from "./catalogAssistant";

test("interpreta corrida, marca, preço e tamanho com parâmetros reais",()=>{
 const r=interpretCatalogRequest("Quero tênis Adidas para correr até R$ 500 tamanho 41");
 assert.equal(r.mode,"new");
 assert.deepEqual(r.intent,{brand:"Adidas",activity:"Corrida",priceMax:500,size:41});
 const q=catalogAssistantParams(r.intent);
 assert.equal(q.get("marca"),"Adidas");
 assert.equal(q.get("modalidade"),"Corrida");
 assert.equal(q.get("priceMax"),"500");
 assert.equal(q.get("tamanho"),"41");
 assert.equal(q.get("sort"),"recommended");
 assert.equal(q.get("limit"),"6");
 assert.deepEqual(catalogFilterLabels(r.intent),["Marca: Adidas","Modalidade: Corrida","Preço máximo: R$ 500","Tamanho: 41"]);
});
test("refinamento só com preço e numeração mantém os outros filtros",()=>{
 const first=interpretCatalogRequest("Nike para caminhada");
 const next=interpretCatalogRequest("até 350 numeração 42",first.intent);
 assert.equal(next.mode,"refine");
 assert.deepEqual(next.intent,{brand:"Nike",activity:"Caminhada",priceMax:350,size:42});
 assert.deepEqual(parseCatalogIntent("até 350 numeração 42",first.intent),next.intent);
});
test("mudança de marca inicia consulta nova e remove filtros antigos",()=>{
 const before=interpretCatalogRequest("Adidas para corrida até R$ 500 tamanho 41").intent;
 const after=interpretCatalogRequest("Quero Nike para caminhada",before);
 assert.equal(after.mode,"new");
 assert.equal(catalogAssistantParams(after.intent).get("marca"),"Nike");
 assert.equal(catalogAssistantParams(after.intent).get("modalidade"),"Caminhada");
 assert.equal(catalogAssistantParams(after.intent).has("priceMax"),false);
 assert.equal(catalogAssistantParams(after.intent).has("tamanho"),false);
});
test("nova pergunta desconhecida não reutiliza filtros nem produz recomendações",()=>{
 const before=interpretCatalogRequest("Nike para corrida").intent;
 const after=interpretCatalogRequest("Quero muito amortecimento e maciez",before);
 assert.equal(after.recognized,false);
 assert.equal(after.mode,"new");
 assert.equal(catalogAssistantParams(after.intent).has("marca"),false);
 assert.equal(catalogAssistantParams(after.intent).has("modalidade"),false);
});
test("trilha bloqueada sem filtro operacional suportado",()=>{
 const after=interpretCatalogRequest("Nike para trilha");
 assert.equal(after.intent.activity,"Trilha");
 assert.ok(after.unsupported.length>0);
 assert.equal(catalogAssistantParams(after.intent).has("modalidade"),false);
});
test("explicações sem afirmação técnica inventada",()=>{
 assert.match(assistantExplanation({brand:"Adidas"},{mainName:"Modelo"}),/Classificação comercial/);
});

test("critério técnico usa ficha enriquecida e não herda marca ou preço anteriores",()=>{
 const before=interpretCatalogRequest("Adidas corrida até R$ 500 tamanho 41").intent;
 const after=interpretCatalogRequest("quero muito amortecimento e maciez",before);
 assert.equal(after.mode,"new");
 assert.deepEqual(after.intent,{brand:undefined,activity:undefined,priceMax:undefined,size:undefined,technical:["amortecimento","maciez"]});
 const params=catalogAssistantParams(after.intent);
 assert.equal(params.get("tecnica"),"amortecimento,maciez");
 assert.equal(params.has("marca"),false);
 assert.equal(params.has("priceMax"),false);
});
test("pesquisa por material e cabedal sinaliza filtros técnicos",()=>{
 const current=interpretCatalogRequest("Nike com cabedal e material confortável");
 assert.deepEqual(current.intent.technical,["conforto","cabedal","material"]);
 assert.equal(current.intent.brand,"Nike");
});
