import assert from 'node:assert/strict';
import test from 'node:test';
import {COLOR_TAXONOMY_VERSION} from '@shared/colorTaxonomy';
import {toComparableProduct} from './comparisonProductAdapter';
import type {CatalogProduct} from './catalogFilters';
const product:CatalogProduct={id:'p',mainName:'Tênis',mainImageUrl:null,primaryColor:'pink',brand:null,category:null,averageRating:null,totalReviews:0,bestOffer:null,colorTaxonomyVersion:COLOR_TAXONOMY_VERSION,colorFamilyIds:['rosa'],colors:[{name:'pink',normalized:'pink',source:'marketplace_variation'},{name:'rosa',normalized:'rosa',source:'marketplace_variation'}]};
test('V3 comparison retains canonical specificity; family is only the search grouping',()=>{
 const compared=toComparableProduct(product);
 assert.deepEqual(compared.product.attributes.colors?.map(c=>c.value),['pink','rosa']);
 assert.deepEqual(compared.product.attributes.colors?.map(c=>c.label),['pink','rosa']);
 assert.deepEqual(toComparableProduct({...product,colors:[],canonicalColorIds:[],colorFamilyIds:[]}).product.attributes.colors,undefined);
});
test('legacy comparison and card adapters remain compatible',()=>{
 assert.deepEqual(toComparableProduct({...product,colorTaxonomyVersion:undefined}).product.attributes.colors?.map(c=>c.value),['rosa']);
 assert.equal(toComparableProduct({id:'card',name:'Tênis',image:'',brand:'Marca',category:'Calçados',price:100,affiliateUrl:'#'}).product.id,'card');
});
