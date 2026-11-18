/** Admin-only AWIN upload, audit and optional transactional catalog staging. */
import {Router,raw,type RequestHandler} from "express";
import {PostgresAwinRepository} from "../integrations/awin/repository";
import {createHash} from "node:crypto";
import {createGunzip} from "node:zlib";
import {Readable,Transform} from "node:stream";

import {mkdir,rename,writeFile,unlink,stat} from "node:fs/promises";
import {homedir} from "node:os";
import {join} from "node:path";
import {parseAwinCsv} from "../integrations/awin/csv";
import {normalizeAwinItem,isInvalidAwinItem} from "../integrations/awin/normalize";
import {assessAwinCatalogCandidate} from "../integrations/awin/catalogCandidate";

const MAX_GZIP=20*1024*1024,MAX_UNCOMPRESSED=160*1024*1024,MAX_ROWS=100000;
function enabled(env:NodeJS.ProcessEnv){
 return env.NODE_ENV!=="production"&&Boolean(env.UPPULSE_CURATOR_ADMIN_EMAILS?.trim());
}
type AdminResolver=(id:string)=>Promise<{email:string;isActive:boolean}|undefined>;
function adminAuthorization(resolveUser?:AdminResolver):RequestHandler{return async(req,res,next)=>{
 if(!enabled(process.env))return res.status(503).json({code:"ADMIN_ACCESS_NOT_CONFIGURED",message:"Configure UPPULSE_CURATOR_ADMIN_EMAILS com os e-mails autorizados; a existência da tela não comprova permissão."});
 const origin=req.get("origin"),host=req.get("host");
 let sameOrigin=false;
 try{sameOrigin=Boolean(origin&&host&&new URL(origin).host===host)}catch{}
 if(req.method!=="GET"&&!sameOrigin)return res.status(403).json({code:"SAME_ORIGIN_REQUIRED"});
 if(!req.session?.userId)return res.status(401).json({code:"LOGIN_REQUIRED",message:"Entre na sua conta administrativa para importar feeds."});
 try{
  const user=await (resolveUser?resolveUser(req.session.userId):(await import("../auth/userRepository")).userRepository.findActiveById(req.session.userId));
  const admins=(process.env.UPPULSE_CURATOR_ADMIN_EMAILS||"").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(!user||!admins.includes(user.email.toLowerCase()))return res.status(403).json({code:"ADMIN_PERMISSION_REQUIRED",message:"Sua conta não possui permissão para administrar feeds."});
  next();
 }catch(e){next(e)}
}}

function bucket(list:Record<string,number>,value:string){list[value]=(list[value]??0)+1}
function limiter():Transform{
 let total=0;return new Transform({transform(chunk,_enc,done){total+=chunk.length;done(total>MAX_UNCOMPRESSED?new Error("FEED_DECOMPRESSED_SIZE_LIMIT"):null,chunk)}});
}
export function createAwinFeedUploadRouter(resolveUser?:AdminResolver){
 const router=Router();
 const authorize=adminAuthorization(resolveUser);
 router.get("/status",authorize,(_req,res)=>res.json({enabled:true,maxFileBytes:MAX_GZIP,mode:"HOMOLOGATION_ONLY",publication:false,staging:Boolean(process.env.DATABASE_URL)}));
 router.post("/upload",authorize,raw({type:"application/gzip",limit:MAX_GZIP}),async(req,res)=>{
  const data=req.body;
  if(!Buffer.isBuffer(data)||data.length<20||data.length>MAX_GZIP||data[0]!==0x1f||data[1]!==0x8b)
   return res.status(400).json({code:"GZIP_REQUIRED",message:"Envie o feed original .csv.gz da AWIN."});
  let merchant="",feedId="";
  const merchants=new Set<string>(),feeds=new Set<string>();
  const filename=req.get("x-awin-file-name")??"";
  const filenameIds=filename.match(/^(\d{2,12})-(\d{2,12})-/);
  const issues:Array<{row:number;reason:string;name:string}>=[];
  const MAX_ISSUES=300;
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
    const issue=(reason:string)=>{if(issues.length<MAX_ISSUES)issues.push({row:row.rowNumber,reason,name});};
    const item=normalizeAwinItem(row,{feedId});
    if(isInvalidAwinItem(item)){stats.invalid++;for(const reason of item.reasons){bucket(stats.reasons,"RAW_"+reason);issue("RAW_"+reason)}continue}
    stats.normalized++;
    const result=assessAwinCatalogCandidate(item);
    bucket(stats.priceStates,result.price.status);
    bucket(stats.taxonomy,result.taxonomy.universe);
    bucket(stats.eligibility,result.eligibility.status);
    for(const reason of result.eligibility.reasons)if(reason!=="minimum_requirements_met"){bucket(stats.reasons,reason);if(result.eligibility.status!=="IN_SCOPE_CONFIRMED")issue(reason)}
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
   const accepted=stats.eligibility.IN_SCOPE_CONFIRMED??0;
   const imported=0;
   // Import is a separate explicit action from upload; the audit is retained for review.
   return res.status(201).json({status:"RECEIVED_AND_AUDITED",merchant,feedId,
    storedName:filename,sha256:hash,stats,issues,issuesTruncated:issues.length>=MAX_ISSUES,
    accepted,discarded:stats.eligibility.OUT_OF_SCOPE_CONFIRMED??0,
    review:stats.eligibility.REVIEW_REQUIRED??0,imported,published:0,
    canProcess:Boolean(process.env.DATABASE_URL),nextAction:"PROCESS_ACCEPTED"});

  }catch(e){return res.status(422).json({code:"FEED_ANALYSIS_FAILED",message:"Feed inválido, muito grande ou incompatível. Nenhum produto foi importado."})}
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
