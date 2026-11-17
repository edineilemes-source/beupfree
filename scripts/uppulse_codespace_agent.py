#!/usr/bin/env python3
"""UpPulse Codespaces bridge: allowlisted GitHub Issues, no remote shell."""
import fcntl,json,os,pathlib,re,shutil,signal,subprocess,tempfile,time
from urllib.parse import quote
R=pathlib.Path("/workspaces/uppulse-homologacao/missao9/codigo")
S=pathlib.Path.home()/".local/state/uppulse-bridge"
S.mkdir(parents=True,exist_ok=True)
REPO="edineilemes-source/beupfree"
BRANCH="feat/uppulse-missao10-supercatalogo"
PORTS={5011,5012,5013,5014,5015}
TESTS=["server/productIntelligence/customerKnowledge.test.ts","server/productIntelligence/technicalPresentation.test.ts","server/productIntelligence/technicalNormalization.test.ts","server/productIntelligence/reportReconciliation.test.ts"]
PROFILES={"basic","unit","build","ui"}
# Only named profiles; never accept an executable command from an issue.
def cmd(args,cwd=R,timeout=150,check=True,**kw):
 p=subprocess.run(args,cwd=cwd,capture_output=True,text=True,timeout=timeout,**kw)
 if check and p.returncode: raise RuntimeError("COMMAND_FAILED_"+str(p.returncode))
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
 if action=="STATUS":
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
 # The browser test is intentionally separate from the generic check:
 # it requires a running preview and installed Playwright Chromium.
 return "TypeScript, "+profile+" profile passed"
def process_stamp(pid):
 try:return pathlib.Path("/proc/"+str(pid)+"/stat").read_text().split(") ")[1].split()[19]
 except (OSError,IndexError):return ""
def own(port):
 try:
  d=json.loads((S/("preview-"+str(port)+".json")).read_text())
  return d if process_stamp(d["pid"])==d["start"] and d["start"] else None
 except (OSError,ValueError,KeyError):return None
def db_url():
 container="beupfree-catalog-pg17"
 if cmd(["docker","inspect","-f","{{.State.Status}}",container],timeout=10)!="running":raise RuntimeError("POSTGRES_NOT_RUNNING")
 port=cmd(["docker","port",container,"5432"],timeout=10).splitlines()[0].rsplit(":",1)[-1]
 if not port.isdecimal():raise RuntimeError("POSTGRES_PORT_UNKNOWN")
 entries=json.loads(cmd(["docker","inspect","--format","{{json .Config.Env}}",container],timeout=10))
 variables=dict(s.split("=",1) for s in entries if "=" in s)
 if not variables.get("POSTGRES_PASSWORD"):raise RuntimeError("POSTGRES_CREDENTIAL_MISSING")
 return "postgresql://"+quote(variables.get("POSTGRES_USER","postgres"),safe="")+":"+quote(variables["POSTGRES_PASSWORD"],safe="")+"@127.0.0.1:"+port+"/uppulse_catalog"
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
  "PORT":str(port),"NODE_ENV":"development"})
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
   return "Preview OK HTTP "+status+". Codespaces PORTS -> "+str(port)+" -> Open in Browser"
  except RuntimeError:time.sleep(1)
 raise RuntimeError("PREVIEW_TIMEOUT")
def stop(port):
 d=own(port)
 if not d:return "No managed process to stop; other ports untouched"
 os.killpg(d["pid"],signal.SIGTERM)
 (S/("preview-"+str(port)+".json")).unlink(missing_ok=True)
 return "Managed preview on "+str(port)+" stopped; no other processes touched"
def execute(action,args):
 if action=="STATUS":
  local=cmd(["git","rev-parse","HEAD"])
  remote=cmd(["git","ls-remote","origin","refs/heads/"+BRANCH]).split()[0]
  dirty=bool(cmd(["git","status","--porcelain","--untracked-files=no"]))
  managed=[p for p in sorted(PORTS) if own(p)]
  return ("Bridge V1 online. GitHub canonical branch: "+BRANCH+
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
  if action not in {"STATUS","VALIDAR","PREVIEW","PARAR PREVIEW"}:continue
  mark(n)
  try:
   args=parse(action,item.get("body") or "")
   report(n,"Task accepted by restricted Codespaces agent.")
   result=execute(action,args)
   report(n,"SUCCESS: "+result)
   gh("issue","close",str(n),"--repo",REPO)
  except Exception as exc:
   # Avoid printing secrets or arbitrary subprocess stderr in public issues.
   report(n,"BLOCKED: "+type(exc).__name__+"; see local agent log and environment.")
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
