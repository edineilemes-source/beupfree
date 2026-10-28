import 'dotenv/config';
import {test,expect} from '@playwright/test';
import pg from 'pg';
let target:{id:string;name:string},view:any;
test.beforeAll(async({request})=>{
 const url=new URL(process.env.MASTER_DATABASE_URL!);if(url.port!=='5437'||url.pathname!=='/uppulse_missao8')throw Error('WRONG_DB');
 const db=new pg.Pool({connectionString:url.toString(),options:'-c default_transaction_read_only=on'});
 try{const candidates=(await db.query(`SELECT min(c.product_id) id FROM product_master_memberships m JOIN external_product_identities e ON e.id=m.external_product_identity_id JOIN catalog_search_products c ON c.product_id=e.product_id AND c.merchant_id=e.merchant_id
 WHERE m.valid_to IS NULL GROUP BY m.master_product_id HAVING count(DISTINCT c.merchant_id)>1 ORDER BY 1 LIMIT 20`)).rows;
 for(const candidate of candidates){const response=await request.get('/api/master-identities/'+candidate.id);const data=await response.json();if(data.status==='AVAILABLE'&&new Set(data.offers.map((o:any)=>o.merchant_id)).size>1){view=data;target={id:candidate.id,name:data.offers.find((o:any)=>o.product_id===candidate.id).product_name};break;}}
 expect(target).toBeTruthy();
 }finally{await db.end();}
});
test('real Master has multiple suppliers, unchanged affiliate links and individual promotions',async({request})=>{
 expect(view.master.canonicalName).toBeNull();expect(view.skuEquivalence).toBe(false);
 expect(new Set(view.offers.map((o:any)=>o.offer_id)).size).toBe(view.offers.length);
 for(const offer of view.offers){
  const detail=await(await request.get('/api/products/'+offer.product_id)).json();
  const source=detail.offers.find((o:any)=>o.id===offer.offer_id);expect(source).toBeTruthy();
  expect(offer.current_price).toBe(source.currentPrice);expect(offer.previous_price).toBe(source.originalPrice);
  expect(Number(offer.discount_percent)).toBe(source.discountPercent);expect(offer.affiliate_url).toBe(source.affiliateUrl);
  const redirect=await request.get('/api/click/'+offer.offer_id,{maxRedirects:0});expect(redirect.status()).toBe(302);expect(redirect.headers().location).toBe(offer.affiliate_url);
 }
});
test('real interface shows hierarchy, variants, suppliers and correct purchase links',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/catalogo?busca='+encodeURIComponent(target.name));
 await page.getByTestId('master-offers-'+target.id).first().click();
 const dialog=page.getByTestId('master-dialog');await expect(dialog).toBeVisible();
 await expect(dialog.getByText('Master '+view.master.id,{exact:true})).toBeVisible();
 await expect(dialog.getByText('Nome comercial Master não disponível.')).toBeVisible();
 await expect(dialog.getByRole('region',{name:'Ofertas por fornecedor'}).getByTestId('master-offer')).toHaveCount(view.offers.length);
 for(const offer of view.offers){const link=dialog.getByRole('link',{name:'Ver oferta em '+offer.merchant_name,exact:true});
  expect(await link.evaluateAll((nodes:any[])=>nodes.map(n=>n.getAttribute('href')))).toContain(offer.affiliate_url);}
 await expect(dialog.getByRole('region',{name:'Hierarquia e variantes'})).toBeVisible();
 await dialog.locator('summary').first().click();await expect(dialog.getByText(/Produto de origem:/).first()).toBeVisible();
 await page.screenshot({path:`../preview-${testInfo.project.name}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(errors).toEqual([]);
});
test('reading identity preserves V4 results, sort, filters, facets and pagination without duplicates',async({request})=>{
 const query='/api/products?limit=21&sort=price-asc&genero=masculino';
 const before=await(await request.get(query)).json();expect(before.serverDriven).toBe(true);
 await request.get('/api/master-identities/'+target.id);
 const after=await(await request.get(query)).json();expect(after).toEqual(before);
 const next=await(await request.get(query+'&offset=21')).json();
 const all=[...before.products,...next.products];expect(new Set(all.map((p:any)=>p.id)).size).toBe(all.length);
 const prices=all.map((p:any)=>Number(p.bestOffer.currentPrice));expect(prices).toEqual([...prices].sort((a,b)=>a-b));
 expect(after.demographicTaxonomyVersion).toBe('uppulse-demographics-v1');expect(after.demographicFilterVersion).toBe('uppulse-demographic-filters-v4');
 expect((await request.get('/api/products?audience=masculino')).status()).toBe(400);
});
test('identity unavailable and empty states keep purchase action usable',async({page})=>{
 await page.route('**/api/master-identities/**',route=>route.fulfill({status:503,json:{code:'IDENTITY_UNAVAILABLE'}}));
 await page.goto('/catalogo?busca='+encodeURIComponent(target.name));await page.getByTestId('master-offers-'+target.id).first().click();
 await expect(page.getByTestId('master-dialog').getByRole('alert')).toContainText('Identidade temporariamente indisponível');
 await page.unroute('**/api/master-identities/**');
 await page.route('**/api/master-identities/**',route=>route.fulfill({json:{status:'NO_CONFIRMED_IDENTITY'}}));
 await page.getByRole('button',{name:'Tentar novamente'}).click();
 await expect(page.getByText('Não há identidade confirmada disponível para este produto.')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByTestId('master-offers-'+target.id).first()).toBeVisible();
});

test('identity loading stays local to the dialog',async({page})=>{
 await page.route('**/api/master-identities/**',async route=>{
  await new Promise(resolve=>setTimeout(resolve,1500));
  await route.fulfill({json:{status:'NO_CONFIRMED_IDENTITY'}});
 });
 await page.goto('/catalogo?busca='+encodeURIComponent(target.name));
 await page.getByTestId('master-offers-'+target.id).first().click();
 await expect(page.getByTestId('master-dialog').getByRole('status')).toHaveText('Carregando identidade…');
 await expect(page.getByText('Não há identidade confirmada disponível para este produto.')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Ver oferta',exact:true}).first()).toBeEnabled();
});

test('modalidade Futebol has a single option and exact distinct product/merchant counts',async({request,page})=>{
 const data=await(await request.get('/api/products?limit=1')).json();
 const labels=data.facets.modalidades.map((f:any)=>f.label);
 expect(new Set(labels).size).toBe(labels.length);
 expect(labels.filter((s:string)=>s==='Futebol')).toHaveLength(1);
 const filtered=await(await request.get('/api/products?limit=1&modalidade=Futebol')).json();
 expect(data.facets.modalidades.find((f:any)=>f.label==='Futebol').count).toBe(filtered.total);
 await page.goto('/catalogo');
 const warnings:string[]=[];page.on('console',m=>{if(m.type()==='error')warnings.push(m.text());});
 await expect(page.getByTestId('text-catalog-title')).toBeVisible();
 expect(warnings.filter(m=>m.includes('same key'))).toEqual([]);
});
