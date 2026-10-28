import 'dotenv/config';
import pg from 'pg';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const meta=JSON.parse(execFileSync('docker',['inspect','beupfree-catalog-pg17'],{encoding:'utf8'}))[0];
if(meta.Name!=='/beupfree-catalog-pg17'||meta.NetworkSettings.Ports['5432/tcp'][0].HostPort!=='5435')throw Error('ORIGINAL_IDENTITY_MISMATCH');
const password=meta.Config.Env.find((s:string)=>s.startsWith('POSTGRES_PASSWORD='))?.slice(18);
const original=new pg.Client({host:'127.0.0.1',port:5435,database:'uppulse_catalog',user:'postgres',password,options:'-c default_transaction_read_only=on',application_name:'missao7_integrity_readonly'});
const url=new URL(process.env.MASTER_DATABASE_URL!);if(url.port!=='5436'||url.pathname!=='/uppulse_missao7')throw Error('DISPOSABLE_DATABASE_REQUIRED');
const isolated=new pg.Client({connectionString:url.toString(),options:'-c default_transaction_read_only=on'});
const result:any={originalPort:5435,isolatedPort:5436,readOnly:true,tables:{}};
try{
 await original.connect();await isolated.connect();
 await original.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');await isolated.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 for(const table of ['products','brands','external_product_identities','product_variants','offers','catalog_search_products','product_catalog_classifications','product_variant_normalizations']){
  const sql=`SELECT id,md5(row_to_json(t)::text) hash FROM ${table} t ORDER BY id`;
  const a=(await original.query(sql)).rows,b=(await isolated.query(sql)).rows;
  const byId=new Map(b.map(row=>[row.id,row.hash]));
  const missing=a.filter(row=>!byId.has(row.id)).length,changed=a.filter(row=>byId.has(row.id)&&byId.get(row.id)!==row.hash).length;
  result.tables[table]={original:a.length,isolated:b.length,missing,changed,additional:b.length-a.length,originalRowsPreserved:missing===0&&changed===0};
 }
 await original.query('ROLLBACK');await isolated.query('ROLLBACK');result.rollback=true;
 writeFileSync('../database-integrity.json',JSON.stringify(result,null,2));
 console.log(Object.values(result.tables).every((t:any)=>t.originalRowsPreserved)?'All original commercial rows preserved':'Integrity differences detected');
}finally{await original.end();await isolated.end();}
