#!/usr/bin/env python3
"""Multi-partner AWIN catalog onboarding, clone-only, with backup/recovery gate.

Start AFTER the admin feed upload/triage has persisted raw items and staged
offers/identities. The historic Master, price evidence, classification, variants,
and search projection then run in one guarded pipeline. No production deployment.
"""
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from urllib.parse import quote

ROOT = Path("/workspaces/uppulse-homologacao/missao9/codigo")
BRANCH = "feat/uppulse-missao10-supercatalogo"
CONTAINER = "beupfree-catalog-pg17-audit"
ORIGINAL = "beupfree-catalog-pg17"
DATABASE = "uppulse_catalog"
FINGERPRINT = "7699654111778938913"
SCHEMA_MASTER = ("master_products","product_identity_runs",
                 "product_identity_decisions","product_master_memberships",
                 "product_identity_jobs")

def command(args, *, cwd=ROOT, env=None, input_bytes=None, timeout=1800):
    p = subprocess.run(args, cwd=cwd, env=env, input=input_bytes,
                       stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       timeout=timeout)
    if p.returncode:
        raise RuntimeError("COMMAND_FAILED_" +
                           re.sub("[^A-Z0-9_]", "", Path(args[0]).name.upper()) +
                           "_" + str(p.returncode))
    return p.stdout.decode("utf-8").strip()

def query(statement, database=DATABASE):
    return command(["docker","exec",CONTAINER,"psql","-U","postgres","-d",
                    database,"-X","-A","-t","-v","ON_ERROR_STOP=1","-c",
                    statement]).strip()

def number(statement, database=DATABASE):
    result=query(statement,database)
    if not re.fullmatch(r"\d+",result):
        raise RuntimeError("INVALID_NUMERIC_DB_RESULT")
    return int(result)

def counts(merchant, feed, database=DATABASE):
    # Numeric identifiers have already passed a strict regex. No user SQL input.
    master_expression = (f"""(SELECT count(*) FROM product_master_memberships mm
        JOIN external_product_identities e ON e.id=mm.external_product_identity_id
        JOIN commerce_merchants m ON m.id=e.merchant_id
        WHERE m.external_merchant_id='{merchant}' AND mm.valid_to IS NULL)"""
        if master_schema(database)==5 else "0")
    statement = f"""SELECT json_build_object(
      'products',(SELECT count(*) FROM products),
      'offers',(SELECT count(*) FROM offers),
      'catalog',(SELECT count(*) FROM catalog_search_products),
      'raw',(SELECT count(*) FROM commerce_raw_feed_items r
        JOIN commerce_merchants m ON m.id=r.merchant_id
        JOIN commerce_feeds f ON f.id=r.feed_id
        WHERE m.external_merchant_id='{merchant}' AND f.external_feed_id='{feed}'),
      'identities',(SELECT count(DISTINCT e.product_id) FROM external_product_identities e
        JOIN commerce_merchants m ON m.id=e.merchant_id
        WHERE m.external_merchant_id='{merchant}'),
      'identityRecords',(SELECT count(*) FROM external_product_identities e
        JOIN commerce_merchants m ON m.id=e.merchant_id
        WHERE m.external_merchant_id='{merchant}'),
      'master',{master_expression},
      'evidence',(SELECT count(*) FROM offer_promotion_evidence pe
        JOIN offers o ON o.id=pe.offer_id JOIN commerce_merchants m ON m.id=o.merchant_id
        WHERE m.external_merchant_id='{merchant}'),
      'classifications',(SELECT count(DISTINCT product_id) FROM product_catalog_classifications c
        JOIN commerce_merchants m ON m.id=c.merchant_id
        WHERE m.external_merchant_id='{merchant}'),
      'projection',(SELECT count(*) FROM catalog_search_products c
        JOIN commerce_merchants m ON m.id=c.merchant_id
        WHERE m.external_merchant_id='{merchant}')
    )"""
    return json.loads(query(statement,database))

def protected_projection(merchant):
    return query(f"""SELECT md5(coalesce(string_agg(
       md5(row_to_json(c)::text),'' ORDER BY c.product_id,c.merchant_id),''))
       FROM catalog_search_products c
       WHERE c.merchant_id<>(SELECT id FROM commerce_merchants
         WHERE external_merchant_id='{merchant}')""")

def constraints():
    return number("""SELECT count(*) FROM pg_constraint
     WHERE conname IN ('chk_offer_promotion_price_order','chk_offer_promotion_discount',
       'chk_catalog_search_prices','chk_catalog_search_discount')
       AND pg_get_constraintdef(oid) LIKE '%REGULAR_PRICE%'""")

def master_schema(database=DATABASE):
    return number("""SELECT count(*) FROM information_schema.tables
     WHERE table_schema='public' AND table_name IN
     ('master_products','product_identity_runs','product_identity_decisions',
      'product_master_memberships','product_identity_jobs')""",database)

def backup_and_verify(merchant, feed, expected):
    folder=Path.home()/".local/share/uppulse/backups"
    folder.mkdir(mode=0o700,parents=True,exist_ok=True)
    folder.chmod(0o700)
    name=("uppulse_partner_"+merchant+"_pre_"+feed+"_"+
          datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")+
          "_"+str(os.getpid())+".dump")
    dest=folder/name
    fd=os.open(dest,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    with os.fdopen(fd,"wb") as out:
        p=subprocess.run(["docker","exec",CONTAINER,"pg_dump",
            "-U","postgres","-d",DATABASE,"-Fc","--no-owner","--no-acl"],
            cwd=ROOT,stdout=out,stderr=subprocess.PIPE,timeout=1800)
    if p.returncode or dest.stat().st_size < 1024*1024:
        raise RuntimeError("BACKUP_FAILED")
    with dest.open("rb") as inp:
        p=subprocess.run(["docker","exec","-i",CONTAINER,"pg_restore","-l"],
                         stdin=inp,stdout=subprocess.PIPE,
                         stderr=subprocess.PIPE,timeout=180)
    if p.returncode or b"TABLE DATA" not in p.stdout:
        raise RuntimeError("BACKUP_ARCHIVE_INVALID")
    scratch="uppulse_check_"+merchant+"_"+str(os.getpid())
    command(["docker","exec",CONTAINER,"createdb","-U","postgres",
             "--template=template0",scratch])
    with dest.open("rb") as inp:
        p=subprocess.run(["docker","exec","-i",CONTAINER,"pg_restore",
                          "-U","postgres","-d",scratch,"--no-owner",
                          "--no-acl","--exit-on-error"],stdin=inp,
                         stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,
                         timeout=2400)
    if p.returncode:
        raise RuntimeError("BACKUP_RESTORE_FAILED_PRESERVED_FOR_RECOVERY")
    if counts(merchant,feed,scratch)!=expected:
        raise RuntimeError("BACKUP_RESTORE_INCONSISTENT")
    command(["docker","exec",CONTAINER,"dropdb","-U","postgres",scratch])
    if counts(merchant,feed)!=expected:
        raise RuntimeError("DATABASE_CHANGED_DURING_BACKUP")
    print("BACKUP_AND_FULL_RESTORE_OK: "+str(dest),flush=True)
    return str(dest)

def ensure_schema(snapshot):
    state=constraints()
    if state not in (0,4):
        raise RuntimeError("PARTIAL_PRICE_MIGRATION_REQUIRES_REVIEW")
    if state==0:
        sql=(snapshot/"migrations/0014_regular_price_offer_evidence.sql").read_bytes()
        command(["docker","exec","-i",CONTAINER,"psql","-U","postgres",
                 "-d",DATABASE,"-X","-v","ON_ERROR_STOP=1"],input_bytes=sql)
        if constraints()!=4:
            raise RuntimeError("PRICE_MIGRATION_UNVERIFIED")
        print("REGULAR_PRICE_MIGRATION_VERIFIED",flush=True)
    else:
        print("REGULAR_PRICE_SCHEMA_ALREADY_READY",flush=True)
    state=master_schema()
    if state not in (0,5):
        raise RuntimeError("PARTIAL_MASTER_SCHEMA_REQUIRES_REVIEW")
    if state==0:
        sql=(snapshot/"migrations/0013_master_identity_sidecar.sql").read_bytes()
        command(["docker","exec","-i",CONTAINER,"psql","-U","postgres",
                 "-d",DATABASE,"-X","-v","ON_ERROR_STOP=1"],input_bytes=sql)
        if master_schema()!=5:
            raise RuntimeError("MASTER_MIGRATION_UNVERIFIED")

def run_json(snapshot, script, args, env):
    output=command(["node","--import","tsx",script,*args],cwd=snapshot,
                   env=env,timeout=1800)
    return json.loads(output)

def main():
    argv=sys.argv[1:]
    options={}
    for arg in argv:
        if "=" in arg and arg.startswith("--"):
            name,value=arg[2:].split("=",1)
            if name in options:
                raise RuntimeError("DUPLICATE_ARGUMENT")
            options[name]=value
        elif arg=="--apply-to-audited-clone":
            options["apply"]="true"
        else:
            raise RuntimeError("INVALID_ARGUMENT")
    if (not {"merchant","feed-id","apply"}<=set(options) or
        not set(options)<={"merchant","feed-id","apply","source-sha"} or
        options["apply"]!="true"):
        raise RuntimeError("MERCHANT_FEED_EXPLICIT_CLONE_APPROVAL_REQUIRED")
    if "source-sha" in options and not re.fullmatch(r"[0-9a-f]{40}",options["source-sha"]):
        raise RuntimeError("INVALID_SOURCE_SHA")
    merchant,feed=options["merchant"],options["feed-id"]
    if not re.fullmatch(r"\d{2,12}",merchant) or not re.fullmatch(r"\d{2,12}",feed):
        raise RuntimeError("INVALID_MERCHANT_OR_FEED")
    lock=Path.home()/".local/share/uppulse/partner-onboarding.lock"
    lock.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
    with lock.open("w") as handle:
        try:
            fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("PARTNER_ONBOARDING_ALREADY_RUNNING")
        execute(merchant,feed,options.get("source-sha"))

def execute(merchant,feed,pinned_sha=None):
    status=command(["docker","inspect","-f","{{.State.Status}}",CONTAINER])
    ports=command(["docker","port",CONTAINER,"5432"])
    info=command(["docker","exec",CONTAINER,"pg_controldata",
                  "/var/lib/postgresql/data"])
    if status!="running" or "127.0.0.1:5436" not in ports or not re.search(
       r"Database system identifier:\s*"+FINGERPRINT+r"\b",info):
        raise RuntimeError("AUDITED_RECOVERY_CLONE_MISMATCH")
    before=counts(merchant,feed)
    if before["raw"]<1 or before["identities"]<1 or before["identityRecords"]<1:
        raise RuntimeError("FEED_NOT_STAGED_OR_MASTER_INPUT_MISSING")
    if before["projection"] or before["evidence"] or before["classifications"]:
        # An existing merchant/updated feed requires a separate append-only refresh.
        # Never silently reuse an incomplete run or mutate already published rows.
        if before["projection"] and before["evidence"] and before["classifications"]:
            evidence_for_feed=number(f"""SELECT count(*) FROM offer_promotion_evidence pe
              JOIN commerce_feeds f ON f.id=pe.feed_id
              JOIN commerce_merchants m ON m.id=f.merchant_id
              WHERE m.external_merchant_id='{merchant}'
                AND f.external_feed_id='{feed}'""")
            same_feed_projection=number(f"""SELECT count(*) FROM catalog_search_products c
              JOIN commerce_merchants m ON m.id=c.merchant_id
              WHERE m.external_merchant_id='{merchant}'
                AND c.source_snapshot LIKE 'awin-{merchant}-{feed}-%'""")
            if (evidence_for_feed!=before["evidence"] or
                before["classifications"]!=before["identities"] or
                before["master"]!=before["identityRecords"] or
                same_feed_projection!=before["projection"]):
                raise RuntimeError("EXISTING_MERCHANT_REQUIRES_REFRESH_OR_REPAIR")
            print(json.dumps({"status":"ALREADY_ONBOARDED","merchant":merchant,
               "feed":feed,"counts":before},ensure_ascii=False),flush=True)
            return
        raise RuntimeError("PARTIAL_MERCHANT_RUN_REQUIRES_REVIEW")
    if master_schema() not in (0,5) or constraints() not in (0,4):
        raise RuntimeError("PARTIAL_MIGRATION_REQUIRES_REVIEW")
    protected_before=protected_projection(merchant)
    # Use one immutable GitHub source snapshot, do not change the checkout.
    command(["git","fetch","--no-tags","origin",BRANCH])
    latest=command(["git","rev-parse","FETCH_HEAD"])
    sha=pinned_sha or latest
    if not re.fullmatch(r"[0-9a-f]{40}",sha):
        raise RuntimeError("SOURCE_SNAPSHOT_INVALID")
    if pinned_sha:
        command(["git","merge-base","--is-ancestor",pinned_sha,latest])
    source=Path(tempfile.mkdtemp(prefix="uppulse-partner-",dir="/tmp"))
    try:
        archive=subprocess.Popen(["git","archive",sha],cwd=ROOT,stdout=subprocess.PIPE)
        try:
            unpack=subprocess.run(["tar","-x","-C",str(source)],
                                  stdin=archive.stdout,stdout=subprocess.DEVNULL,
                                  stderr=subprocess.PIPE,timeout=180)
        finally:
            if archive.stdout: archive.stdout.close()
        if unpack.returncode or archive.wait():
            raise RuntimeError("SOURCE_ARCHIVE_FAILED")
        deps=ROOT/"node_modules"
        if not deps.is_dir():
            raise RuntimeError("NODE_DEPENDENCIES_MISSING")
        (source/"node_modules").symlink_to(deps,target_is_directory=True)
        original_env=command(["docker","inspect","--format",
            "{{json .Config.Env}}",ORIGINAL])
        credentials=dict(x.split("=",1) for x in json.loads(original_env) if "=" in x)
        if credentials.get("POSTGRES_USER","postgres")!="postgres" or not credentials.get("POSTGRES_PASSWORD"):
            raise RuntimeError("DATABASE_ADMIN_CREDENTIALS_MISSING")
        password=quote(credentials["POSTGRES_PASSWORD"],safe="")
        url="postgresql://postgres:"+password+"@127.0.0.1:5436/"+DATABASE
        env=dict(os.environ)
        env.update({"AWIN_CATALOG_ADMIN_DATABASE_URL":url,
          "AWIN_CATALOG_EXPECTED_DATABASE":DATABASE,
          "AWIN_CATALOG_EXPECTED_HOST":"127.0.0.1",
          "CATALOG_SEARCH_PROJECTION_ADMIN_DATABASE_URL":url,
          "CATALOG_SEARCH_PROJECTION_EXPECTED_DATABASE":DATABASE,
          "UPPULSE_DISABLE_EXTERNAL_JOBS":"true",
          "RESEARCH_PAID_ENABLED":"false"})
        for secret in ("OPENAI_API_KEY","TAVILY_API_KEY"):
            env.pop(secret,None)
        args=["--merchant="+merchant,"--feed-id="+feed,
              "--expected-raw-count="+str(before["raw"])]
        stage=run_json(source,"scripts/awin-regular-catalog-stage.ts",args,env)
        if stage.get("mode")!="READ_ONLY_DRY_RUN" or stage.get("rawCount")!=before["raw"] or \
           stage.get("productGroups")!=before["identities"]:
            raise RuntimeError("STAGING_READ_ONLY_PREFLIGHT_FAILED")
        eligible=int(stage["classification"].get("CATALOG_ELIGIBLE",0))
        candidates=int(stage["evidenceCandidates"])
        if eligible<1 or candidates<1:
            raise RuntimeError("NO_ELIGIBLE_COMMERCE_PRODUCTS")
        if eligible>before["identities"] or candidates>before["raw"]:
            raise RuntimeError("INVALID_ELIGIBILITY_COUNTS")
        # Never silently omit image, inventory or affiliate link quality.
        valid=number(f"""SELECT count(DISTINCT e.product_id) FROM external_product_identities e
          JOIN commerce_merchants m ON m.id=e.merchant_id
          JOIN product_images i ON i.product_id=e.product_id
          JOIN product_variants v ON v.product_id=e.product_id AND v.merchant_id=e.merchant_id
          JOIN offers o ON o.variant_id=v.id AND o.merchant_id=v.merchant_id
          WHERE m.external_merchant_id='{merchant}' AND o.in_stock=true
            AND o.affiliate_url ~ '^https?://'""")
        if valid<eligible:
            raise RuntimeError("ELIGIBLE_IMAGE_STOCK_LINK_COVERAGE_INCOMPLETE")
        if counts(merchant,feed)!=before:
            raise RuntimeError("SOURCE_CHANGED_AFTER_PREFLIGHT")
        print(json.dumps({"stage":"PREFLIGHT_OK","merchant":merchant,
           "feed":feed,"raw":before["raw"],"identities":before["identities"],
           "eligible":eligible,"priceEvidenceCandidates":candidates},ensure_ascii=False),flush=True)
        backup=backup_and_verify(merchant,feed,before)
        ensure_schema(source)
        # The original Product Master matcher runs before commercial staging.
        master=run_json(source,"scripts/awin-partner-master.ts",
            ["--merchant="+merchant,"--expected-identities="+str(before["identityRecords"]),
             "--confirm-master"],env)
        if master.get("status") not in ("ALREADY_COMPLETED","MASTER_PARTNER_COMPLETED"):
            raise RuntimeError("MASTER_COVERAGE_UNVERIFIED")
        print("MASTER_COVERAGE_VERIFIED",flush=True)
        staged=run_json(source,"scripts/awin-regular-catalog-stage.ts",
                       [*args,"--confirm-staging"],env)
        if staged.get("mode")!="STAGING_WRITTEN" or staged.get("insertedEvidence")!=candidates or \
           staged.get("offersActivated")!=0 or staged.get("projectionMutations")!=0:
            raise RuntimeError("COMMERCIAL_STAGING_UNVERIFIED")
        print("COMMERCIAL_STAGING_VERIFIED",flush=True)
        versions=run_json(source,"scripts/awin-partner-versions.ts",[],env)
        projected=run_json(source,"scripts/catalog-search-projection-persist.ts",[
           "--merchant="+merchant,
           "--expected-count="+str(eligible),
           "--projection-version="+versions["projection"],
           "--classifier-version="+versions["classifier"],
           "--normalizer-version="+versions["normalizer"],
           "--source-snapshot=awin-"+merchant+"-"+feed+"-"+sha[:12],
           "--confirm-persist"],env)
        if projected.get("finalCount")!=eligible:
            raise RuntimeError("SEARCH_PROJECTION_UNVERIFIED")
        after=counts(merchant,feed)
        if (after["products"]!=before["products"] or after["offers"]!=before["offers"] or
            after["catalog"]!=before["catalog"]+eligible or
            after["projection"]!=eligible or after["evidence"]!=candidates or
            after["classifications"]!=before["identities"] or
            after["master"]!=before["identityRecords"] or
            protected_projection(merchant)!=protected_before):
            raise RuntimeError("FINAL_MERCHANT_ISOLATION_AUDIT_FAILED")
        visible=number(f"""SELECT count(*) FROM catalog_search_products c
         JOIN commerce_merchants m ON m.id=c.merchant_id
         WHERE m.external_merchant_id='{merchant}'
           AND c.catalog_state='CATALOG_ELIGIBLE' AND c.available=true""")
        if visible!=eligible:
            raise RuntimeError("VISIBLE_PRODUCTS_NOT_EQUAL_ELIGIBLE")
        print(json.dumps({"status":"AWIN_PARTNER_CATALOG_READY","merchant":merchant,
          "feed":feed,"snapshot":sha[:12],"raw":before["raw"],
          "products":before["identities"],"identityRecords":before["identityRecords"],"eligible":eligible,
          "quarantined":int(stage["classification"].get("QUARANTINED",0)),
          "outOfScope":int(stage["classification"].get("OUT_OF_SCOPE",0)),
          "commercialEvidence":candidates,"availableSearchProducts":visible,
          "catalogTotal":after["catalog"],"backup":backup,
          "productionDeploy":False,"otherMerchantsChanged":False,
          "crossStoreMatching":"PENDING_REVIEW_NOT_ASSUMED"},
          ensure_ascii=False),flush=True)
    finally:
        shutil.rmtree(source,ignore_errors=True)

if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        safe=str(exc)
        if not re.fullmatch(r"[A-Z0-9_]{4,100}",safe):
            safe=type(exc).__name__.upper()
        print("AWIN_PARTNER_BLOCKED: "+safe,file=sys.stderr)
        sys.exit(1)
