import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCatalogIntent, catalogAssistantParams, assistantExplanation } from "./catalogAssistant";

test("interpreta busca de corrida, marca, preco e tamanho", () => {
 const intent=parseCatalogIntent("Quero tênis Adidas para correr até R$ 500 tamanho 41");
 assert.deepEqual(intent,{brand:"Adidas",activity:"Corrida",priceMax:500,size:41});
 const q=catalogAssistantParams(intent);
 assert.equal(q.get("marca"),"Adidas");
 assert.equal(q.get("modalidade"),"Corrida");
 assert.equal(q.get("priceMax"),"500");
 assert.equal(q.get("tamanho"),"41");
 assert.equal(q.get("sort"),"recommended");
 assert.equal(q.get("limit"),"6");
});
test("mantem preferencias entre mensagens",()=>{
 const first=parseCatalogIntent("Nike para caminhada");
 const next=parseCatalogIntent("até 350 numeração 42",first);
 assert.deepEqual(next,{brand:"Nike",activity:"Caminhada",priceMax:350,size:42});
});
test("nao inventa marca e nao chama sistemas externos",()=>{
 assert.deepEqual(parseCatalogIntent("ola"),{brand:undefined,activity:undefined,priceMax:undefined,size:undefined});
 assert.match(assistantExplanation({brand:"Adidas"},{mainName:"Modelo"}),/classificação do catálogo/);
});
