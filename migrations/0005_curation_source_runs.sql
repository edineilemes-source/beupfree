CREATE TYPE "curation_source_run_status" AS ENUM ('running', 'completed', 'failed');
CREATE TYPE "curation_source_trigger" AS ENUM ('manual', 'scheduled');

CREATE TABLE "curation_source_runs" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_id" varchar(36) NOT NULL REFERENCES "curation_sources"("id") ON DELETE CASCADE,
  "trigger_type" "curation_source_trigger" DEFAULT 'manual' NOT NULL,
  "status" "curation_source_run_status" DEFAULT 'running' NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp,
  "items_found" integer,
  "items_created" integer,
  "items_updated" integer,
  "items_ignored" integer,
  "error_message" text
);

CREATE INDEX "idx_curation_source_runs_source_started" ON "curation_source_runs" ("source_id", "started_at");
CREATE INDEX "idx_curation_source_runs_status" ON "curation_source_runs" ("status");
