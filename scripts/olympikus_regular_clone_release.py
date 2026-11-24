#!/usr/bin/env python3
"""Controlled Olympikus 0%-discount homologation on the verified disposable catalog clone.

Requires an explicit operator flag. Never touches the original container, its volume,
Git checkout, Hostinger, production or DNS. Full logical backup and scratch restore
must pass BEFORE the migration is applied to the audit clone.
"""
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from urllib.parse import quote

ROOT = pathlib.Path("/workspaces/uppulse-homologacao/missao9/codigo")
BRANCH = "feat/uppulse-missao10-supercatalogo"
CONTAINER = "beupfree-catalog-pg17-audit"
ORIGINAL = "beupfree-catalog-pg17"
DATABASE = "uppulse_catalog"
BASELINE = (33520, 102018, 16945, 5167, 813)
FINGERPRINT = "7699654111778938913"
ARGS = ["--merchant=17698", "--feed-id=51837", "--expected-raw-count=5167"]

def call(argv, *, cwd=ROOT, env=None, stdin=None, timeout=1800):
    result = subprocess.run(argv, cwd=cwd, env=env, stdin=stdin,
                            capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        # Subprocess output may contain connection URLs, feed payloads or secrets.
        raise RuntimeError("STEP_FAILED_" + re.sub("[^A-Z0-9_]", "", pathlib.Path(argv[0]).name.upper()) +
                           "_" + str(result.returncode))
    return result.stdout.strip()

def sql(statement, database=DATABASE):
    return call(["docker", "exec", CONTAINER, "psql", "-U", "postgres", "-d", database,
                 "-X", "-A", "-t", "-F", ",", "-v", "ON_ERROR_STOP=1", "-c", statement])

def baseline(database=DATABASE):
    statement = """SELECT
       (SELECT count(*) FROM public.products),
       (SELECT count(*) FROM public.offers),
       (SELECT count(*) FROM public.catalog_search_products),
       (SELECT count(*) FROM public.offers WHERE merchant_id =
         (SELECT id FROM commerce_merchants WHERE external_merchant_id='17698')),
       (SELECT count(*) FROM public.external_product_identities WHERE merchant_id =
         (SELECT id FROM commerce_merchants WHERE external_merchant_id='17698'))"""
    return tuple(int(v) for v in sql(statement, database).split(","))

def execute_with_input(argv, data, *, timeout=1800):
    result = subprocess.run(argv, cwd=ROOT, input=data, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError("STEP_FAILED_" + pathlib.Path(argv[0]).name.upper() + "_" + str(result.returncode))
    return result.stdout

def main():
    if sys.argv[1:] != ["--apply-to-audited-clone"]:
        raise RuntimeError("EXPLICIT_AUDIT_CLONE_APPROVAL_FLAG_REQUIRED")
    if call(["docker", "inspect", "-f", "{{.State.Status}}", CONTAINER]) != "running":
        raise RuntimeError("AUDIT_CLONE_NOT_RUNNING")
    published = call(["docker", "port", CONTAINER, "5432"])
    if "127.0.0.1:5436" not in published:
        raise RuntimeError("AUDIT_CLONE_PORT_MISMATCH")
    control = call(["docker", "exec", CONTAINER, "pg_controldata", "/var/lib/postgresql/data"])
    if not re.search(r"Database system identifier:\s*" + FINGERPRINT + r"\b", control):
        raise RuntimeError("AUDIT_CLONE_FINGERPRINT_MISMATCH")
    if baseline() != BASELINE:
        raise RuntimeError("AUDIT_CLONE_BASELINE_CHANGED")
    # Never index products lacking a persisted photo or a live, usable affiliate offer.
    merchant = "(SELECT id FROM commerce_merchants WHERE external_merchant_id='17698')"
    pictured = int(sql("SELECT count(DISTINCT e.product_id) FROM external_product_identities e " +
                       "JOIN product_images i ON i.product_id=e.product_id WHERE e.merchant_id=" + merchant))
    sellable = int(sql("SELECT count(DISTINCT v.product_id) FROM product_variants v " +
                       "JOIN offers o ON o.variant_id=v.id AND o.merchant_id=v.merchant_id " +
                       "WHERE v.merchant_id=" + merchant +
                       " AND o.in_stock=true AND o.affiliate_url ~ '^https?://'"))
    if pictured != 813 or sellable != 813:
        raise RuntimeError("PRODUCT_IMAGE_OR_STOCK_LINK_COVERAGE_INCOMPLETE")

    constraints = sql("""SELECT count(*) FROM pg_constraint
        WHERE conname IN ('chk_offer_promotion_price_order','chk_offer_promotion_discount',
        'chk_catalog_search_prices','chk_catalog_search_discount')
        AND pg_get_constraintdef(oid) LIKE '%REGULAR_PRICE%'""")
    if constraints != "0":
        raise RuntimeError("MIGRATION_ALREADY_PRESENT_OR_PARTIAL")
    # The canonical GitHub commit, not the potentially dirty checkout, supplies the code.
    call(["git", "fetch", "--no-tags", "origin", BRANCH])
    sha = call(["git", "rev-parse", "FETCH_HEAD"])
    if not re.fullmatch("[0-9a-f]{40}", sha):
        raise RuntimeError("GITHUB_SHA_NOT_VERIFIED")
    snapshot = pathlib.Path(tempfile.mkdtemp(prefix="uppulse-olympikus-release-", dir="/tmp"))
    try:
        archive = subprocess.Popen(["git", "archive", sha], cwd=ROOT, stdout=subprocess.PIPE)
        unpack = subprocess.run(["tar", "-x", "-C", str(snapshot)], stdin=archive.stdout,
                                capture_output=True, timeout=120)
        if archive.stdout:
            archive.stdout.close()
        if unpack.returncode or archive.wait():
            raise RuntimeError("SNAPSHOT_FAILED")
        if not (ROOT / "node_modules").is_dir():
            raise RuntimeError("NODE_DEPENDENCIES_MISSING")
        (snapshot / "node_modules").symlink_to(ROOT / "node_modules", target_is_directory=True)
        original_env = call(["docker", "inspect", "--format", "{{json .Config.Env}}", ORIGINAL])
        credentials = dict(part.split("=", 1) for part in json.loads(original_env) if "=" in part)
        user = credentials.get("POSTGRES_USER", "postgres")
        password = credentials.get("POSTGRES_PASSWORD")
        if not password or user != "postgres":
            raise RuntimeError("ADMIN_CREDENTIALS_UNAVAILABLE")
        database_url = "postgresql://" + quote(user, safe="") + ":" + quote(password, safe="") + \
                       "@127.0.0.1:5436/" + DATABASE
        env = dict(os.environ)
        env.update({
            "AWIN_CATALOG_ADMIN_DATABASE_URL": database_url,
            "AWIN_CATALOG_EXPECTED_DATABASE": DATABASE,
            "AWIN_CATALOG_EXPECTED_HOST": "127.0.0.1",
            "CATALOG_SEARCH_PROJECTION_ADMIN_DATABASE_URL": database_url,
            "CATALOG_SEARCH_PROJECTION_EXPECTED_DATABASE": DATABASE,
            "UPPULSE_DISABLE_EXTERNAL_JOBS": "true",
            "RESEARCH_PAID_ENABLED": "false",
        })
        env.pop("OPENAI_API_KEY", None)
        env.pop("TAVILY_API_KEY", None)

        # First gate is fully read-only; classification must preserve every regular-price item.
        dry = json.loads(call(["node", "--import", "tsx", "scripts/awin-regular-catalog-stage.ts",
                              *ARGS], cwd=snapshot, env=env))
        if dry.get("mode") != "READ_ONLY_DRY_RUN" or dry.get("productGroups") != 813 or \
           dry.get("priceStates", {}).get("REGULAR_PRICE") != 5167 or \
           dry.get("classification", {}).get("CATALOG_ELIGIBLE") != 813 or \
           dry.get("evidenceCandidates") != 5167:
            raise RuntimeError("REGULAR_PRICE_PREFLIGHT_MISMATCH")
        print("PREFLIGHT_OK: 813 eligible products, 5167 regular-price offers", flush=True)

        # Never overwrite an existing backup. Backup is retained outside the repository.
        backup_dir = pathlib.Path.home() / ".local/share/uppulse/backups"
        backup_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        backup_dir.chmod(0o700)
        name = "uppulse_catalog_pre_0014_" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + \
               "_" + str(os.getpid()) + ".dump"
        backup = backup_dir / name
        fd = os.open(backup, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        with os.fdopen(fd, "wb") as sink:
            dump = subprocess.run(["docker", "exec", CONTAINER, "pg_dump", "-U", "postgres",
                                   "-d", DATABASE, "-Fc", "--no-owner", "--no-acl"],
                                  cwd=ROOT, stdout=sink, stderr=subprocess.PIPE, timeout=1800)
        if dump.returncode or backup.stat().st_size < 1024 * 1024:
            raise RuntimeError("LOGICAL_BACKUP_FAILED")
        with backup.open("rb") as source:
            contents = subprocess.run(["docker", "exec", "-i", CONTAINER, "pg_restore", "-l"],
                                      stdin=source, capture_output=True, timeout=180)
        if contents.returncode or b"TABLE DATA" not in contents.stdout:
            raise RuntimeError("BACKUP_ARCHIVE_INDEX_INVALID")
        print("BACKUP_ARCHIVE_VERIFIED: " + str(backup), flush=True)

        # Restore the entire logical dump to a NEW, isolated scratch database.
        scratch = "uppulse_verify_" + str(os.getpid())
        call(["docker", "exec", CONTAINER, "createdb", "-U", "postgres", "--template=template0", scratch])
        with backup.open("rb") as source:
            restored = subprocess.run(["docker", "exec", "-i", CONTAINER, "pg_restore",
                                       "-U", "postgres", "-d", scratch, "--no-owner", "--no-acl",
                                       "--exit-on-error"], stdin=source, stdout=subprocess.DEVNULL,
                                      stderr=subprocess.PIPE, timeout=2400)
        if restored.returncode:
            raise RuntimeError("SCRATCH_RESTORE_FAILED_BACKUP_PRESERVED")
        if baseline(scratch) != BASELINE:
            raise RuntimeError("SCRATCH_RESTORE_COUNTS_MISMATCH_BACKUP_PRESERVED")
        # Only this scratch database was created by this script.
        call(["docker", "exec", CONTAINER, "dropdb", "-U", "postgres", scratch])
        print("FULL_RESTORE_VERIFIED: source database remains untouched", flush=True)
        if baseline() != BASELINE:
            raise RuntimeError("BASELINE_CHANGED_DURING_BACKUP")

        migration = (snapshot / "migrations/0014_regular_price_offer_evidence.sql").read_bytes()
        execute_with_input(["docker", "exec", "-i", CONTAINER, "psql", "-U", "postgres",
                            "-d", DATABASE, "-X", "-v", "ON_ERROR_STOP=1"], migration)
        migrated = sql("""SELECT count(*) FROM pg_constraint
          WHERE conname IN ('chk_offer_promotion_price_order','chk_offer_promotion_discount',
          'chk_catalog_search_prices','chk_catalog_search_discount')
          AND pg_get_constraintdef(oid) LIKE '%REGULAR_PRICE%'""")
        if migrated != "4":
            raise RuntimeError("REGULAR_PRICE_MIGRATION_UNVERIFIED")
        print("MIGRATION_0014_VERIFIED", flush=True)

        staged = json.loads(call(["node", "--import", "tsx", "scripts/awin-regular-catalog-stage.ts",
                                  *ARGS, "--confirm-staging"], cwd=snapshot, env=env))
        if staged.get("mode") != "STAGING_WRITTEN" or staged.get("insertedEvidence") != 5167 or \
           staged.get("offersActivated") != 0 or staged.get("projectionMutations") != 0:
            raise RuntimeError("STAGING_RESULT_UNEXPECTED")
        print("STAGING_VERIFIED: 5167 price evidences, variants and classification", flush=True)

        projected = json.loads(call(["node", "--import", "tsx", "scripts/catalog-search-projection-persist.ts",
                                     "--merchant=17698", "--expected-count=813",
                                     "--projection-version=uppulse-catalog-search-v4-demographics",
                                     "--classifier-version=uppulse-taxonomy-v4-contextual",
                                     "--normalizer-version=uppulse-normalizer-v3-uppulse-colors-v3-2026-10-06",
                                     "--source-snapshot=olympikus-awin-51837-" + sha[:12],
                                     "--confirm-persist"], cwd=snapshot, env=env))
        if projected.get("finalCount") != 813:
            raise RuntimeError("PROJECTION_RESULT_UNEXPECTED")
        final = baseline()
        if final != (33520, 102018, 17758, 5167, 813):
            raise RuntimeError("FINAL_CATALOG_COUNTS_MISMATCH")
        merchant_rows = int(sql("""SELECT count(*) FROM catalog_search_products
             WHERE merchant_id=(SELECT id FROM commerce_merchants
             WHERE external_merchant_id='17698') AND catalog_state='CATALOG_ELIGIBLE'
             AND available=true"""))
        if merchant_rows != 813:
            raise RuntimeError("OLYMPIKUS_VISIBILITY_UNVERIFIED")
        print(json.dumps({"status": "OLYMPIKUS_AUDIT_CLONE_RELEASED",
                          "snapshot": sha[:12], "merchant": "17698",
                          "regularPriceOffers": 5167, "eligibleProducts": 813,
                          "availableSearchProducts": merchant_rows, "backup": str(backup),
                          "productionDeploy": False, "otherMerchantsChanged": False},
                         ensure_ascii=False, indent=2), flush=True)
    finally:
        shutil.rmtree(snapshot, ignore_errors=True)

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Only known internal markers are displayed; no sensitive subprocess outputs.
        message = str(error)
        if not re.fullmatch("[A-Z0-9_]{4,100}", message):
            message = type(error).__name__.upper()
        print("OLYMPIKUS_RELEASE_BLOCKED: " + message, file=sys.stderr)
        sys.exit(1)
