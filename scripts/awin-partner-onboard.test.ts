import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";

const runner=readFileSync(new URL("./awin-partner-onboard.py",import.meta.url),"utf8");
const master=readFileSync(new URL("./awin-partner-master.ts",import.meta.url),"utf8");
const bridge=readFileSync(new URL("./uppulse_codespace_agent.py",import.meta.url),"utf8");

test("multi-partner executable is syntactically valid Python and fails closed without approval",()=>{
 const file=new URL("./awin-partner-onboard.py",import.meta.url);
 const result=spawnSync("python3",[file.pathname],{encoding:"utf8",timeout:5000});
 assert.equal(result.status,1);
 assert.match(result.stderr,/AWIN_PARTNER_BLOCKED: MERCHANT_FEED_EXPLICIT_CLONE_APPROVAL_REQUIRED/);
 const agent=spawnSync("python3",["-c","import ast,pathlib,sys;ast.parse(pathlib.Path(sys.argv[1]).read_text())",file.pathname],{encoding:"utf8",timeout:5000});
 assert.equal(agent.status,0,agent.stderr);
});

test("partner onboarding is parameterized, clone-only, backed up and isolated",()=>{
 for(const name of ["--merchant","--feed-id","--apply-to-audited-clone",
  "FINGERPRINT","BACKUP_AND_FULL_RESTORE_OK","backup_and_verify","MASTER_COVERAGE_VERIFIED",
  "COMMERCIAL_STAGING_VERIFIED","SEARCH_PROJECTION_UNVERIFIED","protected_projection",
  "AWIN_PARTNER_CATALOG_READY","REGULAR_PRICE_SCHEMA_ALREADY_READY"])
  assert.ok(runner.includes(name),name);
 assert.doesNotMatch(runner,/merchant\s*=\s*["']17698["']|feed\s*=\s*["']51837["']/);
 assert.doesNotMatch(runner,/Hostinger|git\s+reset|DROP TABLE|TRUNCATE/i);
 assert.ok(runner.indexOf("backup=backup_and_verify")<runner.indexOf("ensure_schema(source)"));
 assert.ok(runner.indexOf("ensure_schema(source)")<runner.indexOf("COMMERCIAL_STAGING_VERIFIED"));
});

test("historic Master step is reusable and never assumes cross-store identity matches",()=>{
 assert.match(master,/persistIdentities\(pool,identities/);
 assert.match(master,/MASTER_PARTIAL_COVERAGE_REQUIRES_REVIEW/);
 assert.match(master,/otherMerchantWrites:0/);
 assert.match(master,/crossStoreMatching:"PENDING_REVIEW_NOT_ASSUMED"/);
 assert.doesNotMatch(master,/17698|51837|OLYMPIKUS/);
});

test("restricted GitHub bridge requires owner-authored numeric IDs and never allows remote shell",()=>{
 assert.match(bridge,/INTEGRAR_AWIN/);
 assert.match(bridge,/set\(d\)!==\{"merchant","feedId"\}/);
 assert.match(bridge,/re\.fullmatch\(r"\\d\{2,12\}"/);
 assert.match(bridge,/author.*edineilemes-source/);
 assert.match(bridge,/AWIN_PARTNER_CATALOG_READY/);
});
