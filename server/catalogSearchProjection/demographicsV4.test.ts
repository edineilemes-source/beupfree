import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {buildProjectionWhere,PgCatalogSearchProjectionRepository} from "./repository";
import {buildCatalogSearchProjection,type ProjectionSourceRow} from "./builder";
import {DEMOGRAPHIC_TAXONOMY_VERSION} from "@shared/demographicTaxonomy";
import {operationalFilters,publicFacets,createOperationalPublicCatalogHandlers} from "../publicCatalog/operational";
import {awinDemographicEvidence} from "../integrations/awin/demographics";
const f={genders:["FEMININO","MASCULINO"] as const,ageGroups:["INFANTIL","BEBE"] as const,search:"Tênis",brands:["Nike"],demographicVersion:DEMOGRAPHIC_TAXONOMY_VERSION};
test("V4 SQL AND entre eixos, ANY intra eixo, search preservada",()=>{
 const x=buildProjectionWhere({...f,genders:[...f.genders],ageGroups:[...f.ageGroups]});assert.match(x.sql,/gender_normalized = ANY.* AND c.age_group_normalized = ANY/);assert.match(x.sql,/LIKE/);assert.ok(!x.sql.includes("audience_normalized"));assert.deepEqual(x.params.filter(Array.isArray).slice(-2),[f.genders,f.ageGroups]);
});
for(const dimension of ["genders","ageGroups"] as const)test(`V4 facet ${dimension} exclui somente o próprio eixo`,()=>{
 const x=buildProjectionWhere({...f,genders:[...f.genders],ageGroups:[...f.ageGroups]},dimension);
 assert.equal(x.sql.includes("gender_normalized = ANY"),dimension!=="genders");assert.equal(x.sql.includes("age_group_normalized = ANY"),dimension!=="ageGroups");assert.match(x.sql,/LIKE/);assert.match(x.sql,/brand_normalized/);assert.match(x.sql,/demographic_taxonomy_version/);
});
test("V4 agregação SQL independente, sem complemento",async()=>{
 let calls=0;const db:any={async query(sql:string,params:unknown[]){calls++;assert.match(sql,/FROM facet_genders WHERE gender_normalized IS NOT NULL/);assert.match(sql,/FROM facet_ageGroups WHERE age_group_normalized IS NOT NULL/);assert.equal(Math.max(...[...sql.matchAll(/\$(\d+)/g)].map(x=>Number(x[1]))),params.length);return{rows:[{facets:{genders:[],ageGroups:[]}}]}}};await new PgCatalogSearchProjectionRepository(db).getFacets({...f,genders:[...f.genders],ageGroups:[...f.ageGroups]});assert.equal(calls,1);
});
test("V4 handler URL canonical, repetido/invalid seguro, sem audience",()=>{
 const x=operationalFilters({genero:["masculino,unissex","UNKNOWN"],idade:"infantil,bebe,foo",q:"tenis"});assert.deepEqual(x.genders,["MASCULINO","UNISSEX"]);assert.deepEqual(x.ageGroups,["INFANTIL","BEBE"]);assert.equal(x.audiences,undefined);assert.equal(x.excludeAudiences,undefined);
 assert.deepEqual(publicFacets({genders:[{value:"UNKNOWN",count:99},{value:"FEMININO",count:3}],ageGroups:[{value:"INFANTIL",count:2}],total:1}).idades.map((x:any)=>x.count),[0,2,0]);
});
const base=(overrides:Partial<ProjectionSourceRow>={}):ProjectionSourceRow=>({productId:"p",providerId:"provider",merchantId:"merchant",productName:"Tênis Feminino Infantil",brandRaw:"Nike",audienceRaw:null,catalogState:"CATALOG_ELIGIBLE",universe:"SNEAKER_CONFIRMED",style:"PERFORMANCE",activities:[],classifierVersion:"v",variantId:"v",sizeNormalized:40,sizeStatus:"NORMALIZED_SAFE",colorRaw:"azul",colorNormalized:["azul"],colorStatus:"NORMALIZED_SAFE",normalizerVersion:"v",offerId:"o",currentPrice:100,previousPrice:200,discountPercent:50,currency:"BRL",inStock:true,promotionStatus:"PROMOTION_CONFIRMED",primaryImageUrl:null,feedId:"feed",sourceUpdatedAt:"2026-09-01T00:00:00Z",...overrides});
test("V4 projection preserva raw, todos os sinais, precedência e merchant independence",()=>{
 for(const merchantId of ["m1","m2","independent"]){const row=buildCatalogSearchProjection([base({merchantId,audienceRaw:"masculino",demographicEvidence:awinDemographicEvidence({"Fashion:suitable_for":"masculino"})})]).rows[0];assert.equal(row.genderNormalized,"MASCULINO");assert.equal(row.ageGroupNormalized,"INFANTIL");assert.equal(row.demographicTaxonomyVersion,DEMOGRAPHIC_TAXONOMY_VERSION);assert.equal(row.audienceRaw,"masculino");assert.equal(row.demographicEvidence.gender.source,"adapter");}
});
test("V4 projection conflitos são determinísticos, sem first-row wins",()=>{
 const a=base({audienceRaw:"masculino"}),b=base({audienceRaw:"feminino"});const first=buildCatalogSearchProjection([a,b]).rows[0],reverse=buildCatalogSearchProjection([b,a]).rows[0];assert.equal(first.genderNormalized,null);assert.equal(first.ageGroupNormalized,"INFANTIL");assert.deepEqual(first.demographicEvidence,reverse.demographicEvidence);
});
test("V4 schema/persistência aditivos incluem mudança somente de normalização",()=>{
 const sql=readFileSync(new URL("../../migrations/0011_catalog_demographics.sql",import.meta.url),"utf8");assert.doesNotMatch(sql,/\b(DROP|DELETE|TRUNCATE)\b/);assert.ok(!sql.includes("DEFAULT 'ADULTO'"));
 const persist=readFileSync(new URL("../../scripts/catalog-search-projection-persist.ts",import.meta.url),"utf8");for(const column of ["gender_normalized","age_group_normalized","demographic_taxonomy_version","demographic_evidence"]){assert.ok(persist.includes(`catalog_search_products.${column}`));assert.ok(persist.includes(`${column}=excluded.${column}`));}
});

test("V4 public handler emite eixos canônicos e facets separadas sem banco/HTTP",async()=>{
 const envKeys=["UPPULSE_PUBLIC_CATALOG_SOURCE","UPPULSE_PUBLIC_CATALOG_APPROVED","AWIN_CURATOR_DATABASE_URL"];
 const before=envKeys.map(k=>process.env[k]);
 process.env.UPPULSE_PUBLIC_CATALOG_SOURCE="operational";process.env.UPPULSE_PUBLIC_CATALOG_APPROVED="true";process.env.AWIN_CURATOR_DATABASE_URL="test-placeholder";
 try {
  let filters:any;const row={product_id:"p",product_name:"Tênis Modelo",brand_raw:"Nike",brand_normalized:"nike",universe:"SNEAKER_CONFIRMED",gender_normalized:"MASCULINO",age_group_normalized:"INFANTIL",demographic_taxonomy_version:DEMOGRAPHIC_TAXONOMY_VERSION,normalized_colors:[],representative_offer_id:"o",current_price:"100",previous_price:"200",discount_percent:50,merchant_name:"Independent",source_updated_at:"2026-09-01"};
  const repo:any={async listProducts(f:any){filters=f;return[row]},async countProducts(){return 1},async getFacets(){return{genders:[{value:"MASCULINO",count:1}],ageGroups:[{value:"INFANTIL",count:1}]}}};
  let body:any;const response:any={setHeader(){},json(x:any){body=x},status(){return this}};
  await createOperationalPublicCatalogHandlers(()=>repo).list({query:{genero:"masculino,invalid",idade:"infantil",q:"modelo"}} as any,response,()=>assert.fail());
  assert.deepEqual(filters.genders,["MASCULINO"]);assert.deepEqual(filters.ageGroups,["INFANTIL"]);assert.equal(filters.search,"modelo");
  assert.equal(body.products[0].gender,"MASCULINO");assert.equal(body.products[0].ageGroup,"INFANTIL");assert.equal(body.products[0].audience,undefined);assert.equal(body.facets.audiences,undefined);assert.equal(body.facets.generos[0].value,"masculino");
 }finally{envKeys.forEach((k,i)=>before[i]===undefined?delete process.env[k]:process.env[k]=before[i]);}
});
