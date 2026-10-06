import assert from "node:assert/strict";
import test from "node:test";
import {applyFilters, computeCrossFacets, computeFacets, preserveSelectedFacets, EMPTY_FILTERS, genderOf,ageOf,type CatalogProduct} from "./catalogFilters";
import {filtersFromSearch,toggleFilterSearch,catalogRequestParams,catalogScope,catalogPage} from "./catalogState";
import {toComparableProduct} from "./comparisonProductAdapter";
const product=(id:string,name:string):CatalogProduct=>({id,mainName:name,mainImageUrl:null,primaryColor:"azul",brand:{name:"Nike"},category:null,averageRating:null,totalReviews:0,bestOffer:{currentPrice:"200",originalPrice:"300",discountPercent:33,affiliateUrl:"",freeShipping:false}});
const rows=[product("a","Tênis Feminino Adulto"),product("b","Tênis Feminino Infantil"),product("c","Tênis Masculino Infantil"),product("d","Tênis Unissex Bebê"),product("e","Tênis Modelo")];
test("V4 AND gênero/idade; OR dentro de cada eixo; unknown não corresponde",()=>{
 assert.deepEqual(applyFilters(rows,{...EMPTY_FILTERS,genero:["feminino"],idade:["infantil"]}).map(x=>x.id),["b"]);
 assert.deepEqual(applyFilters(rows,{...EMPTY_FILTERS,genero:["masculino","unissex"],idade:["infantil","bebe"]}).map(x=>x.id),["c","d"]);
 assert.equal(applyFilters(rows,{...EMPTY_FILTERS,idade:["adulto"]}).length,1);
 assert.equal(ageOf(rows[4]),null);assert.equal(genderOf(rows[4]),null);
});
test("V4 facets disjuntivas usam universos independentes",()=>{
 const f={...EMPTY_FILTERS,genero:["feminino"],idade:["infantil"]};const facets=computeCrossFacets(rows,f);
 assert.deepEqual(facets.generos.map(x=>[x.value,x.count]),[["masculino",1],["feminino",1],["unissex",0]]);
 assert.deepEqual(facets.idades.map(x=>[x.value,x.count]),[["adulto",1],["infantil",1],["bebe",0]]);
 assert.ok(!JSON.stringify(facets).includes("UNKNOWN"));
});
test("V4 selected-zero permanece removível por ID, label Bebê",()=>{
 const f={...EMPTY_FILTERS,genero:["unissex"],idade:["adulto","bebe"]};const facets=preserveSelectedFacets(computeCrossFacets(rows,f),f);
 assert.ok(facets.idades.some(x=>x.value==="adulto"&&x.count===0));assert.ok(facets.idades.some(x=>x.value==="bebe"&&x.label==="Bebê"));
 assert.equal(new URLSearchParams(toggleFilterSearch("idade=adulto","idade","adulto")).has("idade"),false);
});
test("V4 URL parse, serialize, refresh, history/state, segundo clique",()=>{
 const first="marca=Nike&cor=azul&priceMin=100&busca=tenis&genero=Masculino,invalid&genero=Unissex&idade=Bebê,infantil,UNKNOWN";
 const f=filtersFromSearch(first);assert.deepEqual(f.genero,["masculino","unissex"]);assert.deepEqual(f.idade,["infantil","bebe"]);
 const params=catalogRequestParams(f,"tenis","maior-desconto",1,21);assert.equal(params.get("genero"),"masculino,unissex");assert.equal(params.get("idade"),"infantil,bebe");
 assert.deepEqual(filtersFromSearch(params.toString()),f);
 const second=toggleFilterSearch(first,"genero","masculino");assert.deepEqual(filtersFromSearch(second).genero,["unissex"]);
 const history=[first,second];assert.deepEqual(filtersFromSearch(history[0]),f);assert.deepEqual(filtersFromSearch(history[1]).idade,f.idade);
 const scope=catalogScope(f,"tenis","maior-desconto"),next=catalogScope(filtersFromSearch(second),"tenis","maior-desconto");assert.equal(catalogPage({scope,page:3},next),1);
});
test("V4 API canonical null is authoritative; comparação preserva ambos os eixos",()=>{
 const p={...rows[0],gender:null,ageGroup:null};assert.equal(genderOf(p),null);assert.equal(ageOf(p),null);
 const comparable=toComparableProduct({...rows[4],gender:"MASCULINO",ageGroup:"INFANTIL"});assert.equal(comparable.product.attributes.gender?.value,"Masculino");assert.equal(comparable.product.attributes.ageGroup?.value,"Infantil");assert.equal(comparable.product.attributes.gender?.provenance,"catalog");
});
test("V4 origem não altera normalização e demais dimensões V1/V3 intersectam",()=>{
 const f={...EMPTY_FILTERS,genero:["feminino"],idade:["infantil"],cor:["azul"],marca:["Nike"],price:[100,250] as [number,number]};
 for(const merchant of ["FutFanatics","Dafiti","Independent Shop"])assert.deepEqual(applyFilters(rows.map(p=>({...p,bestOffer:{...p.bestOffer!,marketplaceName:merchant}})),f).map(x=>x.id),["b"]);
 assert.equal(computeFacets([rows[4]]).idades.some(x=>x.count>0),false);
});

test("V4 sidebar renderiza selected zero com ID estável e chip removível",async()=>{
 const {createElement}=await import("react"),{renderToStaticMarkup}=await import("react-dom/server"),{default:Sidebar}=await import("../components/CatalogFilterSidebarV2");
 const filters=filtersFromSearch("genero=unissex&idade=bebe");const html=renderToStaticMarkup(createElement(Sidebar,{facets:computeFacets([]),filters,onToggle(){},onPriceChange(){},onClearAll(){}}));
 for(const id of ["filter-genero-unissex","filter-idade-bebe","chip-genero-unissex","chip-idade-bebe"])assert.ok(html.includes(`data-testid="${id}"`),id);
 assert.ok(html.includes("Bebê"));assert.ok(!html.includes("UNKNOWN"));
});
