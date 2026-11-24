/**
 * Controlled Mission 10 recovery: materialize ORIGINAL Product Master sidecar
 * on the audited, disposable PostgreSQL clone only, then run the ORIGINAL
 * parser/matcher/grouping/persistence for Olympikus + cross-store candidates.
 *
 * Never run against the source volume, production, or a public write path.
 * No classification, offers, prices, projection, or other commercial changes.
 */
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import pg from "pg";
import {loadSources,persistIdentities} from "../server/productIdentity/operational";
import type {CatalogCheckpoint} from "../server/productIdentity/catalog";
import {sourceBrand} from "../server/productIdentity/reconciledReader";
import {parseProductIdentity} from "../shared/product-identity/parser";

export const MASTER_TABLES=[
 "master_products","product_identity_runs","product_identity_decisions",
 "product_master_memberships","product_identity_jobs"
] as const;

export function selectOlympikusCohort(
 sources:Array<{id:string;merchantId:string;name:string;brandName:string|null;rawBrand:string|null;rawBrandCount:number}>,
 olympikusMerchantId:string,limit=12000
){
 const allMerchant=sources.filter(s=>s.merchantId===olympikusMerchantId);
 if(allMerchant.length!==813)throw Error("OLYMPIKUS_IDENTITY_COUNT_CHANGED");
 const selected=sources.filter(s=>{
  if(s.merchantId===olympikusMerchantId)return true;
  const brand=sourceBrand(s as any);
  const parsed=parseProductIdentity({name:s.name,brand});
  return /olympikus/i.test(brand??"") || /\bolympikus\b/i.test(s.name) ||
    /olympikus/i.test(parsed.brand??"");
 });
 if(selected.length>limit)throw Error("CROSS_STORE_COHORT_OVER_BUDGET");
 if(selected.some(s=>!s.id))throw Error("IDENTITY_ID_INVALID");
 return selected.map(s=>s.id).sort();
}

const FAIL_CLOSED_COUNTS={products:33520,offers:102018,search:16945,olympikusOffers:5167,olympikusIdentities:813};

async function main(){
 const urlText=process.env.DATABASE_URL;
 if(!urlText)throw Error("DATABASE_URL_REQUIRED");
 const url=new URL(urlText);
 if(url.hostname!=="127.0.0.1"||url.port!=="5436"||url.pathname!=="/uppulse_catalog")
  throw Error("AUDITED_CLONE_5436_ONLY");
 const pool=new pg.Pool({connectionString:urlText,max:2,connectionTimeoutMillis:10000});
 try{
  const client=await pool.connect();
  let internalId:string,cohortIds:string[];
  try{
   await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
   const db=(await client.query("SELECT current_database() db, inet_server_port() port")).rows[0];
   if(db.db!=="uppulse_catalog"||Number(db.port)!==5432)throw Error("DATABASE_IDENTITY_MISMATCH");
   const counts=(await client.query(`
    SELECT (SELECT count(*)::int FROM public.products) products,
     (SELECT count(*)::int FROM public.offers) offers,
     (SELECT count(*)::int FROM public.catalog_search_products) search
   `)).rows[0];
   for(const k of ["products","offers","search"] as const)
    if(Number(counts[k])!==FAIL_CLOSED_COUNTS[k])throw Error("CATALOG_BASELINE_CHANGED_"+k.toUpperCase());
   const merchants=(await client.query("SELECT id FROM commerce_merchants WHERE external_merchant_id='17698'")).rows;
   if(merchants.length!==1)throw Error("OLYMPIKUS_MERCHANT_MISSING");
   internalId=String(merchants[0].id);
   const olympikus=(await client.query(`
    SELECT (SELECT count(*)::int FROM offers WHERE merchant_id=$1) offers,
     (SELECT count(*)::int FROM external_product_identities WHERE merchant_id=$1) identities
   `,[internalId])).rows[0];
   if(olympikus.offers!==FAIL_CLOSED_COUNTS.olympikusOffers ||
    olympikus.identities!==FAIL_CLOSED_COUNTS.olympikusIdentities)
    throw Error("OLYMPIKUS_SOURCE_COUNTS_CHANGED");
   const present=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])",[MASTER_TABLES])).rows.map(x=>x.tablename);
   if(present.length!==0&&present.length!==MASTER_TABLES.length)throw Error("PARTIAL_MASTER_SCHEMA");
   if(present.length===MASTER_TABLES.length){
    const existing=Number((await client.query("SELECT count(*)::int n FROM product_master_memberships WHERE valid_to IS NULL")).rows[0].n);
    if(existing>0){
     const olympikusExisting=Number((await client.query(`
      SELECT count(*)::int n FROM product_master_memberships mm
       JOIN external_product_identities e ON e.id=mm.external_product_identity_id
       WHERE e.merchant_id=$1 AND mm.valid_to IS NULL`,[internalId])).rows[0].n);
     if(olympikusExisting===813){
      await client.query("ROLLBACK");
      console.log(JSON.stringify({status:"ALREADY_COMPLETED",olympikusMasterMemberships:813,commercialWrites:0}));
      return;
     }
     throw Error("MASTER_ALREADY_PARTIALLY_POPULATED_MANUAL_RECONCILIATION_REQUIRED");
    }
   }
   const sources=await loadSources(client);
   cohortIds=selectOlympikusCohort(sources,internalId);
   await client.query("ROLLBACK");
   if(present.length===0){
    const sql=await readFile(resolve(dirname(fileURLToPath(import.meta.url)),"../migrations/0013_master_identity_sidecar.sql"),"utf8");
    // The migration is intentionally scoped to the isolated clone, not source.
    await client.query(sql);
   }
  }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}
  finally{client.release()}
  // The original historical engine uses an advisory lock and atomically
  // writes runs, decisions, Master rows and memberships as one transaction.
  // Original Mission 8 tiling schedules every brand-compatible tile instead
  // of silently truncating other-store candidates at the 2,000-input bound.
  // Checkpoint is in-memory only: the historical engine commits once and
  // atomically, with its advisory lock, after all tile decisions are validated.
  const tileCache=new Map<string,Awaited<ReturnType<NonNullable<CatalogCheckpoint["load"]>>>>();
  const checkpoint:CatalogCheckpoint={
   tileSize:500,
   async load(key){return tileCache.get(key)??null;},
   async save(key,tile){tileCache.set(key,tile);},
  };
  const result=await persistIdentities(pool,cohortIds,{},checkpoint);
  const check=await pool.query(`
   SELECT count(DISTINCT mm.external_product_identity_id)::int n
   FROM product_master_memberships mm
    JOIN external_product_identities e ON e.id=mm.external_product_identity_id
    JOIN commerce_merchants m ON m.id=e.merchant_id
   WHERE m.external_merchant_id='17698' AND mm.valid_to IS NULL`);
  if(Number(check.rows[0]?.n)!==813)throw Error("MASTER_COVERAGE_INCOMPLETE");
  const logical=result.shadow.logical;
  console.log(JSON.stringify({
   status:"MASTER_OLYMPIKUS_COMPLETED",merchant:"17698",
   olympikusMasterMemberships:813,cohortIdentities:cohortIds.length,
   originalParser:logical.versions?.parser,originalMatcher:logical.versions?.matcher,
   runId:result.runId,reused:result.reused,
   coverageLimited:logical.coverageLimited,
   crossStoreCandidateCoverage:"ALL_IDENTITIES_MATCHING_OLYMPIKUS_BRAND_BLOCK",
   scheduledTiles:(result.shadow as any).catalog?.tiles,
   unevaluatedPairs:logical.unevaluatedPairs.length,
   publication:"NOT_TRIGGERED",commercialWrites:0
  }));
 }finally{await pool.end()}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(err=>{console.error("OLYMPIKUS_MASTER_BLOCKED:",err instanceof Error?err.message:"UNKNOWN");process.exitCode=1});
