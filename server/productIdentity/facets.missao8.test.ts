import test from 'node:test';import assert from 'node:assert/strict';
import {operationalFilters,publicFacets} from '../publicCatalog/operational';
import {PgCatalogSearchProjectionRepository} from '../catalogSearchProjection/repository';
test('Futebol selects the union of original V4 activities without rewriting classification',()=>{
 assert.deepEqual(operationalFilters({modalidade:'Futebol'}).activities,['FOOTBALL','FUTSAL']);
 const facets=publicFacets({activities:[{value:'FOOTBALL',count:3},{value:'RUNNING',count:7}],total:10});
 assert.deepEqual(facets.modalidades,[{label:'Futebol',count:3},{label:'Corrida',count:7}]);
});
test('display facet SQL collapses aliases per projection row before counting',async()=>{
 let sql='';const repo=new PgCatalogSearchProjectionRepository({query:async(q:string)=>{sql=q;return {rows:[{facets:{}}]};}} as any);
 await repo.getFacets({available:true});
 assert.match(sql,/SELECT DISTINCT CASE WHEN item='FUTSAL' THEN 'FOOTBALL' ELSE item END activity/);
 assert.match(sql,/FROM unnest\(activities\) item/);
});
