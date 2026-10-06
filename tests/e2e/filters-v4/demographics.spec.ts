import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {applyFilters,computeCrossFacets,type CatalogProduct} from '../../../client/src/lib/catalogFilters';
import {filtersFromSearch,localCatalogFilters} from '../../../client/src/lib/catalogState';
const product=(id:string,title:string):CatalogProduct=>({id,mainName:title,mainImageUrl:null,primaryColor:'azul',brand:{name:'Nike'},category:null,averageRating:null,totalReviews:0,bestOffer:{currentPrice:'200',originalPrice:'300',discountPercent:33,affiliateUrl:'#',freeShipping:false}});
const rows=[product('a','Tênis Feminino Adulto'),product('b','Tênis Feminino Infantil'),product('c','Tênis Masculino Infantil'),product('d','Tênis Unissex Bebê'),product('e','Tênis Modelo')];
async function mock(page:Page,serverDriven:boolean){
 await page.route('http://127.0.0.1:5178/**',async route=>{
  const path=new URL(route.request().url()).pathname;if(path.startsWith('/api/'))return route.fallback();
  const root=resolve('dist/public'),file=path.startsWith('/assets/')?resolve(root,'.'+path):resolve(root,'index.html');if(!file.startsWith(root+'/'))return route.abort();
  const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
  await route.fulfill({contentType:types[extname(file)]??'application/octet-stream',body:await readFile(file)});
 });
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());if(url.pathname==='/api/auth/me')return route.fulfill({status:401,json:{}});
  if(url.pathname==='/api/products'){const filters=localCatalogFilters(filtersFromSearch(url.search)),filtered=serverDriven?applyFilters(rows,filters):rows;return route.fulfill({json:{serverDriven,total:filtered.length,products:filtered,facets:computeCrossFacets(rows,filters)}});}
  return route.fulfill({json:[]});
 });
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
}
for(const serverDriven of [true,false])test(`V4 AND, multi-select, refresh, history and second click (${serverDriven?'API':'local'})`,async({page})=>{
 await mock(page,serverDriven);await page.goto('/catalogo?genero=feminino&idade=infantil&marca=Nike&cor=azul&priceMin=100&busca=tenis');
 await expect(page.getByTestId('text-catalog-count')).toContainText('1 produto');
 if(!await page.getByTestId('filter-genero-masculino').isVisible())await page.getByTestId('section-gênero').click();
 await page.getByTestId('filter-genero-masculino').click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('genero')).toBe('masculino,feminino');
 await expect(page.getByTestId('text-catalog-count')).toContainText('2 produtos');
 await page.goBack();await expect(page.getByTestId('text-catalog-count')).toContainText('1 produto');
 await page.goForward();await expect(page.getByTestId('text-catalog-count')).toContainText('2 produtos');
 await page.reload();if(!await page.getByTestId('filter-genero-masculino').isVisible())await page.getByTestId('section-gênero').click();await page.getByTestId('filter-genero-masculino').click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('genero')).toBe('feminino');
 if(!await page.getByTestId('filter-idade-adulto').isVisible())await page.getByTestId('section-idade').click();await page.getByTestId('filter-idade-adulto').click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('idade')).toBe('adulto,infantil');
 await expect(page.getByTestId('text-catalog-count')).toContainText('2 produtos');
 expect(new URL(page.url()).searchParams.get('cor')).toBe('azul');expect(new URL(page.url()).searchParams.get('priceMin')).toBe('100');
});
test('V4 selected-zero removable and unknown never Adulto',async({page})=>{
 await mock(page,true);await page.goto('/catalogo?genero=unissex&idade=adulto');
 await expect(page.getByTestId('text-catalog-count')).toContainText('0 produto');
 if(!await page.getByTestId('filter-idade-adulto').isVisible())await page.getByTestId('section-idade').click();const selected=page.getByTestId('filter-idade-adulto');await expect(selected).toContainText('0');await selected.click();
 await expect.poll(()=>new URL(page.url()).searchParams.has('idade')).toBe(false);
 await expect(page.getByTestId('text-catalog-count')).toContainText('1 produto');
});
