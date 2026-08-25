-- DAFITI005/006: append-only operational catalog metadata.
-- Applying this schema does not publish or activate commercial data.

CREATE TYPE "catalog_operational_state" AS ENUM (
  'CATALOG_ELIGIBLE', 'QUARANTINED', 'OUT_OF_SCOPE', 'PUBLISHED', 'PAUSED'
);

CREATE TABLE "product_catalog_classifications" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" varchar(36) NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "provider_id" varchar(36) REFERENCES "commerce_providers"("id"),
  "merchant_id" varchar(36) REFERENCES "commerce_merchants"("id"),
  "universe" varchar(40) NOT NULL,
  "style" varchar(40) NOT NULL,
  "activities" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "confidence" varchar(20) NOT NULL,
  "reason_codes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "operational_state" "catalog_operational_state" NOT NULL,
  "classifier_version" varchar(80) NOT NULL,
  "classified_at" timestamp NOT NULL,
  "source_evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_product_catalog_universe" CHECK ("universe" IN ('SNEAKER_CONFIRMED','SNEAKER_PROBABLE','NON_SNEAKER','UNRESOLVED')),
  CONSTRAINT "chk_product_catalog_style" CHECK ("style" IN ('PERFORMANCE','SPORTSWEAR','LIFESTYLE','HYBRID','UNKNOWN')),
  CONSTRAINT "chk_product_catalog_confidence" CHECK ("confidence" IN ('HIGH','MEDIUM','LOW')),
  CONSTRAINT "chk_product_catalog_not_published_by_accident" CHECK ("operational_state" <> 'PUBLISHED' OR "universe" = 'SNEAKER_CONFIRMED')
);
CREATE INDEX "idx_product_catalog_classifications_product_latest" ON "product_catalog_classifications" ("product_id", "classified_at" DESC, "created_at" DESC);
CREATE UNIQUE INDEX "uq_product_catalog_classifications_version" ON "product_catalog_classifications" ("product_id", "classifier_version");
CREATE INDEX "idx_product_catalog_classifications_state" ON "product_catalog_classifications" ("operational_state", "classifier_version");
CREATE INDEX "idx_product_catalog_classifications_merchant" ON "product_catalog_classifications" ("merchant_id", "classified_at" DESC);

CREATE VIEW "latest_product_catalog_classifications" AS
SELECT DISTINCT ON ("product_id") *
FROM "product_catalog_classifications"
ORDER BY "product_id", "classified_at" DESC, "created_at" DESC, "id" DESC;

CREATE TABLE "product_variant_normalizations" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "variant_id" varchar(36) NOT NULL REFERENCES "product_variants"("id") ON DELETE CASCADE,
  "size_raw" text,
  "size_normalized" numeric(6,2),
  "size_status" varchar(30) NOT NULL,
  "colour_raw" text,
  "colour_normalized" text[],
  "colour_status" varchar(30) NOT NULL,
  "normalizer_version" varchar(80) NOT NULL,
  "normalized_at" timestamp NOT NULL,
  "reason_codes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_variant_size_status" CHECK ("size_status" IN ('NORMALIZED_SAFE','RAW_ONLY','SUSPICIOUS')),
  CONSTRAINT "chk_variant_colour_status" CHECK ("colour_status" IN ('NORMALIZED_SAFE','RAW_ONLY','SUSPICIOUS'))
);
CREATE INDEX "idx_variant_normalizations_variant_latest" ON "product_variant_normalizations" ("variant_id", "normalized_at" DESC, "created_at" DESC);
CREATE UNIQUE INDEX "uq_product_variant_normalizations_version" ON "product_variant_normalizations" ("variant_id", "normalizer_version");

CREATE VIEW "latest_product_variant_normalizations" AS
SELECT DISTINCT ON ("variant_id") *
FROM "product_variant_normalizations"
ORDER BY "variant_id", "normalized_at" DESC, "created_at" DESC, "id" DESC;

CREATE FUNCTION "reject_operational_catalog_history_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'operational catalog history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_product_catalog_classifications_append_only"
BEFORE UPDATE OR DELETE ON "product_catalog_classifications"
FOR EACH ROW EXECUTE FUNCTION "reject_operational_catalog_history_mutation"();

CREATE TRIGGER "trg_product_variant_normalizations_append_only"
BEFORE UPDATE OR DELETE ON "product_variant_normalizations"
FOR EACH ROW EXECUTE FUNCTION "reject_operational_catalog_history_mutation"();
