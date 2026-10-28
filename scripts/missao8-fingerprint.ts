import 'dotenv/config';import pg from 'pg';import {writeFileSync,readFileSync} from 'node:fs';
const url=new URL(process.env.MASTER_DATABASE_URL!);if(url.port!=='5437'||url.pathname!=='/uppulse_missao8')throw Error('ISOLATED_DB_REQUIRED');
const db=new pg.Client({connectionString:url.toString(),options:'-c default_transaction_read_only=on'});await db.connect();
const result:Record<string,unknown>={};
for(const table of ['products','brands','external_product_identities','product_variants','offers','catalog_search_products','product_catalog_classifications','product_variant_normalizations']){
 result[table]=(await db.query(`SELECT count(*)::int count,md5(string_agg(row_to_json(t)::text,'' ORDER BY id)) hash FROM ${table} t`)).rows[0];
}await db.end();
if(process.argv.includes('--verify')){const before=JSON.parse(readFileSync('../commercial-before.json','utf8'));writeFileSync('../commercial-integrity.json',JSON.stringify({before,after:result,identical:JSON.stringify(before)===JSON.stringify(result)},null,2));console.log('Commercial data identical:',JSON.stringify(before)===JSON.stringify(result));}
else writeFileSync('../commercial-before.json',JSON.stringify(result,null,2));
