#!/usr/bin/env python3
"""Background Curadoria publisher; only a verified 5013 upload may start it.

Runs the historical safeguarded AWIN homologation pipeline, *never* a new
importer, never an Issue, never the production DB or Hostinger.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit

IDS = re.compile(r"\d{2,12}\Z")
SHA = re.compile(r"[0-9a-f]{64}\Z")
COMMIT = re.compile(r"[0-9a-f]{40}\Z")
PHASES = {
 "PREFLIGHT_OK": "COMMERCIAL_PREFLIGHT_OK",
 "BACKUP_AND_FULL_RESTORE_OK": "BACKUP_RESTORE_VERIFIED",
 "MASTER_COVERAGE_VERIFIED": "MASTER_PROCESSED",
 "COMMERCIAL_STAGING_VERIFIED": "COMMERCIAL_VALIDATED",
 "REGULAR_PRICE_SCHEMA_ALREADY_READY": "PRICE_SCHEMA_VERIFIED",
}
RESULT_STATUSES = {"AWIN_PARTNER_CATALOG_READY", "ALREADY_ONBOARDED"}

def now():
    return datetime.now(timezone.utc).isoformat()

def is_homologation():
    env = os.environ
    if not (env.get("NODE_ENV") == "development" and
            env.get("PUBLIC_DEMO_MODE") == "false" and
            env.get("UPPULSE_CURATOR_AUTO_PUBLISH") == "true" and
            env.get("UPPULSE_PUBLIC_CATALOG_APPROVED") == "true" and
            env.get("PORT") == "5013"):
        return False
    target = urlsplit(env.get("DATABASE_URL", ""))
    return (target.scheme in ("postgres", "postgresql") and
            target.hostname == "127.0.0.1" and target.port == 5436 and
            target.path == "/uppulse_catalog")

def write_status(path, source, status, phase, result=None, reason=None):
    obj = {**source, "status": status, "phase": phase, "updatedAt": now(),
           "published": int(result.get("availableSearchProducts", 0)) if result and
                        status == "COMPLETED" else 0}
    if result:
        allow = ("status", "merchant", "feed", "availableSearchProducts", "catalogTotal")
        obj["result"] = {k: result[k] for k in allow if k in result}
    if reason:
        obj["reason"] = reason
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, tmp = tempfile.mkstemp(prefix=".curator-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            os.fchmod(out.fileno(), 0o600)
            json.dump(obj, out, ensure_ascii=False)
            out.flush()
            os.fsync(out.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)

def run():
    parser = argparse.ArgumentParser()
    for key in ("merchant", "feed-id", "sha256", "source-sha"):
        parser.add_argument("--"+key, required=True)
    args = parser.parse_args()
    merchant, feed, fingerprint, source_sha = (
        args.merchant, args.feed_id, args.sha256, args.source_sha)
    if not (IDS.fullmatch(merchant) and IDS.fullmatch(feed) and
            SHA.fullmatch(fingerprint) and COMMIT.fullmatch(source_sha)):
        raise ValueError("INVALID_JOB_IDENTITY")
    source = {"merchant": merchant, "feedId": feed, "sha256": fingerprint}
    root = Path(os.environ.get("UPPULSE_CURATOR_JOB_DIR") or
                Path.home()/".local/share/uppulse/curator-publications")
    path = root/(merchant+"-"+feed+"-"+fingerprint+".json")
    if not path.is_file():
        raise RuntimeError("JOB_NOT_QUEUED_BY_CURADORIA")
    def record(status, phase, result=None, reason=None):
        write_status(path, source, status, phase, result, reason)
    try:
        if not is_homologation():
            raise RuntimeError("HOMOLOGATION_CLONE_ONLY")
        expected = Path(os.environ.get("UPPULSE_FEED_INBOX_DIR") or
                Path.home()/".local/share/uppulse/awin-inbox") / (
                    merchant+"-"+feed+"-"+fingerprint[:16]+".csv.gz")
        content = expected.read_bytes()
        if hashlib.sha256(content).hexdigest() != fingerprint:
            raise RuntimeError("SOURCE_SHA256_MISMATCH")
        audit = json.loads((expected.parent/(expected.name+".report.json")).read_text("utf-8"))
        if (audit.get("sha256")!=fingerprint or audit.get("merchant")!=merchant or
            audit.get("feedId")!=feed):
            raise RuntimeError("UPLOAD_AUDIT_MISMATCH")
        script = Path(__file__).resolve().parent/"awin-partner-onboard.py"
        if not script.is_file():
            raise RuntimeError("PARTNER_PIPELINE_NOT_FOUND")
        record("RUNNING","VERIFYING_CATALOG")
        command = [sys.executable, str(script), "--merchant="+merchant,
                   "--feed-id="+feed, "--source-sha="+source_sha,
                   "--apply-to-audited-clone"]
        env = dict(os.environ)
        env["UPPULSE_DISABLE_EXTERNAL_JOBS"]="true"
        env["RESEARCH_PAID_ENABLED"]="false"
        env.pop("OPENAI_API_KEY",None)
        env.pop("TAVILY_API_KEY",None)
        output = None
        blocked = None
        with subprocess.Popen(command, cwd=script.parent.parent,
                              env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                              text=True, bufsize=1) as process:
            assert process.stdout is not None
            for line in process.stdout:
                clean=line.strip()
                for prefix,phase in PHASES.items():
                    if clean.startswith(prefix):
                        record("RUNNING",phase)
                if clean.startswith("AWIN_PARTNER_BLOCKED:"):
                    match=re.search(r"AWIN_PARTNER_BLOCKED:\s*([A-Z0-9_]{4,100})",clean)
                    blocked=match.group(1) if match else "PIPELINE_FAILED"
                if clean.startswith('{"status":'):
                    try:output=json.loads(clean)
                    except ValueError:pass
            exit_code=process.wait()
        if exit_code!=0:
            raise RuntimeError(blocked or "PARTNER_ONBOARDING_FAILED")
        if not isinstance(output,dict) or output.get("status") not in RESULT_STATUSES:
            raise RuntimeError("PUBLICATION_RESULT_UNVERIFIED")
        if output.get("merchant")!=merchant or output.get("feed")!=feed:
            raise RuntimeError("PUBLICATION_PARTNER_MISMATCH")
        if output.get("status")=="AWIN_PARTNER_CATALOG_READY" and (
                not isinstance(output.get("availableSearchProducts"),int) or
                output["availableSearchProducts"] < 1):
            raise RuntimeError("PUBLICATION_VISIBLE_PRODUCTS_UNVERIFIED")
        if output.get("status")=="ALREADY_ONBOARDED":
            # Already processed by the old bridge. Query the isolated clone for
            # actual catalog visibility; do not claim this action imported offers.
            nested=output.get("counts",{})
            count=nested.get("projection")
            if not isinstance(count,int) or count<1:
                raise RuntimeError("EXISTING_PARTNER_VISIBILITY_UNVERIFIED")
            output["availableSearchProducts"]=count
            output["catalogTotal"]=nested.get("catalog")
        record("COMPLETED","CATALOG_VISIBLE",output)
    except Exception as exc:
        reason=str(exc)
        if not re.fullmatch(r"[A-Z0-9_]{4,100}",reason):
            reason="PUBLICATION_WORKER_FAILED"
        record("BLOCKED","REQUIRES_REVIEW",reason=reason)

if __name__=="__main__":
    try:run()
    except Exception:
        # No unbounded traceback or secrets in logs. The journal will be
        # available for any well-formed existing queued job.
        print("AWIN_CURATOR_PUBLICATION_WORKER_FAILED",file=sys.stderr)
        sys.exit(1)
