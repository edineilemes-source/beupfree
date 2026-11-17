#!/usr/bin/env python3
"""Read-only readiness inventory for UpPulse GitHub/Codespaces bridge."""
import json,os,pathlib,shutil,subprocess,sys
ROOT=pathlib.Path("/workspaces/uppulse-homologacao/missao9/codigo")
BRANCH="feat/uppulse-missao10-supercatalogo"
def call(args,timeout=12):
 try:
  p=subprocess.run(args,cwd=ROOT,capture_output=True,text=True,timeout=timeout)
  return p.returncode,p.stdout.strip(),p.stderr.strip()
 except (OSError,subprocess.TimeoutExpired):
  return 127,"",""
def check_version(cmd,label,minimum=None,mandatory=True):
 path=shutil.which(cmd)
 if not path:
  return {"name":label,"status":"BLOCKED" if mandatory else "OPTIONAL_MISSING","detail":cmd+" absent"}
 ret,out,err=call([cmd,"--version"])
 if ret:return {"name":label,"status":"BLOCKED" if mandatory else "OPTIONAL_MISSING","detail":"version check failed"}
 if cmd=="python3" and sys.version_info<(3,9):return {"name":label,"status":"BLOCKED","detail":"Python 3.9+ required"}
 if minimum is not None:
  import re
  m=re.search(r"(\d+)",out)
  if not m or int(m.group(1))<minimum:return {"name":label,"status":"BLOCKED","detail":"minimum major "+str(minimum)}
 return {"name":label,"status":"READY","detail":out.splitlines()[0][:90]}
def inventory():
 checks=[check_version("python3","Python",3),check_version("git","Git"),check_version("gh","GitHub CLI"),
   check_version("node","Node.js",22),check_version("npm","npm"),check_version("tar","tar"),
   check_version("curl","curl"),check_version("ss","Socket inspection"),
   check_version("docker","Docker (preview)",mandatory=False)]
 if not ROOT.is_dir():
  checks.append({"name":"Checkout","status":"BLOCKED","detail":"project root absent"})
  return checks
 code,branch,_=call(["git","branch","--show-current"])
 checks.append({"name":"Local branch","status":"READY" if code==0 else "BLOCKED",
   "detail":branch or "unknown; not changing branch"})
 ret,remote,_=call(["git","remote","get-url","origin"])
 checks.append({"name":"Git remote","status":"READY" if ret==0 and "edineilemes-source/beupfree" in remote else "BLOCKED",
   "detail":"origin confirmed" if ret==0 and "edineilemes-source/beupfree" in remote else "unexpected origin"})
 ret,_,_=call(["gh","auth","status"])
 checks.append({"name":"GitHub authentication","status":"READY" if ret==0 else "BLOCKED",
   "detail":"gh authenticated" if ret==0 else "run gh auth login interactively"})
 ret,_,_=call(["gh","api","repos/edineilemes-source/beupfree/issues","-f","per_page=1","--method","GET"])
 checks.append({"name":"GitHub Issues API","status":"READY" if ret==0 else "BLOCKED",
   "detail":"issue read access" if ret==0 else "cannot access repository issues"})
 checks.append({"name":"node_modules","status":"READY" if (ROOT/"node_modules"/".bin"/"tsx").exists() else "BLOCKED",
   "detail":"tsx available" if (ROOT/"node_modules"/".bin"/"tsx").exists() else "dependencies not installed"})
 checks.append({"name":"Devcontainer configuration","status":"CHECK_REQUIRED",
   "detail":"no repository .devcontainer/devcontainer.json; inspect effective Codespaces config before installing postStart hook"})
 checks.append({"name":"Recommended runtime","status":"INFO","detail":"Node.js 24 LTS preferred after project compatibility tests; Node 22 LTS acceptable; Node 20 EOL"} )
 checks.append({"name":"Codex CLI","status":"OPTIONAL","detail":"not required by bridge; GitHub connector edits code, agent validates previews"})
 checks.append({"name":"GitHub Codespaces CLI","status":"OPTIONAL","detail":"gh codespace is not required inside a running Codespace; gh is sufficient for Issues bridge"})
 return checks
if __name__=="__main__":
 checks=inventory()
 print(json.dumps({"protocol":"uppulse-bridge-preflight-v1","checks":checks},indent=2,ensure_ascii=False))
 blocked=[x for x in checks if x["status"]=="BLOCKED"]
 print("BRIDGE_PREFLIGHT_BLOCKED" if blocked else "BRIDGE_PREFLIGHT_READY")
 sys.exit(2 if blocked else 0)
