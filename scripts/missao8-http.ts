import 'dotenv/config';import pg from 'pg';import {writeFileSync} from 'node:fs';
const url=new URL(process.env.MASTER_DATABASE_URL!);if(url.port!=='5437'||url.pathname!=='/uppulse_missao8')throw Error('ISOLATED_DB_REQUIRED');
const db=new pg.Client({connectionString:url.toString(),options:'-c default_transaction_read_only=on'});await db.connect();
const id=(await db.query(`SELECT min(e.product_id) id FROM product_master_memberships pm JOIN external_product_identities e ON e.id=pm.external_product_identity_id JOIN catalog_search_products c ON c.product_id=e.product_id AND c.merchant_id=e.merchant_id WHERE pm.valid_to IS NULL GROUP BY pm.master_product_id HAVING count(DISTINCT e.merchant_id)>1 ORDER BY 1 LIMIT 1`)).rows[0].id;await db.end();
const result:any={};for(const path of ['/catalogo','/api/products?limit=1','/api/products?limit=1&modalidade=Futebol','/api/master-identities/'+id]){
 const response=await fetch('http://127.0.0.1:5019'+path);result[path]={status:response.status};if(path.startsWith('/api'))result[path].body=await response.json();
}writeFileSync('../http-final.json',JSON.stringify(result,null,2));
const view=result['/api/master-identities/'+id].body;writeFileSync('../preview-case.json',JSON.stringify(view,null,2));console.log(JSON.stringify({statuses:Object.fromEntries(Object.entries(result).map(([k,v]:any)=>[k,v.status])),master:view.master,offers:view.offers?.length,suppliers:[...new Set(view.offers?.map((o:any)=>o.merchant_name))]}));
