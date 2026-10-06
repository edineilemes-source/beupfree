import assert from "node:assert/strict";
import test from "node:test";
import { buildProjectionWhere, PgCatalogSearchProjectionRepository, type FacetDimension } from "./repository";

const filters = {genders:["gender_normalized = ANY"], ageGroups:["age_group_normalized = ANY"], brands:["Nike","Adidas"], colors:["preto","branco"], sizes:[40,41], genders:["MASCULINO" as const], ageGroups:["INFANTIL" as const], audiences:["MASCULINO"], excludeAudiences:["INFANTIL"], styles:["PERFORMANCE"], activities:["RUNNING"], merchants:["Loja A","Loja B"], discountBuckets:["30% - 39%","40% - 49%"], priceMin:300, priceMax:500, available:true, search:"air max", externalMerchantId:"scope"};
const clauses: Record<FacetDimension,string[]> = {genders:["gender_normalized = ANY"], ageGroups:["age_group_normalized = ANY"], brands:["brand_normalized = ANY"], colors:["color_family_ids &&"], sizes:["normalized_sizes &&"], audiences:["audience_normalized = ANY"], styles:["style = ANY"], activities:["activities &&"], merchants:["m.name = ANY"], discounts:["discount_percent>=30"], price:["current_price>=","current_price<="]};

test("T01 base retains eligibility without user predicates",()=>{
 const q=buildProjectionWhere({}); assert.equal(q.sql,"c.catalog_state='CATALOG_ELIGIBLE'"); assert.deepEqual(q.params,[]);
});
test("T02/T04/T05/T08/T09/T12/T14/T16/T28 OR arrays/buckets, AND dimensions, bound parameters",()=>{
 const q=buildProjectionWhere(filters);
 for(const group of Object.values(clauses)) for(const clause of group) assert.ok(q.sql.includes(clause));
 assert.ok(q.sql.includes(" OR ")); assert.ok(q.sql.includes(" AND "));
 for(const values of [["nike","adidas"],["preto","branco"],[40,41],["Loja A","Loja B"]]) assert.ok(q.params.some(p=>JSON.stringify(p)===JSON.stringify(values)));
 assert.ok(q.sql.includes("(c.discount_percent>=30 AND c.discount_percent<40) OR (c.discount_percent>=40 AND c.discount_percent<50)"));
});
for(const dimension of Object.keys(clauses) as FacetDimension[]) test(`T03/T06/T07/T10/T11/T13/T15/T17/T18 exclusion ${dimension} only`,()=>{
 const q=buildProjectionWhere(filters,dimension);
 for(const [other,group] of Object.entries(clauses)) for(const clause of group) assert.equal(q.sql.includes(clause),other!==dimension,clause);
 assert.ok(q.sql.includes("LIKE")); assert.ok(q.params.includes("%air%")); assert.ok(q.params.includes("%max%"));
 assert.ok(q.sql.includes("available=")); assert.ok(q.sql.includes("external_merchant_id=")); assert.equal(filters.priceMin,300);
});
for(const input of [{priceMin:300},{priceMax:500},{priceMin:300,priceMax:500}]) test(`T19/T20/T21 open/full price ${JSON.stringify(input)}`,()=>{
 const q=buildProjectionWhere(input); assert.equal(q.sql.includes("current_price>="),"priceMin" in input); assert.equal(q.sql.includes("current_price<="),"priceMax" in input);
 assert.deepEqual(buildProjectionWhere(input,"price").params,[]);
});
test("single query routes aggregates to corresponding universes with valid parameter offsets",async()=>{
 let calls=0; const db:any={async query(sql:string,params:unknown[]){calls++;
 for(const dimension of Object.keys(clauses)) {assert.ok(sql.includes(`facet_${dimension} AS (`)); assert.ok(sql.includes(`FROM facet_${dimension}`));}
 const placeholders=[...sql.matchAll(/\$(\d+)/g)].map(m=>Number(m[1])); assert.equal(Math.max(...placeholders),params.length); assert.equal(new Set(placeholders).size,params.length);
 assert.ok(!sql.includes("LIMIT 50")); return {rows:[{facets:{brands:[{value:"Adidas",count:94}]}}]};}};
 assert.deepEqual(await new PgCatalogSearchProjectionRepository(db).getFacets(filters),{brands:[{value:"Adidas",count:94}]}); assert.equal(calls,1);
});
