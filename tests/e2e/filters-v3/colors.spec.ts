import {readFile} from "node:fs/promises";
import {resolve,extname} from "node:path";
import {test,expect,type Page} from '@playwright/test';
import {computeCrossFacets,applyFilters,type CatalogProduct} from '../../../client/src/lib/catalogFilters';
import {filtersFromSearch,localCatalogFilters} from '../../../client/src/lib/catalogState';
import {COLOR_TAXONOMY_VERSION,COLOR_FILTER_CONTRACT_VERSION,parseColorFilter} from '../../../shared/colorTaxonomy';
const product=(id:string,raw:string,brand:string,price:number):CatalogProduct=>({id,mainName:`Tênis ${brand} masculino corrida 40 Br`,mainImageUrl:null,primaryColor:raw,brand:{name:brand},category:null,averageRating:null,totalReviews:0,catalogSource:'operational',demonstrative:false,bestOffer:{id:`o-${id}`,currentPrice:String(price),originalPrice:String(price*2),discountPercent:50,affiliateUrl:'#',freeShipping:false}});
const products=[product('navy','azul marinho mystery','Nike',250),product('black','preto denim','Nike',300),product('white','branco','Adidas',400),product('incolor','incolor','Nike',220)];
async function mockCatalog(page:Page,serverDriven=true){
 // Serve built frontend through browser interception; no listening socket/backend.
 await page.route('http://127.0.0.1:5178/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.startsWith('/api/'))return route.fallback();
  const root=resolve('dist/public'), file=path.startsWith('/assets/')?resolve(root,'.'+path):resolve(root,'index.html');
  if(!file.startsWith(root+'/'))return route.abort();
  const types:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
  return route.fulfill({contentType:types[extname(file)]??'application/octet-stream',body:await readFile(file)});
 });
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/api/auth/me')return route.fulfill({status:401,json:{error:'unauthenticated'}});
  if(url.pathname==='/api/products'){
   const filters=localCatalogFilters(filtersFromSearch(url.search));
   if(serverDriven){try{parseColorFilter(url.searchParams.get('cor')??undefined);}catch{return route.fulfill({status:400,json:{code:'INVALID_COLOR_FAMILY',error:'Remova a seleção inválida.'}});}}
   const filtered=serverDriven?applyFilters(products,filters):products;
   return route.fulfill({json:{serverDriven,demonstrative:false,catalogSource:'operational',total:filtered.length,products:filtered,facets:computeCrossFacets(products,filters),colorTaxonomyVersion:COLOR_TAXONOMY_VERSION,colorFilterContractVersion:COLOR_FILTER_CONTRACT_VERSION}});
  }
  return route.fulfill({json:[]});
 });
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,route=>route.abort());
}
async function openColors(page:Page){
 const section=page.getByTestId('section-cor');
 if(!await page.getByTestId('filter-cor-azul').isVisible())await section.click();
}
for(const serverDriven of [true,false])test(`cor roundtrip, second click, multiple colors, history, V1/V2 intersection (${serverDriven?'API':'local'})`,async({page})=>{
 await mockCatalog(page,serverDriven);await page.goto('/catalogo?marca=Nike&priceMin=200');await openColors(page);
 const blue=page.getByTestId('filter-cor-azul');await expect(blue).toBeVisible();
 await blue.click();await expect.poll(()=>new URL(page.url()).searchParams.get('cor')).toBe('azul');
 await expect(page.getByTestId('text-catalog-count')).toContainText('1 produto');
 await page.getByTestId('filter-cor-preto').click();await expect.poll(()=>new URL(page.url()).searchParams.get('cor')).toBe('azul,preto');
 await expect(page.getByTestId('text-catalog-count')).toContainText('2 produtos');
 expect(new URL(page.url()).searchParams.get('priceMin')).toBe('200');expect(new URL(page.url()).searchParams.get('marca')).toBe('Nike');
 await page.goBack();await expect.poll(()=>new URL(page.url()).searchParams.get('cor')).toBe('azul');
 await page.goForward();await expect.poll(()=>new URL(page.url()).searchParams.get('cor')).toBe('azul,preto');
 await page.reload();await openColors(page);await page.getByTestId('filter-cor-preto').click();
 await expect.poll(()=>new URL(page.url()).searchParams.get('cor')).toBe('azul');
 await blue.click();await expect.poll(()=>new URL(page.url()).searchParams.has('cor')).toBe(false);
 expect(new URL(page.url()).searchParams.has('color')).toBe(false);
});
test('selected zero remains removable; invalid selection survives API error',async({page})=>{
 await mockCatalog(page);await page.goto('/catalogo?cor=metalico&marca=Nike');await openColors(page);
 const zero=page.getByTestId('filter-cor-metalico');await expect(zero).toBeVisible();await expect(zero).toContainText('0');await zero.click();
 await expect.poll(()=>new URL(page.url()).searchParams.has('cor')).toBe(false);
 await page.goto('/catalogo?cor=pretolino');await openColors(page);
 await expect(page.getByTestId('filter-cor-pretolino')).toBeVisible();await page.getByTestId('filter-cor-pretolino').click();
 await expect.poll(()=>new URL(page.url()).searchParams.has('cor')).toBe(false);
 await expect(page.getByTestId('grid-catalog-products')).toBeVisible();
});
