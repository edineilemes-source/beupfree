/** Future execution (DATABASE_URL supplied externally; never loaded here):
 * node --import tsx scripts/filters-v3-colors-real-audit.ts [--output=/tmp/audit.json]
 * Importing this module does not inspect environment or connect.
 */
import { pathToFileURL } from "node:url";
import { resolve, dirname, basename } from "node:path";
import { writeFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { auditColors, AuditError, safeError, type ClientSettings } from "./filters-v3-colors-real-audit/executor";

export function outputPath(args:string[]) {
  if(args.length>1 || (args[0] && !args[0].startsWith("--output="))) throw new AuditError("INVALID_ARGUMENTS");
  const value=args[0]?.slice("--output=".length)??"/tmp/uppulse-filters-v3-colors-real-audit.json";
  if(!value.trim() || !value.endsWith(".json")) throw new AuditError("INVALID_ARGUMENTS");
  return resolve(value);
}
export async function writeJsonAtomic(path:string, report:Record<string,unknown>) {
  const serialized=JSON.stringify(report,null,2)+"\n";
  if(Buffer.byteLength(serialized,"utf8")>25*1024*1024) throw new AuditError("OUTPUT_LIMIT_EXCEEDED");
  const temporary=resolve(dirname(path),`.${basename(path)}.${randomUUID()}.tmp`);
  let created=false;
  try {
    await writeFile(temporary,serialized,{encoding:"utf8",mode:0o600,flag:"wx"});
    created=true;await rename(temporary,path);
  } finally {if(created) await unlink(temporary).catch(()=>undefined);}
}
// Build explicit driver config rather than allowing pg to fall back to PGUSER,
// PGPASSWORD, .pgpass or connection-string options that override the safety settings.
export function clientOptions(settings:ClientSettings) {
  try {
    const url=new URL(settings.connectionString);
    if(!["postgres:","postgresql:"].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length<2) {
      throw new AuditError("INVALID_ARGUMENTS");
    }
    if([...url.searchParams.keys()].some(key=>key!=="sslmode")) throw new AuditError("INVALID_ARGUMENTS");
    const sslmode=url.searchParams.get("sslmode")??"disable";
    if(!["disable","require","verify-full"].includes(sslmode)) throw new AuditError("INVALID_ARGUMENTS");
    const {connectionString:_,...safetySettings}=settings;
    const password=decodeURIComponent(url.password);
    return {...safetySettings,host:url.hostname,port:Number(url.port||5432),
      user:decodeURIComponent(url.username),database:decodeURIComponent(url.pathname.slice(1)),
      password:async()=>password,ssl:sslmode==="disable"?false:{rejectUnauthorized:true}};
  } catch {throw new AuditError("INVALID_ARGUMENTS");}
}
async function main() {
  try {
    const output=outputPath(process.argv.slice(2));
    // This is the only credential entry point, reached only on explicit CLI execution.
    const environment={DATABASE_URL:process.env.DATABASE_URL};
    await auditColors(environment, settings=>{
      // Client construction is lazy. No dotenv, fallback secret, pool or second connection.
      return new Client(clientOptions(settings));
    },report=>writeJsonAtomic(output,report));
    console.log("UPPULSE_COLOR_AUDIT_SAVED");
  } catch(error) {console.error(safeError(error));process.exitCode=1;}
}
// pg has no connection side effect on import. Construction happens only in the injected factory.
import { Client } from "pg";
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) void main();
