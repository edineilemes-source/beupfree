/**
 * Admin-only AWIN file intake (homologation). Does not import or touch database.
 * Feature is disabled by default, and always disabled in production.
 * Requires an independently configured high-entropy administrator token.
 */
import {Router,raw,type RequestHandler} from "express";
import {createHash,timingSafeEqual} from "node:crypto";
import {createGunzip} from "node:zlib";
import {Readable,Transform} from "node:stream";
import {mkdir,rename,writeFile,unlink,stat} from "node:fs/promises";
import {homedir} from "node:os";
import {join} from "node:path";
import {parseAwinCsv} from "../integrations/awin/csv";
import {normalizeAwinItem,isInvalidAwinItem} from "../integrations/awin/normalize";
import {assessAwinCatalogCandidate} from "../integrations/awin/catalogCandidate";

const MAX_GZIP=20*1024*1024,MAX_UNCOMPRESSED=160*1024*1024,MAX_ROWS=100000;
function enabled(env:NodeJS.ProcessEnv){return env.NODE_ENV!=="production"&&env.UPPULSE_FEED_UPLOAD_ENABLED==="true"&&(env.UPPULSE_FEED_UPLOAD_TOKEN?.length??0)>=32}
function equalSafe(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function bucket(list:Record<string,number>,value:string){list[value]=(list[value]??0)+1}
function limiter():Transform{
 let total=0;return new Transform({transform(chunk,_enc,done){total+=chunk.length;done(total>MAX_UNCOMPRESSED?new Error("FEED_DECOMPRESSED_SIZE_LIMIT"):null,chunk)}});
}
const authorize:RequestHandler=(req,res,next)=>{
 if(!enabled(process.env))return res.status(503).json({code:"FEED_UPLOAD_NOT_CONFIGURED",message:"Upload administrativo desabilitado neste ambiente."});
 const origin=req.get("origin");const host=req.get("host");
 let sameOrigin=false;try{sameOrigin=Boolean(origin&&host&&new URL(origin).host===host)}catch{sameOrigin=false}
 if(!sameOrigin)return res.status(403).json({code:"SAME_ORIGIN_REQUIRED"});
 const supplied=req.get("x-uppulse-admin-token")??"";
 if(!equalSafe(supplied,process.env.UPPULSE_FEED_UPLOAD_TOKEN!))return res.status(403).json({code:"ADMIN_CREDENTIAL_REQUIRED"});
 next();
};
export function createAwinFeedUploadRouter(){
 const router=Router();
 router.get("/status",(_req,res)=>res.json({enabled:enabled(process.env),maxFileBytes:MAX_GZIP,mode:"HOMOLOGATION_ONLY",publication:false}));
 router.post("/upload",authorize,raw({type:"application/gzip",limit:MAX_GZIP}),async(req,res)=>{
  const data=req.body;
  if(!Buffer.isBuffer(data)||data.length<20||data.length>MAX_GZIP||data[0]!==0x1f||data[1]!==0x8b)
   return res.status(400).json({code:"GZIP_REQUIRED",message:"Envie o feed original .csv.gz da AWIN."});
  const merchant=req.get("x-awin-merchant-id")??"",feedId=req.get("x-awin-feed-id")??"";
  if(!/^\d{2,12}$/.test(merchant)||!/^\d{2,12}$/.test(feedId))
   return res.status(400).json({code:"SOURCE_IDS_REQUIRED"});
  const hash=createHash("sha256").update(data).digest("hex");
  const stats={rows:0,normalized:0,invalid:0,merchantMismatch:0,feedMismatch:0,
   priceStates:{} as Record<string,number>,taxonomy:{} as Record<string,number>,
   eligibility:{} as Record<string,number>,reasons:{} as Record<string,number>};
  try{
   const stream=Readable.from([data]).pipe(createGunzip()).pipe(limiter());
   for await(const row of parseAwinCsv(stream)){
    stats.rows++;if(stats.rows>MAX_ROWS)throw new Error("FEED_ROW_LIMIT");
    if(row.raw.merchant_id!==merchant){stats.merchantMismatch++;continue;}
    if(row.raw.data_feed_id&&row.raw.data_feed_id!==feedId){stats.feedMismatch++;continue;}
    const item=normalizeAwinItem(row,{feedId});
    if(isInvalidAwinItem(item)){stats.invalid++;for(const reason of item.reasons)bucket(stats.reasons,"RAW_"+reason);continue}
    stats.normalized++;
    const result=assessAwinCatalogCandidate(item);
    bucket(stats.priceStates,result.price.status);
    bucket(stats.taxonomy,result.taxonomy.universe);
    bucket(stats.eligibility,result.eligibility.status);
    for(const reason of result.eligibility.reasons)if(reason!=="minimum_requirements_met")bucket(stats.reasons,reason);
   }
   if(stats.rows===0||stats.merchantMismatch||stats.feedMismatch)return res.status(422).json({code:"FEED_SOURCE_MISMATCH",stats});
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
   return res.status(201).json({status:"RECEIVED_AND_AUDITED",merchant,feedId,
    storedName:filename,sha256:hash,stats,imported:0,published:0,
    nextAction:"STAGING_APPROVAL_REQUIRED"});
  }catch(e){return res.status(422).json({code:"FEED_ANALYSIS_FAILED",message:"Feed inválido, muito grande ou incompatível. Nenhum produto foi importado."})}
 });
 return router;
}
