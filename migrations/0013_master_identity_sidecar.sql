-- Mission 7: lateral identity only. Apply exclusively to the disposable database.
BEGIN;
CREATE TABLE master_products (
 id varchar(36) PRIMARY KEY, canonical_name text, brand_normalized text,
 product_type text, model_tokens jsonb NOT NULL, generation text,
 technical_qualifiers jsonb NOT NULL, attribute_evidence jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON master_products(brand_normalized,product_type);
CREATE TABLE product_identity_runs (
 id varchar(36) PRIMARY KEY, idempotency_key text NOT NULL UNIQUE,
 versions jsonb NOT NULL, code_revision text NOT NULL, config jsonb NOT NULL,
 input_manifest jsonb NOT NULL, coverage jsonb NOT NULL, logical_hash text NOT NULL,
 status text NOT NULL CHECK(status='COMPLETE'),
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(), finished_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE product_identity_decisions (
 id varchar(36) PRIMARY KEY, run_id varchar(36) NOT NULL REFERENCES product_identity_runs(id),
 comparison_key text NOT NULL, left_external_identity_id varchar(36) NOT NULL REFERENCES external_product_identities(id),
 right_external_identity_id varchar(36) NOT NULL REFERENCES external_product_identities(id),
 left_variant_id varchar(36) REFERENCES product_variants(id), right_variant_id varchar(36) REFERENCES product_variants(id),
 master_decision text NOT NULL CHECK(master_decision IN ('AUTO_MATCH','REVIEW','NO_MATCH')),
 variant_decision text NOT NULL CHECK(variant_decision IN ('AUTO_MATCH','REVIEW','NO_MATCH')),
 master_confidence numeric NOT NULL CHECK(master_confidence BETWEEN 0 AND 1),
 variant_confidence numeric NOT NULL CHECK(variant_confidence BETWEEN 0 AND 1),
 evidence jsonb NOT NULL, evaluated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(run_id,comparison_key), CHECK(left_external_identity_id < right_external_identity_id)
);
CREATE INDEX ON product_identity_decisions(left_external_identity_id,evaluated_at);
CREATE INDEX ON product_identity_decisions(right_external_identity_id,evaluated_at);
CREATE INDEX ON product_identity_decisions(run_id,master_decision);
CREATE TABLE product_master_memberships (
 id varchar(36) PRIMARY KEY, external_product_identity_id varchar(36) NOT NULL REFERENCES external_product_identities(id),
 master_product_id varchar(36) NOT NULL REFERENCES master_products(id),
 run_id varchar(36) NOT NULL REFERENCES product_identity_runs(id),
 decision_id varchar(36) REFERENCES product_identity_decisions(id),
 assignment_method text NOT NULL CHECK(assignment_method IN ('AUTO_MATCH','SINGLETON')),
 input_hash text NOT NULL, evidence jsonb NOT NULL,
 valid_from timestamptz NOT NULL DEFAULT clock_timestamp(), valid_to timestamptz,
 CHECK(valid_to IS NULL OR valid_to>valid_from), UNIQUE(run_id,external_product_identity_id,master_product_id)
);
CREATE UNIQUE INDEX ON product_master_memberships(external_product_identity_id) WHERE valid_to IS NULL;
CREATE INDEX ON product_master_memberships(master_product_id,external_product_identity_id) WHERE valid_to IS NULL;
CREATE TABLE product_identity_jobs (
 id varchar(36) PRIMARY KEY, event_key text NOT NULL UNIQUE, scope jsonb NOT NULL,
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','COMPLETE','PARTIAL','FAILED')),
 result jsonb, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION identity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'IDENTITY_HISTORY_IMMUTABLE'; END $$;
CREATE TRIGGER immutable_identity_decisions BEFORE UPDATE OR DELETE ON product_identity_decisions FOR EACH ROW EXECUTE FUNCTION identity_immutable();
CREATE TRIGGER immutable_identity_runs BEFORE UPDATE OR DELETE ON product_identity_runs FOR EACH ROW EXECUTE FUNCTION identity_immutable();
CREATE TRIGGER immutable_master_products BEFORE UPDATE OR DELETE ON master_products FOR EACH ROW EXECUTE FUNCTION identity_immutable();
CREATE FUNCTION identity_membership_close_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'IDENTITY_HISTORY_IMMUTABLE'; END IF;
 IF OLD.valid_to IS NOT NULL OR NEW.valid_to IS NULL OR
    (to_jsonb(NEW)-'valid_to') IS DISTINCT FROM (to_jsonb(OLD)-'valid_to')
 THEN RAISE EXCEPTION 'IDENTITY_CLOSE_ONLY'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER identity_membership_close_only BEFORE UPDATE OR DELETE ON product_master_memberships FOR EACH ROW EXECUTE FUNCTION identity_membership_close_only();
COMMIT;
