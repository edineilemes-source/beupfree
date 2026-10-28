import assert from 'node:assert/strict';
import test from 'node:test';
import {catalogRequestParams,filtersFromSearch} from '../lib/catalogState';
import {demoCatalogResponse} from '../lib/organizerPreview';

test('catálogo operacional pagina e filtra sem baixar lote global',()=>{
 const filters=filtersFromSearch('marca=Nike&priceMin=200');
 const first=catalogRequestParams(filters,'tenis','menor-preco',1,21);
 const third=catalogRequestParams(filters,'tenis','menor-preco',3,21);
 assert.equal(first.get('offset'),'0');assert.equal(third.get('offset'),'42');
 for(const params of [first,third]){
  assert.equal(params.get('limit'),'21');assert.equal(params.get('priceMin'),'200');
  assert.equal(params.get('marca'),'Nike');assert.equal(params.get('sort'),'price-asc');assert.equal(params.get('q'),'tenis');
 }
 assert.equal(third.get('priceMax'),null);
});
test('fallback demo preserva snapshot local, total próprio e isolamento de ofertas comerciais',()=>{
 const first=demoCatalogResponse(),again=demoCatalogResponse();
 assert.equal(first.serverDriven,false);assert.equal(first.catalogSource,'demo');assert.equal(first.demonstrative,true);
 assert.equal(first.total,first.products.length);assert.ok(first.total>21);
 assert.equal(new Set(first.products.map(p=>p.id)).size,first.total);
 assert.deepEqual(again,first);
 for(const product of first.products){assert.equal(product.demonstrative,true);assert.equal(product.bestOffer?.affiliateUrl,'');}
});
