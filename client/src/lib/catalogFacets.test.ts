import assert from "node:assert/strict";
import test from "node:test";
import {applyFilters, computeCrossFacets, computeFacets, EMPTY_FILTERS, preserveSelectedFacets, type CatalogProduct} from "./catalogFilters";
const product=(brand:string,size:number,color:string,price:number):CatalogProduct=>({id:`${brand}${size}`,mainName:`Tênis masculino corrida ${size} Br`,mainImageUrl:null,primaryColor:color,brand:{name:brand},category:null,averageRating:null,totalReviews:0,bestOffer:{currentPrice:String(price),originalPrice:null,discountPercent:35,affiliateUrl:"",freeShipping:false}});
const products=[product("Nike",40,"preto",179),product("Adidas",40,"branco",1499),product("Asics",41,"preto",400)];
test("base facets and brand disjunction respect size intersection",()=>{
 assert.equal(computeCrossFacets(products,EMPTY_FILTERS).brands.length,3);
 const f={...EMPTY_FILTERS,marca:["Nike"],tamanho:["40"]};
 assert.equal(applyFilters(products,f).length,1);
 assert.deepEqual(computeCrossFacets(products,f).brands.map(x=>x.label),["Nike","Adidas"]);
 assert.equal(applyFilters(products,{...f,marca:["Nike","Adidas"]}).length,2);
 assert.equal(applyFilters(products,{...f,marca:["Nike","Adidas"],cor:["preto","branco"]}).length,2);
});
test("price bounds ignore selected interval, retain other dimensions",()=>{
 const f={...EMPTY_FILTERS,tamanho:["40"],price:[300,500] as [number,number]};
 assert.equal(applyFilters(products,f).length,0); const facets=computeCrossFacets(products,f);
 assert.equal(facets.priceMin,179); assert.equal(facets.priceMax,1499); assert.deepEqual(f.price,[300,500]);
});
test("T22/T23 selected zero options retained; unselected zero omitted without mutating API",()=>{
 const raw={...computeFacets([]),brands:[{label:"unused",count:0}]};
 const f={...EMPTY_FILTERS,marca:["Nike"],cor:["preto"],tamanho:["40"],genero:["Masculino"],modalidade:["Corrida"]};
 const facets=preserveSelectedFacets(raw,f);
 assert.deepEqual(facets.brands,[{label:"Nike",count:0}]); assert.deepEqual(facets.colors,[{value:"preto",label:"Preto",count:0}]); assert.equal(facets.sizes[0].label,"40"); assert.equal(raw.brands[0].label,"unused");
 assert.equal(computeCrossFacets([],f).colors[0].value,"preto");
});

test("V3 family facets deduplicate shades, disjunction keeps other dimensions and selected zero",()=>{
 const rows=[product("Nike",40,"azul marinho/navy/azul",200),product("Nike",40,"preto denim",300),product("Adidas",41,"preto",150),product("Nike",40,"incolor",220)];
 const f={...EMPTY_FILTERS,marca:["Nike"],tamanho:["40"],cor:["azul"]};
 assert.deepEqual(applyFilters(rows,f).map(p=>p.primaryColor),["azul marinho/navy/azul"]);
 const facets=computeCrossFacets(rows,f);
 assert.deepEqual(facets.colors,[{value:"azul",label:"Azul",count:1},{value:"preto",label:"Preto",count:1}]);
 assert.equal(applyFilters(rows,{...f,cor:["azul","preto"]}).length,2);
 const zero=computeCrossFacets(rows,{...f,cor:["metalico"]});
 assert.deepEqual(zero.colors.find(c=>c.value==="metalico"),{value:"metalico",label:"Metálico",count:0});
 assert.deepEqual(computeFacets([{...rows[0],colorFamilyIds:[]}]).colors,[]);
});
