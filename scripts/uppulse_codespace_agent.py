#!/usr/bin/env python3
"""UpPulse Codespaces bridge: allowlisted GitHub Issues, no remote shell."""
import fcntl,json,os,pathlib,re,shutil,signal,subprocess,tempfile,time
from urllib.parse import quote
R=pathlib.Path("/workspaces/uppulse-homologacao/missao9/codigo")
S=pathlib.Path(os.environ.get("UPPULSE_BRIDGE_STATE_DIR",str(pathlib.Path.home()/".local/state/uppulse-bridge")))
S.mkdir(parents=True,exist_ok=True)
VERSION="1.3.5"
REPO="edineilemes-source/beupfree"
BRANCH="feat/uppulse-missao10-supercatalogo"
PORTS={5011,5012,5013,5014,5015}
TESTS=["server/productIntelligence/customerKnowledge.test.ts","server/productIntelligence/technicalPresentation.test.ts","server/productIntelligence/technicalNormalization.test.ts","server/productIntelligence/reportReconciliation.test.ts"]
PROFILES={"basic","unit","build","ui"}
# Only named profiles; never accept an executable command from an issue.
def cmd(args,cwd=R,timeout=150,check=True,**kw):
 p=subprocess.run(args,cwd=cwd,capture_output=True,text=True,timeout=timeout,**kw)
 if check and p.returncode:
  operation="_".join(str(x).upper().replace("-","_") for x in args[:3])
  operation=re.sub(r"[^A-Z0-9_]","",operation)[:65]
  raise RuntimeError("COMMAND_FAILED_"+operation+"_"+str(p.returncode))
 return p.stdout.strip()
def gh(*args):return cmd(["gh",*args],timeout=45)
def report(n,msg):gh("issue","comment",str(n),"--repo",REPO,"--body",msg[:3000])
def seen():
 try:return set(json.loads((S/"done.json").read_text()))
 except (OSError,ValueError):return set()
def mark(n):
 state=seen();state.add(n)
 tmp=S/"done.tmp";tmp.write_text(json.dumps(sorted(state)));tmp.replace(S/"done.json")
def parse(action,body):
 if action in {"STATUS","DIAGNOSTICO","CATALOGO","MASTER_OLYMPIKUS"}:
  if body.strip() not in ("","{}"):raise ValueError("STATUS_DOES_NOT_TAKE_ARGUMENTS")
  return {}
 try:d=json.loads(body)
 except (TypeError,ValueError):raise ValueError("BAD_JSON")
 expected={"commit"} if action=="VALIDAR" else {"commit","port"} if action=="PREVIEW" else {"port"}
 optional={"profile"} if action in {"VALIDAR","PREVIEW"} else set()
 if not isinstance(d,dict) or not (expected<=set(d) and set(d)<=expected|optional):raise ValueError("BAD_PARAMETERS")
 if "profile" in d and (not isinstance(d["profile"],str) or d["profile"] not in PROFILES):raise ValueError("BAD_PROFILE")
 if "commit" in d and (not isinstance(d["commit"],str) or not re.fullmatch(r"[0-9a-f]{40}",d["commit"])):raise ValueError("BAD_SHA")
 if "port" in d and (type(d["port"]) is not int or d["port"] not in PORTS):raise ValueError("BAD_PORT")
 return d
def snapshot(sha):
 cmd(["git","fetch","--no-tags","origin",BRANCH])
 remote=cmd(["git","rev-parse","FETCH_HEAD"])
 cmd(["git","merge-base","--is-ancestor",sha,remote])
 path=pathlib.Path(tempfile.mkdtemp(prefix="uppulse-bridge-",dir="/tmp"))
 try:
  # No checkout, reset, merge, apply or changes to the user's working tree.
  with subprocess.Popen(["git","archive",sha],cwd=R,stdout=subprocess.PIPE) as archive:
   extract=subprocess.run(["tar","-x","-C",str(path)],stdin=archive.stdout,timeout=90)
   if extract.returncode or archive.wait():raise RuntimeError("SNAPSHOT_FAILED")
  modules=R/"node_modules"
  if not modules.is_dir():raise RuntimeError("DEPENDENCIES_MISSING")
  (path/"node_modules").symlink_to(modules,target_is_directory=True)
  return path
 except BaseException:
  shutil.rmtree(path,ignore_errors=True);raise
def validate(path,profile="basic"):
 if profile not in PROFILES:raise ValueError("BAD_PROFILE")
 safe_env=dict(os.environ)
 safe_env.update({"RESEARCH_PAID_ENABLED":"false","RESEARCH_POSTGRES_HOMOLOGATED":"false",
  "UPPULSE_DISABLE_EXTERNAL_JOBS":"true"})
 safe_env.pop("OPENAI_API_KEY",None);safe_env.pop("TAVILY_API_KEY",None)
 cmd(["npm","run","check"],cwd=path,timeout=240,env=safe_env)
 if profile=="basic":
  cmd(["node","--import","tsx","--test",*TESTS],cwd=path,timeout=240,env=safe_env)
 elif profile in {"unit","build","ui"}:
  cmd(["npm","run","test:unit"],cwd=path,timeout=600,env=safe_env)
 if profile in {"build","ui"}:
  cmd(["npm","run","build"],cwd=path,timeout=600,env=safe_env)
 # UI browser testing runs only after PREVIEW starts the local HTTP service.
 return "TypeScript, "+profile+" profile passed"
def process_stamp(pid):
 try:return pathlib.Path("/proc/"+str(pid)+"/stat").read_text().split(") ")[1].split()[19]
 except (OSError,IndexError):return ""
def own(port):
 try:
  d=json.loads((S/("preview-"+str(port)+".json")).read_text())
  return d if process_stamp(d["pid"])==d["start"] and d["start"] else None
 except (OSError,ValueError,KeyError):return None
def catalog_database():
 # No automatic start/stop/recreate. Validate the current live catalog before selecting a DB.
 candidates=("beupfree-catalog-pg17-audit","beupfree-recovery-postgres","beupfree-catalog-pg17")
 verified=[]
 for container in candidates:
  if cmd(["docker","inspect","-f","{{.State.Status}}",container],timeout=10,check=False)!="running":continue
  envlines=cmd(["docker","inspect","--format","{{json .Config.Env}}",container],timeout=10)
  vars=dict(x.split("=",1) for x in json.loads(envlines) if "=" in x)
  username=vars.get("POSTGRES_USER","postgres")
  password=vars.get("POSTGRES_PASSWORD")
  if container=="beupfree-catalog-pg17-audit":
   # Only accept the audited recovery clone from this incident, not an empty
   # PostgreSQL or an arbitrary container that happens to have the same name.
   control=cmd(["docker","exec",container,"pg_controldata","/var/lib/postgresql/data"],timeout=15,check=False)
   if not re.search(r"Database system identifier:\s*7699654111778938913\b",control):continue
   # Clone was started without POSTGRES_PASSWORD because its PGDATA already
   # existed. Reuse the original container's credential, never print it.
   original_env=cmd(["docker","inspect","--format","{{json .Config.Env}}","beupfree-catalog-pg17"],timeout=10,check=False)
   try:original_vars=dict(x.split("=",1) for x in json.loads(original_env) if "=" in x)
   except (ValueError,TypeError):continue
   if original_vars.get("POSTGRES_USER","postgres")!=username:continue
   password=original_vars.get("POSTGRES_PASSWORD")
  if not password:continue
  published=cmd(["docker","port",container,"5432"],timeout=10,check=False).splitlines()
  port=published[0].rsplit(":",1)[-1] if published else ""
  if not port.isdecimal():
   # Container address for an existing Docker bridge; never create a network or port.
   port="5432"
   address=cmd(["docker","inspect","-f","{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",container],timeout=10,check=False)
   if not re.fullmatch(r"(?:[0-9]{1,3}\.){3}[0-9]{1,3}",address):continue
  else:address="127.0.0.1"
  for database in ("uppulse_catalog","postgres"):
   query="SELECT (SELECT count(*) FROM public.products)::bigint, (SELECT count(*) FROM public.offers)::bigint"
   observed=cmd(["docker","exec",container,"psql","-U",username,"-d",database,
    "-X","-A","-t","-F","|","-v","ON_ERROR_STOP=1","-c",query],timeout=20,check=False)
   parts=observed.strip().split("|")
   if len(parts)!=2 or not all(x.isdecimal() for x in parts):continue
   products,offers=map(int,parts)
   if products<1000 or offers<1000:continue
   if container=="beupfree-catalog-pg17-audit":
    # Real recovery was independently inspected and matched exactly:
    # products=33520, offers=102018, search=16945. Fail closed if
    # a different/empty database is mounted at the same container name.
    if database!="uppulse_catalog" or products!=33520 or offers!=102018:continue
    # Preserve the pre-Olympikus catalog exactly while allowing only verified
    # Olympikus rows to be added, up to its 813 distinct products.
    projection=cmd(["docker","exec",container,"psql","-U",username,"-d",database,
     "-X","-A","-t","-F","|","-v","ON_ERROR_STOP=1","-c",
     "SELECT (SELECT count(*) FROM public.catalog_search_products WHERE merchant_id <> "
     "(SELECT id FROM public.commerce_merchants WHERE external_merchant_id='17698')),"
     "(SELECT count(*) FROM public.catalog_search_products WHERE merchant_id = "
     "(SELECT id FROM public.commerce_merchants WHERE external_merchant_id='17698'))"],timeout=20,check=False)
    pieces=projection.strip().split("|")
    if len(pieces)!=2 or not all(v.isdecimal() for v in pieces):continue
    if int(pieces[0])!=16945 or int(pieces[1])>813:continue
   verified.append((container,address,port,database,username,password,products,offers))
 if len(verified)!=1:raise RuntimeError("CATALOG_DATABASE_NOT_UNIQUELY_VERIFIED")
 return verified[0]
def db_url():
 container,address,port,database,username,password,_,_=catalog_database()
 return "postgresql://"+quote(username,safe="")+":"+quote(password,safe="")+"@"+address+":"+port+"/"+database
def serve(sha,port,profile="basic"):
 prior=own(port)
 if prior:
  if prior["commit"]==sha:return "Preview already running on port "+str(port)
  raise RuntimeError("PORT_MANAGED_BY_DIFFERENT_COMMIT")
 if cmd(["ss","-ltnH","sport","=",":"+str(port)],check=False):raise RuntimeError("PORT_OCCUPIED_DO_NOT_KILL")
 path=snapshot(sha)
 validate(path,profile)
 env=dict(os.environ)
 url=db_url()
 env.update({"DATABASE_URL":url,"AWIN_CURATOR_DATABASE_URL":url,
  "UPPULSE_PUBLIC_CATALOG_SOURCE":"operational","UPPULSE_PUBLIC_CATALOG_APPROVED":"true",
  "UPPULSE_DISABLE_EXTERNAL_JOBS":"true","RESEARCH_PAID_ENABLED":"false",
  "RESEARCH_POSTGRES_HOMOLOGATED":"false","PUBLIC_DEMO_MODE":"false",
  "PORT":str(port),"NODE_ENV":"development",
  "UPPULSE_CURATOR_TEST_NO_AUTH":"true"})
 env.pop("TAVILY_API_KEY",None);env.pop("OPENAI_API_KEY",None)
 with (S/("preview-"+str(port)+".log")).open("a") as log:
  proc=subprocess.Popen(["npm","run","dev"],cwd=path,env=env,
   stdout=log,stderr=subprocess.STDOUT,stdin=subprocess.DEVNULL,start_new_session=True)
 stamp=process_stamp(proc.pid)
 (S/("preview-"+str(port)+".json")).write_text(json.dumps({"pid":proc.pid,"start":stamp,"commit":sha,"path":str(path)}))
 for attempt in range(50):
  if proc.poll() is not None:raise RuntimeError("PREVIEW_EXITED")
  try:
   status=cmd(["curl","-fsS","--max-time","2","-o","/dev/null","-w","%{http_code}","http://127.0.0.1:"+str(port)+"/"],timeout=4)
   break
  except RuntimeError:time.sleep(1)
 else:
  raise RuntimeError("PREVIEW_HTTP_TIMEOUT")
 if profile=="ui":
  browser_env=dict(env)
  browser_env["PLAYWRIGHT_BASE_URL"]="http://127.0.0.1:"+str(port)
  browser_env["PLAYWRIGHT_EXTERNAL_SERVER"]="true"
  cmd(["npx","playwright","test","--config=playwright.mission11-ai.config.ts"],
   cwd=path,timeout=600,env=browser_env)
 return "Preview OK HTTP "+status+"; profile "+profile+" passed. Codespaces PORTS -> "+str(port)+" -> Open in Browser"
def stop(port):
 d=own(port)
 if not d:return "No managed process to stop; other ports untouched"
 os.killpg(d["pid"],signal.SIGTERM)
 (S/("preview-"+str(port)+".json")).unlink(missing_ok=True)
 return "Managed preview on "+str(port)+" stopped; no other processes touched"
def execute(action,args):
 if action=="MASTER_OLYMPIKUS":
  container,_,port,database,_,_,products,offers=catalog_database()
  if container!="beupfree-catalog-pg17-audit" or port!="5436" or database!="uppulse_catalog" or products!=33520 or offers!=102018:
   raise RuntimeError("AUDITED_RECOVERY_CLONE_ONLY")
  sha=cmd(["git","ls-remote","origin","refs/heads/"+BRANCH]).split()[0]
  path=snapshot(sha)
  try:
   validate(path,"basic")
   env=dict(os.environ)
   env.update({"DATABASE_URL":db_url(),"UPPULSE_DISABLE_EXTERNAL_JOBS":"true",
    "RESEARCH_PAID_ENABLED":"false","RESEARCH_POSTGRES_HOMOLOGATED":"false"})
   env.pop("OPENAI_API_KEY",None);env.pop("TAVILY_API_KEY",None)
   execution=subprocess.run(["node","--import","tsx","scripts/recover-olympikus-master.ts"],
    cwd=path,env=env,capture_output=True,text=True,timeout=900)
   if execution.returncode:
    # Script prints only a safe controlled marker. Do NOT publish raw stderr,
    # secrets, URLs or SQL errors to the public GitHub issue.
    match=re.search(r"OLYMPIKUS_MASTER_BLOCKED:\s*([A-Z][A-Z0-9_]{3,90})",execution.stderr)
    raise RuntimeError(match.group(1) if match else "OLYMPIKUS_MASTER_EXECUTION_FAILED")
   output=execution.stdout
   # Never include environment variables or database credentials in public issues.
   last=output.splitlines()[-1] if output else ""
   result=json.loads(last)
   if result.get("status") not in {"MASTER_OLYMPIKUS_COMPLETED","ALREADY_COMPLETED"}:
    raise RuntimeError("MASTER_PROCESSING_NOT_CONFIRMED")
   return "Olympikus historical Master: "+json.dumps(result,ensure_ascii=False)[:1500]
  finally:shutil.rmtree(path,ignore_errors=True)
 if action=="CATALOGO":
  try:
   container,_,_,database,username,_,_,_=catalog_database()
   sql=("SELECT 'products',count(*) FROM public.products UNION ALL "
    "SELECT 'offers',count(*) FROM public.offers UNION ALL "
    "SELECT 'catalog_search_products',count(*) FROM public.catalog_search_products")
   out=cmd(["docker","exec",container,"psql","-U",username,"-d",database,
    "-X","-A","-t","-F","=","-v","ON_ERROR_STOP=1","-c",sql],timeout=35)
  except Exception:raise RuntimeError("CATALOG_READ_ONLY_QUERY_UNAVAILABLE")
  return "Catalog counts from verified database "+container+": "+out.replace("\n","; ")[:500]
 if action=="DIAGNOSTICO":
  checks=[]
  for name,argv in [
   ("docker",["docker","info","--format","{{.ServerVersion}}"]),
   ("catalog_db_container",["docker","inspect","-f","{{.State.Status}}","beupfree-catalog-pg17"]),
   ("port_5011",["ss","-ltnH","sport","=",":5011"]),
   ("local_http_5011",["curl","-sS","--max-time","3","-o","/dev/null","-w","%{http_code}","http://127.0.0.1:5011/"])]:
   try:
    value=cmd(argv,timeout=8,check=False)
    checks.append(name+"="+("LISTEN" if name=="port_5011" and value else "FREE" if name=="port_5011" else value[:90] or "NOT_AVAILABLE"))
   except Exception:
    checks.append(name+"=UNAVAILABLE")
  return "Bridge v"+VERSION+" diagnostics (read-only): "+"; ".join(checks)
 if action=="STATUS":
  local=cmd(["git","rev-parse","HEAD"])
  remote=cmd(["git","ls-remote","origin","refs/heads/"+BRANCH]).split()[0]
  dirty=bool(cmd(["git","status","--porcelain","--untracked-files=no"]))
  managed=[p for p in sorted(PORTS) if own(p)]
  return ("Bridge v"+VERSION+" online. GitHub canonical branch: "+BRANCH+
   "; local SHA: "+local[:12]+"; GitHub SHA: "+remote[:12]+
   "; same SHA: "+str(local==remote)+
   "; local tracked changes: "+str(dirty)+
   "; managed preview ports: "+str(managed)+
   ". Agent validates immutable GitHub commits in isolated snapshots; does not modify local checkout.")
 if action=="VALIDAR":
  path=snapshot(args["commit"])
  try:return validate(path,args.get("profile","basic"))+"; snapshot "+args["commit"][:12]
  finally:shutil.rmtree(path,ignore_errors=True)
 if action=="PREVIEW":return serve(args["commit"],args["port"],args.get("profile","basic"))
 if action=="PARAR PREVIEW":return stop(args["port"])
 raise RuntimeError("UNKNOWN_ACTION")
def cycle():
 requests=json.loads(gh("issue","list","--repo",REPO,"--state","open","--limit","100","--json","number,title,author,body"))
 done=seen()
 for item in requests:
  n=item["number"];title=item.get("title","")
  if n in done or item.get("author",{}).get("login","").lower()!="edineilemes-source":continue
  if not title.startswith("[UPPULSE-AGENT] "):continue
  action=title.removeprefix("[UPPULSE-AGENT] ")
  if action not in {"STATUS","DIAGNOSTICO","CATALOGO","MASTER_OLYMPIKUS","VALIDAR","PREVIEW","PARAR PREVIEW"}:continue
  mark(n)
  try:
   args=parse(action,item.get("body") or "")
   report(n,"Task accepted by restricted Codespaces agent.")
   result=execute(action,args)
   report(n,"SUCCESS: "+result)
   gh("issue","close",str(n),"--repo",REPO)
  except Exception as exc:
   # Avoid printing secrets or arbitrary subprocess stderr in public issues.
   report(n,"BLOCKED: "+(str(exc) if re.fullmatch(r"[A-Z0-9_]{3,90}",str(exc)) else type(exc).__name__)+". Agent v"+VERSION+". No service or local checkout was changed by this report.")
def main():
 with (S/"singleton.lock").open("w") as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  gh("auth","status")
  print("UPPULSE_BRIDGE_READY",flush=True)
  while True:
   try:cycle()
   except Exception as error:print("BRIDGE_CYCLE_ERROR",type(error).__name__,flush=True)
   time.sleep(25)
if __name__=="__main__":main()
