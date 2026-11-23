/** Admin-only AWIN upload, audit and optional transactional catalog staging. */
import {Router,raw,type RequestHandler} from "express";
import {PostgresAwinRepository} from "../integrations/awin/repository";
import {createHash} from "node:crypto";
import {createGunzip} from "node:zlib";
import {Readable,Transform} from "node:stream";

import {mkdir,rename,writeFile,unlink,stat,readFile} from "node:fs/promises";
import {homedir} from "node:os";
import {readFileSync,statSync} from "node:fs";
import {join} from "node:path";
import {parseAwinCsv} from "../integrations/awin/csv";
import {normalizeAwinItem,isInvalidAwinItem} from "../integrations/awin/normalize";
import {assessAwinCatalogCandidate} from "../integrations/awin/catalogCandidate";
import {masterPipelineCoverage} from "./masterPipeline";
import {VERSIONS} from "../productIdentity/contracts";
import {masterParserPreview} from "./masterParserPreview";
import {listRegisteredStores} from "./storeRegistry";
import {decideAutomaticCuration} from "./automatedDecision";

const MAX_GZIP=20*1024*1024,MAX_UNCOMPRESSED=160*1024*1024,MAX_ROWS=100000;
function adminIds(env:NodeJS.ProcessEnv):string[]{
 const fromEnv=(env.UPPULSE_CURATOR_ADMIN_USER_IDS??"").split(/[\s,]+/).filter(Boolean);
 let fromFile:string[]=[];
 try{
  const file=join(homedir(),".local","share","uppulse","curator-admin-user-ids");
  const info=statSync(file);
  if((info.mode&0o077)===0&&info.size<=4096)
   fromFile=readFileSync(file,"utf8").split(/[\s,]+/).filter(Boolean);
 }catch{}
 return [...new Set([...fromEnv,...fromFile].filter(id=>/^[a-zA-Z0-9_-]{2,128}$/.test(id)))];
}
function temporaryNoLogin(env:NodeJS.ProcessEnv){
 return env.NODE_ENV==="development"&&env.PUBLIC_DEMO_MODE==="false"&&
  env.UPPULSE_CURATOR_TEST_NO_AUTH==="true";
}
function enabled(env:NodeJS.ProcessEnv){return temporaryNoLogin(env)||adminIds(env).length>0}
type AdminResolver=(id:string)=>Promise<{id:string;email:string;isActive:boolean}|undefined>;
type AuditPool={connect:()=>Promise<{query:(sql:string,params?:unknown[])=>Promise<{rows:any[]}>;release:()=>void}>};
function adminAuthorization(resolveUser?:AdminResolver):RequestHandler{return async(req,res,next)=>{
 if(!enabled(process.env))return res.status(503).json({code:"ADMIN_ACCESS_NOT_CONFIGURED",message:"Importação desabilitada neste ambiente."});
 const origin=req.get("origin"),host=req.get("host");
 let sameOrigin=false;
 try{sameOrigin=Boolean(origin&&host&&new URL(origin).host===host)}catch{}
 if(req.method!=="GET"&&!sameOrigin)return res.status(403).json({code:"SAME_ORIGIN_REQUIRED"});
 if(temporaryNoLogin(process.env))return next();
 if(!req.session?.userId)return res.status(401).json({code:"LOGIN_REQUIRED",message:"Entre na sua conta administrativa para importar feeds."});
 try{
  const user=await (resolveUser?resolveUser(req.session.userId):(await import("../auth/userRepository")).userRepository.findActiveById(req.session.userId));
  const admins=adminIds(process.env);
  if(!user||!user.isActive||user.id!==req.session.userId||!admins.includes(user.id))return res.status(403).json({code:"ADMIN_PERMISSION_REQUIRED",message:"Sua conta não possui permissão para administrar feeds."});
  next();
 }catch(e){next(e)}
}}

function bucket(list:Record<string,number>,value:string){list[value]=(list[value]??0)+1}
function limiter():Transform{
 let total=0;return new Transform({transform(chunk,_enc,done){total+=chunk.length;done(total>MAX_UNCOMPRESSED?new Error("FEED_DECOMPRESSED_SIZE_LIMIT"):null,chunk)}});
}
export function createAwinFeedUploadRouter(resolveUser?:AdminResolver, auditPool?:AuditPool){
 const router=Router();
 const authorize=adminAuthorization(resolveUser);
 router.get("/status",authorize,(_req,res)=>res.json({enabled:true,maxFileBytes:MAX_GZIP,mode:"HOMOLOGATION_ONLY",publication:false,staging:Boolean(process.env.DATABASE_URL),temporaryAccess:temporaryNoLogin(process.env)}));
 router.post("/upload",authorize,raw({type:"application/gzip",limit:MAX_GZIP}),async(req,res)=>{
  const data=req.body;
  if(!Buffer.isBuffer(data)||data.length<20||data.length>MAX_GZIP||data[0]!==0x1f||data[1]!==0x8b)
   return res.status(400).json({code:"GZIP_REQUIRED",message:"Envie o feed original .csv.gz da AWIN."});
  let merchant="",feedId="";
  const merchants=new Set<string>(),feeds=new Set<string>();
  const filename=req.get("x-awin-file-name")??"";
  const filenameIds=filename.match(/^(\d{2,12})-(\d{2,12})-/);
  const issues:Array<{row:number;reason:string;name:string}>=[];
  const masterReviews:Array<{row:number;reason:string;name:string;productKey:string}>=[];
  const masterSummary={inspected:0,unresolved:0,stageCandidates:0,byReason:{} as Record<string,number>,parserVersion:VERSIONS.parser};
  const PAGE_SIZE=300;
  const hash=createHash("sha256").update(data).digest("hex");
  const stats={rows:0,normalized:0,invalid:0,merchantMismatch:0,feedMismatch:0,
   priceStates:{} as Record<string,number>,taxonomy:{} as Record<string,number>,
   eligibility:{} as Record<string,number>,reasons:{} as Record<string,number>};
  try{
   const stream=Readable.from([data]).pipe(createGunzip()).pipe(limiter());
   for await(const row of parseAwinCsv(stream)){
    stats.rows++;if(stats.rows>MAX_ROWS)throw new Error("FEED_ROW_LIMIT");
    if(row.raw.merchant_id?.trim())merchants.add(row.raw.merchant_id.trim());
    if(row.raw.data_feed_id?.trim())feeds.add(row.raw.data_feed_id.trim());
    const name=row.raw.product_name??"(sem nome)";
    const rowReasons:string[]=[];
    const issue=(reason:string)=>{rowReasons.push(reason)};
    const recordIssues=()=>{if(rowReasons.length)issues.push({row:row.rowNumber,reason:[...new Set(rowReasons)].join(" · "),name:name.slice(0,300)})};
    const item=normalizeAwinItem(row,{feedId});
    if(isInvalidAwinItem(item)){stats.invalid++;for(const reason of item.reasons){bucket(stats.reasons,"RAW_"+reason);issue("RAW_"+reason)}recordIssues();continue}
    stats.normalized++;
    const result=assessAwinCatalogCandidate(item);
    // Existing original Product Master parser runs for every normalized feed row.
    // Ambiguity is recorded separately; matching is done by the historical sidecar,
    // never guessed from this first-stage feed inspection.
    const automatic=decideAutomaticCuration(item);
    masterSummary.inspected++;
    if(automatic.action==="STAGE")masterSummary.stageCandidates++;
    if(automatic.master.ambiguities.length){
     masterSummary.unresolved++;
     for(const reason of automatic.master.ambiguities)bucket(masterSummary.byReason,reason);
     masterReviews.push({row:row.rowNumber,reason:automatic.master.ambiguities.join(" · "),
      name:name.slice(0,300),productKey:automatic.productKey});
    }
    bucket(stats.priceStates,result.price.status);
    bucket(stats.taxonomy,result.taxonomy.universe);
    bucket(stats.eligibility,result.eligibility.status);
    for(const reason of result.eligibility.reasons)if(reason!=="minimum_requirements_met"){bucket(stats.reasons,reason);if(result.eligibility.status!=="IN_SCOPE_CONFIRMED")issue(reason)}
    recordIssues();
   }
   merchant=[...merchants][0]??"";
   feedId=[...feeds][0]??filenameIds?.[2]??"";
   if(stats.rows===0||merchants.size!==1||feeds.size>1||!/^[0-9]{2,12}$/.test(merchant)||!/^[0-9]{2,12}$/.test(feedId)||
    (filenameIds&&(filenameIds[1]!==merchant||filenameIds[2]!==feedId))){
    return res.status(422).json({code:"FEED_SOURCE_MISMATCH",message:"O arquivo contém fontes divergentes ou não possui identificação válida. Nenhum produto foi gravado.",merchants:[...merchants],feedIds:[...feeds],stats,issues});
   }
   // Outside any git checkout/snapshot; do not overwrite previous imports.
   const root=process.env.UPPULSE_FEED_INBOX_DIR||join(homedir(),".local","share","uppulse","awin-inbox");
   await mkdir(root,{recursive:true,mode:0o700});
   const filename=merchant+"-"+feedId+"-"+hash.slice(0,16)+".csv.gz";
   const destination=join(root,filename);
   const temporary=join(root,"."+filename+"."+process.pid+".tmp");
   try{
    await writeFile(temporary,data,{mode:0o600,flag:"wx"});
    // If a file already exists with this digest, it is an idempotent upload.
    try{await stat(destination);await unlink(temporary);}
    catch(e:any){if(e?.code!=="ENOENT")throw e;await rename(temporary,destination);}
   }catch(e){await unlink(temporary).catch(()=>{});throw e;}
   const reportFile=join(root,filename+".report.json");
   try{await writeFile(reportFile,JSON.stringify({merchant,feedId,sha256:hash,issues,masterReviews,masterSummary}),{mode:0o600,flag:"wx"})}catch(e:any){if(e?.code!=="EEXIST")throw e}
   // Keep previous audit immutable. Historical duplicate uploads may lack the
   // new Product Master diagnostics; write a separately versioned sidecar.
   try{await writeFile(reportFile+".master-v15.json",
    JSON.stringify({merchant,feedId,sha256:hash,masterReviews,masterSummary}),
    {mode:0o600,flag:"wx"})}catch(e:any){if(e?.code!=="EEXIST")throw e}
   const accepted=stats.eligibility.IN_SCOPE_CONFIRMED??0;
   const imported=0;
   // Import is a separate explicit action from upload; the audit is retained for review.
   return res.status(201).json({status:"RECEIVED_AND_AUDITED",merchant,feedId,
    storedName:filename,sha256:hash,stats,issues:issues.slice(0,PAGE_SIZE),issuesTotal:issues.length,issuesPageSize:PAGE_SIZE,
    masterSummary,masterReviews:masterReviews.slice(0,PAGE_SIZE),masterReviewsTotal:masterReviews.length,
    accepted,discarded:stats.eligibility.OUT_OF_SCOPE_CONFIRMED??0,
    review:stats.eligibility.REVIEW_REQUIRED??0,imported,published:0,
    canProcess:Boolean(process.env.DATABASE_URL),nextAction:"PROCESS_ACCEPTED"});

  }catch(e){return res.status(422).json({code:"FEED_ANALYSIS_FAILED",message:"Feed inválido, muito grande ou incompatível. Nenhum produto foi importado."})}
 });
 router.get("/report/:merchant/:feedId/:hash/issues",authorize,async(req,res)=>{
  const {merchant,feedId,hash}=req.params;
  if(!/^[0-9]{2,12}$/.test(merchant)||!/^[0-9]{2,12}$/.test(feedId)||!/^[a-f0-9]{64}$/.test(hash))
   return res.status(400).json({code:"REPORT_ARGUMENTS_INVALID"});
  const page=Number(req.query.page??1),pageSize=300;
  if(!Number.isSafeInteger(page)||page<1||page>334)return res.status(400).json({code:"REPORT_PAGE_INVALID"});
  const root=process.env.UPPULSE_FEED_INBOX_DIR||join(homedir(),".local","share","uppulse","awin-inbox");
  const name=merchant+"-"+feedId+"-"+hash.slice(0,16)+".csv.gz.report.json";
  try{
   const report=JSON.parse(await readFile(join(root,name),"utf8"));
   if(report.sha256!==hash||report.merchant!==merchant||report.feedId!==feedId||!Array.isArray(report.issues))return res.status(409).json({code:"REPORT_IDENTITY_MISMATCH"});
   return res.json({page,pageSize,total:report.issues.length,issues:report.issues.slice((page-1)*pageSize,page*pageSize)});
  }catch{return res.status(404).json({code:"AUDIT_REPORT_NOT_FOUND"})}
 });
 router.get("/stores",authorize,async(_req,res)=>{
  try{
   const pool=auditPool??(await import("../db")).pool;
   const client=await pool.connect();
   try{
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const stores=await listRegisteredStores(client as any);
    await client.query("COMMIT");
    return res.json({stores,total:stores.length,source:"commerce_merchants",readOnly:true});
   }catch(error){await client.query("ROLLBACK").catch(()=>{});throw error}
   finally{client.release()}
  }catch(error){return res.status(503).json({code:"STORE_REGISTRY_UNAVAILABLE",message:"Cadastro de lojas indisponível neste banco."})}
 });
 router.get("/merchant/:merchantId/audit",authorize,async(req,res)=>{
  const merchantId=req.params.merchantId;
  if(!/^[0-9]{2,12}$/.test(merchantId))return res.status(400).json({code:"MERCHANT_ID_INVALID"});
  try{
   const pool=auditPool??(await import("../db")).pool;
   const db=await pool.connect();
   try{
    await db.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tables=["commerce_merchants","commerce_feeds","offers","product_variants","external_product_identities",
      "offer_promotion_evidence","product_catalog_classifications","product_variant_normalizations",
      "catalog_search_products","product_master_memberships","product_identity_jobs"];
    const available=(await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1::text[])",[tables])).rows.map(r=>String(r.table_name));
    const has=(name:string)=>available.includes(name);
    if(!has("commerce_merchants")||!has("offers")||!has("product_variants")){
      await db.query("ROLLBACK");return res.status(409).json({code:"CATALOG_SCHEMA_INCOMPLETE",message:"Tabelas principais do catálogo não encontradas."});
    }
    const merchants=(await db.query("SELECT id,name,external_merchant_id FROM commerce_merchants WHERE external_merchant_id=$1",[merchantId])).rows;
    if(merchants.length!==1){await db.query("ROLLBACK");return res.status(404).json({code:"MERCHANT_NOT_FOUND"});}
    const merchant=merchants[0];
    const run=async(sql:string)=>Number((await db.query(sql,[merchant.id])).rows[0]?.n??0);
    const counts={
     offers:await run("SELECT count(*)::int n FROM offers WHERE merchant_id=$1"),
     distinctProducts:await run("SELECT count(DISTINCT product_id)::int n FROM product_variants WHERE merchant_id=$1"),
     activeOffers:await run("SELECT count(*)::int n FROM offers WHERE merchant_id=$1 AND active=true"),
     identities:has("external_product_identities")?await run("SELECT count(*)::int n FROM external_product_identities WHERE merchant_id=$1"):null,
     stagedIdentities:has("external_product_identities")?await run("SELECT count(*)::int n FROM external_product_identities WHERE merchant_id=$1 AND publication_state='staging'"):null,
     promotionEvidence:has("offer_promotion_evidence")?await run("SELECT count(DISTINCT pe.offer_id)::int n FROM offer_promotion_evidence pe JOIN offers o ON o.id=pe.offer_id WHERE o.merchant_id=$1"):null,
     classifiedProducts:has("product_catalog_classifications")?await run("SELECT count(DISTINCT product_id)::int n FROM product_catalog_classifications WHERE merchant_id=$1"):null,
     eligibleClassifications:has("product_catalog_classifications")?await run("SELECT count(DISTINCT product_id)::int n FROM product_catalog_classifications WHERE merchant_id=$1 AND operational_state='CATALOG_ELIGIBLE'"):null,
     totalVariants:await run("SELECT count(*)::int n FROM product_variants WHERE merchant_id=$1"),
     normalizedVariants:has("product_variant_normalizations")?await run("SELECT count(DISTINCT n.variant_id)::int n FROM product_variant_normalizations n JOIN product_variants v ON v.id=n.variant_id WHERE v.merchant_id=$1"):null,
     masterMemberships:has("product_master_memberships")&&has("external_product_identities")?await run("SELECT count(DISTINCT mm.external_product_identity_id)::int n FROM product_master_memberships mm JOIN external_product_identities e ON e.id=mm.external_product_identity_id WHERE e.merchant_id=$1 AND mm.valid_to IS NULL"):null,
     masterIdentities:has("product_master_memberships")&&has("external_product_identities")?await run("SELECT count(DISTINCT mm.master_product_id)::int n FROM product_master_memberships mm JOIN external_product_identities e ON e.id=mm.external_product_identity_id WHERE e.merchant_id=$1 AND mm.valid_to IS NULL"):null,
     searchProducts:has("catalog_search_products")?await run("SELECT count(*)::int n FROM catalog_search_products WHERE merchant_id=$1 AND catalog_state='CATALOG_ELIGIBLE'"):null,
     availableSearchProducts:has("catalog_search_products")?await run("SELECT count(*)::int n FROM catalog_search_products WHERE merchant_id=$1 AND catalog_state='CATALOG_ELIGIBLE' AND available=true"):null
    };
    await db.query("COMMIT");
    const steps={
      received:counts.offers>0,
      masterCovered:counts.identities!==null&&counts.masterMemberships!==null&&counts.identities>0&&counts.masterMemberships===counts.identities,
      catalogClassified:counts.distinctProducts>0&&counts.classifiedProducts!==null&&counts.classifiedProducts===counts.distinctProducts,
      priceAudited:counts.offers>0&&counts.promotionEvidence!==null&&counts.promotionEvidence===counts.offers,
      projected:counts.searchProducts!==null&&counts.searchProducts>0,
      storeVisibleInFilter:counts.availableSearchProducts!==null&&counts.availableSearchProducts>0
    };
    return res.json({merchant:{name:merchant.name,id:merchant.external_merchant_id},counts,steps,pipeline:masterPipelineCoverage(counts),
      note:"O Produto Mestre exige evidências atuais além da existência de memberships; esta auditoria mede cobertura, não certifica equivalência entre produtos.",
      storeFacetRule:"A loja aparece automaticamente no filtro Loja somente quando há produtos elegíveis e disponíveis na projeção."});
   }catch(e){await db.query("ROLLBACK").catch(()=>{});throw e}
   finally{db.release()}
  }catch(e){return res.status(503).json({code:"MERCHANT_AUDIT_FAILED",message:"Não foi possível verificar todas as etapas do catálogo neste banco."})}
 });
 router.get("/merchant/:merchantId/master-preview",authorize,async(req,res)=>{
  const merchantId=req.params.merchantId;
  if(!/^[0-9]{2,12}$/.test(merchantId))return res.status(400).json({code:"MERCHANT_ID_INVALID"});
  try{
   const pool=auditPool??(await import("../db")).pool;
   const db=await pool.connect();
   try{
    await db.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const rows=(await db.query(`SELECT
      e.id "externalIdentityId",p.id "productId",p.main_name "productName",
      b.name "brandName",v.id "variantId",v.size "sizeRaw",
      v.colour "colorRaw",v.gtin "gtin",v.mpn "mpn"
     FROM commerce_merchants m
     JOIN external_product_identities e ON e.merchant_id=m.id
     JOIN products p ON p.id=e.product_id
     LEFT JOIN brands b ON b.id=p.brand_id
     LEFT JOIN LATERAL (
      SELECT id,size,colour,gtin,mpn FROM product_variants v
      WHERE v.product_id=e.product_id AND v.merchant_id=e.merchant_id
        AND v.provider_id=e.provider_id
      ORDER BY v.id LIMIT 1
     ) v ON TRUE
     WHERE m.external_merchant_id=$1 ORDER BY e.id LIMIT 20`,[merchantId])).rows;
    await db.query("COMMIT");
    return res.json({merchantId,previewOnly:true,limit:20,
     parserVersion:VERSIONS.parser,
     samples:rows.map(masterParserPreview)});
   }catch(error){await db.query("ROLLBACK").catch(()=>{});throw error}
   finally{db.release()}
  }catch(error){return res.status(503).json({code:"MASTER_PREVIEW_UNAVAILABLE",
   message:"Não foi possível executar o parser histórico sobre os dados desta loja."})}
 });
 router.get("/report/:merchant/:feedId/:hash/master-reviews",authorize,async(req,res)=>{
  const {merchant,feedId,hash}=req.params;
  if(!/^[0-9]{2,12}$/.test(merchant)||!/^[0-9]{2,12}$/.test(feedId)||!/^[a-f0-9]{64}$/.test(hash))
   return res.status(400).json({code:"REPORT_ARGUMENTS_INVALID"});
  const page=Number(req.query.page??1),pageSize=300;
  if(!Number.isSafeInteger(page)||page<1||page>334)return res.status(400).json({code:"REPORT_PAGE_INVALID"});
  const root=process.env.UPPULSE_FEED_INBOX_DIR||join(homedir(),".local","share","uppulse","awin-inbox");
  const name=merchant+"-"+feedId+"-"+hash.slice(0,16)+".csv.gz.report.json.master-v15.json";
  try{
   const report=JSON.parse(await readFile(join(root,name),"utf8"));
   if(report.sha256!==hash||report.merchant!==merchant||report.feedId!==feedId||
      !Array.isArray(report.masterReviews))return res.status(409).json({code:"MASTER_REVIEW_REPORT_UNAVAILABLE"});
   return res.json({page,pageSize,total:report.masterReviews.length,
    items:report.masterReviews.slice((page-1)*pageSize,page*pageSize),
    summary:report.masterSummary});
  }catch{return res.status(404).json({code:"MASTER_REVIEW_REPORT_NOT_FOUND"})}
 });
 router.post("/process",authorize,async(req,res)=>{
  const fingerprint=String(req.body?.sha256??"");
  const merchant=String(req.body?.merchant??""),feedId=String(req.body?.feedId??"");
  if(!/^[a-f0-9]{64}$/.test(fingerprint)||!/^[0-9]{2,12}$/.test(merchant)||!/^[0-9]{2,12}$/.test(feedId))
   return res.status(400).json({code:"PROCESS_ARGUMENTS_INVALID"});
  // No public catalogue publication until promotion/regular-price evidence and projection
  // have been verified. Staging is intentional to preserve all previously approved products.
  const root=process.env.UPPULSE_FEED_INBOX_DIR||join(homedir(),".local","share","uppulse","awin-inbox");
  const filename=merchant+"-"+feedId+"-"+fingerprint.slice(0,16)+".csv.gz";
  try{
   const {openGzipFile}=await import("../integrations/awin/input");
   const {readFile}=await import("node:fs/promises");
   const data=await readFile(join(root,filename));
   if(createHash("sha256").update(data).digest("hex")!==fingerprint)return res.status(409).json({code:"FEED_FINGERPRINT_MISMATCH"});
   const {pool}=await import("../db");
   const client=await pool.connect();
   try{
    const status=(await client.query("SELECT count(*)::int AS n FROM products")).rows[0];
    if(Number(status.n)<1)return res.status(409).json({code:"EXISTING_CATALOG_NOT_VERIFIED",message:"O banco conectado não contém o catálogo homologado; nenhuma importação executada."});
   }finally{client.release()}
   let accepted=0,review=0,discarded=0,invalid=0;
   async function* validated(){
    for await(const row of parseAwinCsv(openGzipFile(join(root,filename)))){
     if(row.raw.merchant_id!==merchant||(row.raw.data_feed_id&&row.raw.data_feed_id!==feedId))throw Error("SOURCE_CHANGED");
     const normalized=normalizeAwinItem(row,{feedId});
     if(isInvalidAwinItem(normalized)){invalid++;continue}
     const assessment=assessAwinCatalogCandidate(normalized);
     if(assessment.eligibility.status==="IN_SCOPE_CONFIRMED"){accepted++;yield normalized;}
     else if(assessment.eligibility.status==="OUT_OF_SCOPE_CONFIRMED")discarded++;
     else review++;
    }
   }
   const report=await new PostgresAwinRepository(pool).import(validated(),{feedId,expectedMerchant:merchant});
   return res.json({status:"STAGED_IN_DATABASE",merchant,feedId,accepted,review,discarded,invalid,
    imported:report.created+report.updated,unchanged:report.unchanged,published:0,
    report:{seen:report.seen,created:report.created,updated:report.updated,unchanged:report.unchanged},
    message:"Produtos aprovados foram incorporados ao banco em staging; publicação pública depende da validação de evidências e projeção."});
  }catch(e){
   const code=e instanceof Error?e.message:"PROCESSING_FAILED";
   return res.status(409).json({code:"CATALOG_STAGING_FAILED",message:"Não foi possível incorporar ao catálogo. A transação foi revertida em caso de erro.",detail:code.slice(0,150)});
  }
 });

 return router;
}
