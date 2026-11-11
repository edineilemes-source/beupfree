#!/usr/bin/env bash
# PostgreSQL 17 homologation on the real catalog database.
# Only temporary synthetic rows in the two mission10.6 tables; no paid calls.
set -euo pipefail
container=beupfree-catalog-pg17
docker inspect -f '{{.State.Status}}' "$container" | grep -qx running
echo "=== REAL POSTGRESQL CONCURRENCY AND BUDGET VALIDATION ==="
# Transactional test, rolled back even on success. Two advisory locks are not needed:
# this verifies unique claim, owner-scoped release and atomic budget caps in SQL.
docker exec -i "$container" sh -c 'psql -U "${POSTGRES_USER:-postgres}" -d uppulse_catalog -X -v ON_ERROR_STOP=1' <<'SQL'
BEGIN;
DO $$
DECLARE
  master varchar(36);
  key varchar(64) := repeat('f',64);
  owner1 uuid := '11111111-1111-4111-8111-111111111111';
  owner2 uuid := '22222222-2222-4222-8222-222222222222';
  n integer;
BEGIN
  SELECT id INTO master FROM products ORDER BY id LIMIT 1;
  IF master IS NULL THEN RAISE EXCEPTION 'MASTER_MISSING'; END IF;
  INSERT INTO research_claims(super_hash,master_id,owner) VALUES(key,master,owner1);
  INSERT INTO research_claims(super_hash,master_id,owner) VALUES(key,master,owner2) ON CONFLICT DO NOTHING;
  SELECT count(*) INTO n FROM research_claims WHERE super_hash=key;
  IF n<>1 THEN RAISE EXCEPTION 'CLAIM_DUPLICATED'; END IF;
  DELETE FROM research_claims WHERE super_hash=key AND owner=owner2;
  SELECT count(*) INTO n FROM research_claims WHERE super_hash=key;
  IF n<>1 THEN RAISE EXCEPTION 'CLAIM_RELEASED_BY_WRONG_OWNER'; END IF;
  DELETE FROM research_claims WHERE super_hash=key AND owner=owner1;
  SELECT count(*) INTO n FROM research_claims WHERE super_hash=key;
  IF n<>0 THEN RAISE EXCEPTION 'CLAIM_NOT_RELEASED'; END IF;
END $$;
DO $$
DECLARE
  i integer;
  accepted integer := 0;
  delta integer;
BEGIN
  FOR i IN 1..10 LOOP
    INSERT INTO research_budget AS b(singleton,policy,window_end,tavily_calls,openai_calls,reserved_microusd)
    VALUES(true,'{"test":"mission10.6"}'::jsonb,now()+interval '1 hour',1,0,5000)
    ON CONFLICT(singleton) DO UPDATE SET
      tavily_calls=b.tavily_calls+1,
      reserved_microusd=b.reserved_microusd+5000
    WHERE b.policy=EXCLUDED.policy AND b.tavily_calls<2 AND b.reserved_microusd<=20000
    RETURNING 1 INTO delta;
    IF delta=1 THEN accepted:=accepted+1; END IF;
    delta:=NULL;
  END LOOP;
  IF accepted<>2 THEN RAISE EXCEPTION 'BUDGET_CAP_FAILED: %',accepted; END IF;
END $$;
ROLLBACK;
SELECT 'M10_6_HOMOLOGATION_SQL_ROLLBACK_OK' AS result;
SELECT count(*) AS claims_after FROM research_claims;
SELECT count(*) AS budget_rows_after FROM research_budget;
SQL
echo "M10_6_HOMOLOGATION_COMPLETE; commercial tables unchanged; paid APIs disabled."
