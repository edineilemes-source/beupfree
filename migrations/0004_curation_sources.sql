CREATE TYPE "curation_source_type" AS ENUM (
  'promotion', 'brand', 'category', 'outlet', 'campaign', 'other'
);

CREATE TYPE "curation_source_status" AS ENUM (
  'active', 'inactive', 'ended'
);

CREATE TABLE "curation_sources" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "marketplace_id" varchar(36) NOT NULL REFERENCES "marketplaces"("id"),
  "url" text NOT NULL,
  "source_type" "curation_source_type" NOT NULL,
  "status" "curation_source_status" DEFAULT 'active' NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "starts_at" timestamp,
  "ends_at" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_curation_sources_priority" CHECK ("priority" >= 0),
  CONSTRAINT "chk_curation_sources_url" CHECK ("url" ~* '^https?://[^[:space:]]+$'),
  CONSTRAINT "chk_curation_sources_dates" CHECK (
    "starts_at" IS NULL OR "ends_at" IS NULL OR "ends_at" >= "starts_at"
  )
);

CREATE INDEX "idx_curation_sources_status" ON "curation_sources" ("status");
CREATE INDEX "idx_curation_sources_marketplace" ON "curation_sources" ("marketplace_id");
CREATE INDEX "idx_curation_sources_type" ON "curation_sources" ("source_type");
CREATE INDEX "idx_curation_sources_priority" ON "curation_sources" ("priority");
