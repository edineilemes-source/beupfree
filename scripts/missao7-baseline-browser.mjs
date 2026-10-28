import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const results={};
try{for(const port of [5017,5018]){
 const page=await browser.newPage();const messages=[];
 page.on('console',m=>{if(m.type()==='error')messages.push(m.text());});
 const response=await page.goto(`http://127.0.0.1:${port}/catalogo`);
 await page.getByTestId('grid-catalog-products').waitFor();
 const data=await(await page.request.get(`http://127.0.0.1:${port}/api/products?limit=1`)).json();
 results[port]={http:response.status(),duplicateFootballKey:messages.some(m=>m.includes('same key')&&m.includes('Futebol')),errors:[...new Set(messages)],modalities:data.facets.modalidades,total:data.total};
 await page.close();
}}finally{await browser.close();}
await writeFile('../baseline-browser.json',JSON.stringify(results,null,2));
