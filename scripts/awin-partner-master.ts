/**
 * Generic AWIN Product Master step for a newly staged merchant.
 * Uses the existing historical parser, matcher and append-only Master sidecar.
 * It never rewrites a previously processed merchant or guesses a cross-store merge.
 * Cross-store matching requires the separate historical review/merge workflow.
 */
import "dotenv/config";
import pg from "pg";
import {loadSources,persistIdentities} from "../server/productIdentity/operational";
import type {CatalogCheckpoint} from "../server/productIdentity/catalog";

const args=process.argv.slice(2);
const arg=(key:string)=>args.find(value=>value.startsWith(key+"="))?.slice(key.length+1);
const merchant=arg("--merchant")??"";
const expected=Number(arg("--expected-products"));
const confirm=args.includes("--confirm-master");
if(!/^\d{2,12}$/.test(merchant)||!Number.isSafeInteger(expected)||expected<1)
 throw Error("MASTER_SOURCE_EXPECTATIONS_REQUIRED");
const connection=process.env.AWIN_CATALOG_ADMIN_DATABASE_URL;
const expectedDb=process.env.AWIN_CATALOG_EXPECTED_DATABASE;
const expectedHost=process.env.AWIN_CATALOG_EXPECTED_HOST;
if(!connection||!expectedDb||!expectedHost)throw Error("EXPLICIT_MASTER_DB_REQUIRED");
const url=new URL(connection);
if(url.hostname!==expectedHost||url.pathname.slice(1)!==expectedDb)throw Error("MASTER_DB_TARGET_MISMATCH");
const pool=new pg.Pool({connectionString:connection,max:2,connectionTimeoutMillis:10000});

async function main(){
 const client=await pool.connect();
 let identities:string[]=[];
 try{
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const target=(await client.query("SELECT current_database() db,current_user role")).rows[0];
  if(target.db!==expectedDb||target.role!=="postgres")throw Error("MASTER_ADMIN_IDENTITY_MISMATCH");
  const rows=(await client.query(
   "SELECT id FROM commerce_merchants WHERE external_merchant_id=$1",[merchant])).rows;
  if(rows.length!==1)throw Error("MASTER_MERCHANT_NOT_FOUND");
  const id=String(rows[0].id);
  const sidecar=await client.query(
   "SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",
   [["master_products","product_identity_runs","product_identity_decisions","product_master_memberships","product_identity_jobs"]]);
  if(Number(sidecar.rows[0].n)!==5)throw Error("MASTER_SCHEMA_0013_REQUIRED");
  const sources=await loadSources(client);
  identities=sources.filter(x=>x.merchantId===id).map(x=>x.id).sort();
  if(identities.length!==expected||new Set(identities).size!==expected)throw Error("MASTER_IDENTITY_COUNT_MISMATCH");
  const active=(await client.query(
   "SELECT external_product_identity_id FROM product_master_memberships WHERE valid_to IS NULL AND external_product_identity_id=ANY($1::text[])",
   [identities])).rows;
  const present=new Set(active.map(x=>String(x.external_product_identity_id)));
  if(present.size===expected){
   await client.query("ROLLBACK");
   console.log(JSON.stringify({status:"ALREADY_COMPLETED",merchant,identities:expected,otherMerchantWrites:0}));
   return;
  }
  if(present.size!==0)throw Error("MASTER_PARTIAL_COVERAGE_REQUIRES_REVIEW");
  const crossBefore=Number((await client.query(
   "SELECT count(*)::int n FROM product_master_memberships mm JOIN external_product_identities e ON e.id=mm.external_product_identity_id WHERE e.merchant_id<>$1",
   [id])).rows[0].n);
  await client.query("ROLLBACK");
  if(!confirm){
   console.log(JSON.stringify({status:"READ_ONLY_MASTER_PREFLIGHT",merchant,identities:expected,
    previouslyProcessed:0,otherMerchantMembershipBaseline:crossBefore}));
   return;
  }
  const tileCache=new Map<string,Awaited<ReturnType<NonNullable<CatalogCheckpoint["load"]>>>>();
  const checkpoint:CatalogCheckpoint={
   tileSize:500,
   async load(key){return tileCache.get(key)??null;},
   async save(key,tile){tileCache.set(key,tile);}
  };
  const output=await persistIdentities(pool,identities,{},checkpoint);
  const verified=(await pool.query(
   "SELECT count(DISTINCT mm.external_product_identity_id)::int n FROM product_master_memberships mm JOIN external_product_identities e ON e.id=mm.external_product_identity_id WHERE e.merchant_id=(SELECT id FROM commerce_merchants WHERE external_merchant_id=$1) AND mm.valid_to IS NULL",
   [merchant])).rows[0].n;
  const crossAfter=Number((await pool.query(
   "SELECT count(*)::int n FROM product_master_memberships mm JOIN external_product_identities e ON e.id=mm.external_product_identity_id WHERE e.merchant_id<>(SELECT id FROM commerce_merchants WHERE external_merchant_id=$1)",
   [merchant])).rows[0].n);
  if(Number(verified)!==expected||crossAfter!==crossBefore)throw Error("MASTER_POST_COMMIT_AUDIT_FAILED");
  console.log(JSON.stringify({status:"MASTER_PARTNER_COMPLETED",merchant,identities:expected,
   runId:output.runId,reused:output.reused,coverageLimited:output.shadow.logical.coverageLimited,
   unmatchedCandidates:output.shadow.logical.unevaluatedPairs.length,
   otherMerchantWrites:0,crossStoreMatching:"PENDING_REVIEW_NOT_ASSUMED"}));
 }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}
 finally{client.release();await pool.end()}
}
void main().catch(e=>{console.error(e instanceof Error?e.message:"PARTNER_MASTER_FAILED");process.exitCode=1});
