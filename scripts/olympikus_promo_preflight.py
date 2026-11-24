#!/usr/bin/env python3
"""Read-only Olympikus commercial preflight on audited Codespaces clone.
No schema changes, no offer activation, no catalog publication.
"""
import json,os,pathlib,re,subprocess,sys,tempfile,shutil
from urllib.parse import quote

ROOT=pathlib.Path("/workspaces/uppulse-homologacao/missao9/codigo")
CONTAINER="beupfree-catalog-pg17-audit"
ORIGINAL="beupfree-catalog-pg17"
BRANCH="feat/uppulse-missao10-supercatalogo"
EXPECTED=(33520,102018,16945,5167,813)
def run(argv,*,cwd=ROOT,env=None):
 p=subprocess.run(argv,cwd=cwd,env=env,text=True,capture_output=True,timeout=600)
 if p.returncode:raise RuntimeError("COMMAND_FAILED_"+pathlib.Path(argv[0]).name.upper())
 return p.stdout.strip()
def counts():
 sql="""SELECT
 (SELECT count(*) FROM public.products),
 (SELECT count(*) FROM public.offers),
 (SELECT count(*) FROM public.catalog_search_products),
 (SELECT count(*) FROM public.offers WHERE merchant_id=(SELECT id FROM commerce_merchants WHERE external_merchant_id='17698')),
 (SELECT count(*) FROM public.external_product_identities WHERE merchant_id=(SELECT id FROM commerce_merchants WHERE external_merchant_id='17698'))"""
 raw=run(["docker","exec",CONTAINER,"psql","-U","postgres","-d","uppulse_catalog",
  "-X","-A","-t","-F",",","-v","ON_ERROR_STOP=1","-c",sql])
 return tuple(map(int,raw.split(",")))
def main():
 if len(sys.argv)!=1:raise RuntimeError("NO_ARGUMENTS_ALLOWED")
 if run(["docker","inspect","-f","{{.State.Status}}",CONTAINER])!="running":raise RuntimeError("CLONE_NOT_RUNNING")
 control=run(["docker","exec",CONTAINER,"pg_controldata","/var/lib/postgresql/data"])
 if not re.search(r"Database system identifier:\s*7699654111778938913\b",control):
  raise RuntimeError("CLONE_FINGERPRINT_MISMATCH")
 if counts()!=EXPECTED:raise RuntimeError("CATALOG_BASELINE_CHANGED")
 envold=json.loads(run(["docker","inspect","--format","{{json .Config.Env}}",ORIGINAL]))
 values=dict(x.split("=",1) for x in envold if "=" in x)
 password=values.get("POSTGRES_PASSWORD")
 if not password:raise RuntimeError("DATABASE_CREDENTIAL_UNAVAILABLE")
 username=values.get("POSTGRES_USER","postgres")
 remote=run(["git","ls-remote","origin","refs/heads/"+BRANCH]).split()[0]
 if not re.fullmatch(r"[0-9a-f]{40}",remote):raise RuntimeError("REMOTE_SHA_INVALID")
 temp=pathlib.Path(tempfile.mkdtemp(prefix="uppulse-promo-audit-",dir="/tmp"))
 try:
  archive=subprocess.Popen(["git","archive",remote],cwd=ROOT,stdout=subprocess.PIPE)
  try:
   unpack=subprocess.run(["tar","-x","-C",str(temp)],stdin=archive.stdout,timeout=90)
  finally:
   if archive.stdout:archive.stdout.close()
  if unpack.returncode or archive.wait():raise RuntimeError("SNAPSHOT_FAILED")
  if not (ROOT/"node_modules").is_dir():raise RuntimeError("NODE_DEPENDENCIES_MISSING")
  (temp/"node_modules").symlink_to(ROOT/"node_modules",target_is_directory=True)
  dburl="postgresql://"+quote(username,safe="")+":"+quote(password,safe="")+"@127.0.0.1:5436/uppulse_catalog"
  env=dict(os.environ)
  env.update({"AWIN_CATALOG_ADMIN_DATABASE_URL":dburl,"AWIN_CATALOG_EXPECTED_DATABASE":"uppulse_catalog",
   "AWIN_CATALOG_EXPECTED_HOST":"127.0.0.1","UPPULSE_DISABLE_EXTERNAL_JOBS":"true"})
  env.pop("OPENAI_API_KEY",None);env.pop("TAVILY_API_KEY",None)
  # Existing transactional staging program defaults to REPEATABLE READ ONLY
  # without --confirm-staging. --promotion-only filters out regular prices.
  out=run(["node","--import","tsx","scripts/awin-regular-catalog-stage.ts",
   "--merchant=17698","--feed-id=51837","--expected-raw-count=5167","--promotion-only"],cwd=temp,env=env)
  result=json.loads(out)
  if result.get("mode")!="READ_ONLY_DRY_RUN" or result.get("promotionOnly") is not True:
   raise RuntimeError("UNEXPECTED_AUDIT_MODE")
  if result.get("offersActivated")!=0 or result.get("projectionMutations")!=0:
   raise RuntimeError("UNEXPECTED_COMMERCIAL_WRITES")
  print(json.dumps({"status":"OLYMPIKUS_PROMO_DRY_RUN_OK","snapshot":remote[:12],
   "merchant":"17698","feedId":"51837","report":result},ensure_ascii=False,indent=2))
 finally:
  shutil.rmtree(temp,ignore_errors=True)
if __name__=="__main__":
 try:main()
 except Exception as exc:
  # Credential values and connection strings are never printed.
  print("OLYMPIKUS_PROMO_DRY_RUN_BLOCKED:"+str(exc) if re.fullmatch(r"[A-Z0-9_]{3,90}",str(exc)) else "OLYMPIKUS_PROMO_DRY_RUN_BLOCKED:EXECUTION_FAILED",file=sys.stderr)
  sys.exit(1)
