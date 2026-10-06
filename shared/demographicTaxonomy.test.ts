import assert from "node:assert/strict";
import test from "node:test";
import {normalizeDemographics, titleDemographics, demographicSelection, type DemographicEvidence} from "./demographicTaxonomy";
const titleCases = [
 ["Tênis Masculino Adulto","MASCULINO","ADULTO"], ["Tênis Feminino Adulto","FEMININO","ADULTO"], ["Tênis Unissex Adulto","UNISSEX","ADULTO"],
 ["Tênis Masculino Infantil","MASCULINO","INFANTIL"], ["Tênis Feminino Infantil","FEMININO","INFANTIL"], ["Tênis Infantil Unissex","UNISSEX","INFANTIL"],
 ["Tênis Infantil",null,"INFANTIL"], ["Tênis Bebê",null,"BEBE"], ["Tênis Bebe Menina","FEMININO","BEBE"],
 ["Tênis Menino","MASCULINO","INFANTIL"], ["Tênis Menina","FEMININO","INFANTIL"], ["Tênis Kids",null,"INFANTIL"], ["Tênis Criança",null,"INFANTIL"],
 ["Tênis Juvenil",null,"INFANTIL"], ["Tênis para público Júnior",null,"INFANTIL"], ["Tênis público Junior",null,"INFANTIL"],
 ["Tênis Junior para Baby",null,"BEBE"], ["Tênis Baby para Junior",null,"INFANTIL"],
 ["Tênis X Jr",null,null], ["Tênis modelo Junior",null,null], ["Tênis Baby Modelo X",null,null], ["Tênis para Baby",null,"BEBE"],
 ["Tênis Modelo",null,null], ["Tênis Feminino","FEMININO",null], ["Tênis Masculino Feminino",null,null], ["Tênis Adulto Infantil",null,null],
 ["Tênis Unissex Feminino",null,null], ["Tênis Bebê Juvenil",null,null], ["Tênis Rosa Azul",null,null], ["Tênis Não Infantil",null,null], ["Tênis não é Infantil",null,null], ["Tênis não recomendado para Infantil",null,null],
 ["Tênis modelo Feminino",null,null], ["Tênis female women","FEMININO",null], ["Tênis kiddo",null,null],
] as const;
for(const [title,gender,ageGroup] of titleCases) test(`V4 título ${title}`,()=>{
 const result=titleDemographics(title);assert.equal(result.gender.value,gender);assert.equal(result.ageGroup.value,ageGroup);
});
test("V4 conflitos são ambíguos por eixo",()=>{
 const x=titleDemographics("Tênis masculino feminino infantil");assert.equal(x.gender.status,"AMBIGUOUS");assert.equal(x.ageGroup.value,"INFANTIL");
});
test("V4 estruturado > adapter > título independentemente",()=>{
 const x=normalizeDemographics([{raw:"FEMININO",field:"gender",source:"structured",axis:"gender"},{raw:"masculino infantil",field:"suitableFor",source:"adapter"},{raw:"Tênis Adulto Masculino",field:"title",source:"title"}]);
 assert.equal(x.gender.value,"FEMININO");assert.equal(x.ageGroup.value,"INFANTIL");assert.ok(x.gender.reasons.includes("LOWER_PRIORITY_CONFLICT"));
});
test("V4 conflito de mesma autoridade não é resolvido pelo título ou ordem",()=>{
 const e:DemographicEvidence[]=[{raw:"masculino",field:"g1",source:"structured",axis:"gender"},{raw:"feminino",field:"g2",source:"structured",axis:"gender"},{raw:"Tênis masculino adulto",field:"title",source:"title"}];
 const x=normalizeDemographics(e);assert.equal(x.gender.value,null);assert.equal(x.gender.status,"AMBIGUOUS");assert.equal(x.ageGroup.value,"ADULTO");assert.deepEqual(x,normalizeDemographics([...e].reverse()));
});
test("V4 unknown estruturado permite fallback, não cria Adulto",()=>{
 const x=normalizeDemographics([{raw:"UNKNOWN",field:"ageGroup",source:"structured",axis:"ageGroup"},{raw:"Tênis feminino",field:"title",source:"title"}]);assert.equal(x.ageGroup.value,null);assert.equal(x.ageGroup.status,"UNKNOWN");
});
test("V4 Baby/Jr etários em adapter e campo próprio; infantil não determina gênero",()=>{
 assert.equal(normalizeDemographics([{raw:"Jr",field:"age",axis:"ageGroup",source:"adapter"}]).ageGroup.value,"INFANTIL");
 const x=normalizeDemographics([{raw:"Baby",field:"suitableFor",source:"adapter"}]);assert.equal(x.ageGroup.value,"BEBE");assert.equal(x.gender.value,null);
});
test("V4 URLs aliases, repetições, inválidos e eixos não se cruzam",()=>{
 assert.deepEqual(demographicSelection("genero",["UNKNOWN,Masculino,infantil","UNISSEX,Masculino","invalid"]),["masculino","unissex"]);
 assert.deepEqual(demographicSelection("idade",["Adulto,Júnior,Bebê", "UNKNOWN,MASCULINO"]),["adulto","infantil","bebe"]);
 assert.deepEqual(demographicSelection("idade","UNKNOWN"),[]);
});
