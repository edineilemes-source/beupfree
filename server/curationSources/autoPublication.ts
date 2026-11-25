/**
 * Curadoria -> publication on audited homologation clone.
 * The upload/process endpoint is the ONLY trigger. This module does not import
 * feed rows, alter commercial rules, or allow arbitrary jobs/command arguments.
 */
import {createHash} from "node:crypto";
import {spawn} from "node:child_process";
import {readFile,open,mkdir,stat} from "node:fs/promises";
import {homedir} from "node:os";
import {resolve,join} from "node:path";

export type PublicationStatus="QUEUED"|"RUNNING"|"COMPLETED"|"BLOCKED";
export type PublicationJob={
 status:PublicationStatus; merchant:string;feedId:string;sha256:string;
 phase:string;updatedAt:string;published:number;
 result?:{status:string;merchant:string;feed:string;availableSearchProducts?:number;catalogTotal?:number};
 reason?:string;
};
type Source={merchant:string;feedId:string;sha256:string};
const ids=/^\d{2,12}$/;
const hash=/^[a-f0-9]{64}$/;
const now=()=>new Date().toISOString();
export const publicationJobKey=(source:Source)=>{
 if(!ids.test(source.merchant)||!ids.test(source.feedId)||!hash.test(source.sha256))
  throw Error("PUBLICATION_SOURCE_INVALID");
 return source.merchant+"-"+source.feedId+"-"+source.sha256;
};
function dbIsAuditedClone(value:string|undefined){
 if(!value)return false;
 try{
  const db=new URL(value);
  return (db.protocol==="postgresql:"||db.protocol==="postgres:")&&
   db.hostname==="127.0.0.1"&&db.port==="5436"&&db.pathname==="/uppulse_catalog";
 }catch{return false}
}
export function publicationEnabled(env:NodeJS.ProcessEnv=process.env){
 return env.NODE_ENV==="development"&&env.PUBLIC_DEMO_MODE==="false"&&
  env.UPPULSE_CURATOR_AUTO_PUBLISH==="true"&&env.UPPULSE_PUBLIC_CATALOG_APPROVED==="true"&&
  env.PORT==="5013"&&dbIsAuditedClone(env.DATABASE_URL)&&
  /^[0-9a-f]{40}$/.test(env.UPPULSE_PREVIEW_SOURCE_SHA||"");
}
export function publicationDirectories(env:NodeJS.ProcessEnv=process.env){
 return {
  jobs:env.UPPULSE_CURATOR_JOB_DIR||join(homedir(),".local","share","uppulse","curator-publications"),
  inbox:env.UPPULSE_FEED_INBOX_DIR||join(homedir(),".local","share","uppulse","awin-inbox")
 };
}
function stateFile(source:Source,env:NodeJS.ProcessEnv=process.env){
 return join(publicationDirectories(env).jobs,publicationJobKey(source)+".json");
}
export async function getPublicationJob(source:Source,env:NodeJS.ProcessEnv=process.env):Promise<PublicationJob|null>{
 const path=stateFile(source,env);
 try{
  const obj=JSON.parse(await readFile(path,"utf8"));
  if(obj.merchant!==source.merchant||obj.feedId!==source.feedId||obj.sha256!==source.sha256||
     !["QUEUED","RUNNING","COMPLETED","BLOCKED"].includes(obj.status))
   throw Error("PUBLICATION_JOB_INVALID");
  return obj as PublicationJob;
 }catch(error:any){
  if(error?.code==="ENOENT")return null;
  throw error;
 }
}
export async function verifyStagedSource(source:Source,env:NodeJS.ProcessEnv=process.env){
 const {inbox}=publicationDirectories(env);
 const filename=source.merchant+"-"+source.feedId+"-"+source.sha256.slice(0,16)+".csv.gz";
 const file=join(inbox,filename);
 const metadata=await stat(file);
 if(!metadata.isFile()||metadata.size<20||metadata.size>20*1024*1024)
  throw Error("PUBLICATION_FEED_FILE_INVALID");
 const content=await readFile(file);
 if(createHash("sha256").update(content).digest("hex")!==source.sha256)
  throw Error("PUBLICATION_FEED_HASH_MISMATCH");
 return file;
}
type Dispatch=(source:Source)=>void;
function startWorker(source:Source){
 // Preview runs from a read-only, immutable GitHub archive. Scripts stay on
 // that source snapshot, while source data and the job journal stay outside it.
 const worker=resolve(process.cwd(),"scripts","awin-curadoria-publish-worker.py");
 const snapshot=process.env.UPPULSE_PREVIEW_SOURCE_SHA||"";
 const args=[worker,"--merchant="+source.merchant,"--feed-id="+source.feedId,
  "--sha256="+source.sha256,"--source-sha="+snapshot];
 const child=spawn("python3",args,{
  cwd:process.cwd(),env:{...process.env,
   UPPULSE_DISABLE_EXTERNAL_JOBS:"true",RESEARCH_PAID_ENABLED:"false"},
  detached:true,stdio:"ignore"
 });
 child.on("error",error=>{
  // Worker startup failure is visible through an expired QUEUED job.
  console.error("AWIN_CURATOR_WORKER_SPAWN_FAILED",(error as NodeJS.ErrnoException).code||"SPAWN_ERROR");
 });
 child.unref();
}
export async function startAutomaticPublication(
 source:Source,options:{env?:NodeJS.ProcessEnv;dispatch?:Dispatch}={}
):Promise<PublicationJob>{
 const env=options.env||process.env;
 if(!publicationEnabled(env))throw Error("AUTOMATIC_PUBLICATION_NOT_ALLOWED_ON_THIS_ENVIRONMENT");
 const {jobs}=publicationDirectories(env);
 await verifyStagedSource(source,env);
 await mkdir(jobs,{recursive:true,mode:0o700});
 const filename=stateFile(source,env);
 const initial:PublicationJob={...source,status:"QUEUED",phase:"RECEIVED_AND_STAGED",
  updatedAt:now(),published:0};
 try{
  const file=await open(filename,"wx",0o600);
  try{await file.writeFile(JSON.stringify(initial));}
  finally{await file.close();}
 }catch(error:any){
  if(error?.code!=="EEXIST")throw error;
  // Idempotent: duplicate clicks, browser refreshes or simultaneous requests
  // must not start the commercial pipeline twice.
  const existing=await getPublicationJob(source,env);
  if(!existing)throw Error("PUBLICATION_JOB_UNREADABLE");
  return existing;
 }
 try{(options.dispatch||startWorker)(source);}
 catch{
  // Staging remains valid; make failure visible rather than leaving a
  // permanently queued job when the worker cannot be started.
  const failed:PublicationJob={...initial,status:"BLOCKED",phase:"REQUIRES_REVIEW",
   reason:"PUBLICATION_JOB_DISPATCH_FAILED",updatedAt:now()};
  const {writeFile,rename}=await import("node:fs/promises");
  const temporary=filename+"."+process.pid+".tmp";
  await writeFile(temporary,JSON.stringify(failed),{mode:0o600,flag:"wx"});
  await rename(temporary,filename);
  return failed;
 }
 return initial;
}
