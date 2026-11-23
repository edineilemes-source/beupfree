-- CURADORIA V3 — PROPOSTA ADITIVA, NÃO APLICAR AUTOMATICAMENTE.
-- Exige autorização de migração, inspeção do esquema e backup verificado.
-- Não altera products, offers, Master, projeções, nem dados históricos.
BEGIN;
CREATE TABLE IF NOT EXISTS curation_workflow_runs (
 workflow_key varchar(64) PRIMARY KEY,
 merchant_external_id text NOT NULL,
 feed_external_id text NOT NULL,
 file_sha256 varchar(64) NOT NULL,
 status varchar(16) NOT NULL DEFAULT 'PENDING'
  CHECK(status IN ('PENDING','RUNNING','PARTIAL','BLOCKED','COMPLETE')),
 completed jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(completed)='array'),
 blocked_at text,
 block_reasons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(block_reasons)='array'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT curation_workflow_source_nonblank CHECK(
  merchant_external_id ~ '^[0-9]{2,12}$'
  AND feed_external_id ~ '^[0-9]{2,12}$'
  AND file_sha256 ~ '^[0-9a-f]{64}$'
 )
);
CREATE INDEX IF NOT EXISTS idx_curation_workflow_status
 ON curation_workflow_runs(status,updated_at);
COMMIT;
