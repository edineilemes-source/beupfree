-- AWIN003: additive normalized commerce staging model.
-- This migration does not publish, delete, rename, or seed merchant-specific data.

CREATE TYPE "commerce_publication_state" AS ENUM ('staging', 'approved', 'rejected');
CREATE TYPE "provenance_method" AS ENUM ('merchant_provided', 'normalized', 'ai_extracted', 'externally_enriched');

CREATE TABLE "commerce_providers" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(60) NOT NULL, "name" varchar(160) NOT NULL, "provider_type" varchar(60) NOT NULL,
  "active" boolean DEFAULT true NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "uq_commerce_providers_code" ON "commerce_providers" ("code");

CREATE TABLE "commerce_merchants" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" varchar(36) NOT NULL REFERENCES "commerce_providers"("id"), "external_merchant_id" text NOT NULL,
  "name" varchar(200) NOT NULL, "active" boolean DEFAULT true NOT NULL, "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "uq_commerce_merchants_provider_external" ON "commerce_merchants" ("provider_id", "external_merchant_id");
CREATE INDEX "idx_commerce_merchants_provider" ON "commerce_merchants" ("provider_id");

CREATE TABLE "commerce_feeds" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_id" varchar(36) NOT NULL REFERENCES "commerce_providers"("id"), "merchant_id" varchar(36) REFERENCES "commerce_merchants"("id"),
  "external_feed_id" text NOT NULL, "name" varchar(200), "locale" varchar(20), "language" varchar(20), "active" boolean DEFAULT true NOT NULL,
  "last_seen_at" timestamp, "last_import_started_at" timestamp, "last_import_completed_at" timestamp,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "uq_commerce_feeds_provider_external" ON "commerce_feeds" ("provider_id", "external_feed_id");
CREATE INDEX "idx_commerce_feeds_merchant" ON "commerce_feeds" ("merchant_id");

CREATE TABLE "external_product_identities" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "product_id" varchar(36) NOT NULL REFERENCES "products"("id"),
  "provider_id" varchar(36) NOT NULL REFERENCES "commerce_providers"("id"), "merchant_id" varchar(36) NOT NULL REFERENCES "commerce_merchants"("id"), "feed_id" varchar(36) REFERENCES "commerce_feeds"("id"),
  "external_product_key" varchar(64) NOT NULL, "parent_product_id" text, "merchant_product_page_url" text, "identity_method" varchar(40) NOT NULL,
  "publication_state" "commerce_publication_state" DEFAULT 'staging' NOT NULL, "provenance_method" "provenance_method" DEFAULT 'normalized' NOT NULL,
  "active" boolean DEFAULT false NOT NULL, "last_seen_at" timestamp DEFAULT now() NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "uq_external_products_provider_merchant_key" ON "external_product_identities" ("provider_id", "merchant_id", "external_product_key");
CREATE INDEX "idx_external_products_product" ON "external_product_identities" ("product_id");
CREATE INDEX "idx_external_products_feed_seen" ON "external_product_identities" ("feed_id", "last_seen_at");
CREATE INDEX "idx_external_products_publication" ON "external_product_identities" ("publication_state", "active");

CREATE TABLE "product_variants" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "product_id" varchar(36) NOT NULL REFERENCES "products"("id"),
  "provider_id" varchar(36) NOT NULL REFERENCES "commerce_providers"("id"), "merchant_id" varchar(36) NOT NULL REFERENCES "commerce_merchants"("id"),
  "external_variant_key" varchar(64) NOT NULL, "merchant_product_id" text, "aw_product_id" text, "ean" varchar(32), "gtin" varchar(32), "upc" varchar(32), "mpn" text,
  "size" text, "colour" text, "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL, "provenance_method" "provenance_method" DEFAULT 'merchant_provided' NOT NULL,
  "active" boolean DEFAULT false NOT NULL, "last_seen_at" timestamp DEFAULT now() NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "uq_product_variants_provider_merchant_key" ON "product_variants" ("provider_id", "merchant_id", "external_variant_key");
CREATE INDEX "idx_product_variants_product" ON "product_variants" ("product_id");
CREATE INDEX "idx_product_variants_seen" ON "product_variants" ("last_seen_at");

CREATE TABLE "commerce_raw_feed_items" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "provider_id" varchar(36) NOT NULL REFERENCES "commerce_providers"("id"),
  "merchant_id" varchar(36) NOT NULL REFERENCES "commerce_merchants"("id"), "feed_id" varchar(36) NOT NULL REFERENCES "commerce_feeds"("id"),
  "external_product_id" text, "merchant_product_id" text, "identity_hash" varchar(64) NOT NULL, "content_hash" varchar(64) NOT NULL, "raw_payload" jsonb NOT NULL,
  "first_seen_at" timestamp DEFAULT now() NOT NULL, "last_seen_at" timestamp DEFAULT now() NOT NULL, "created_at" timestamp DEFAULT now() NOT NULL, "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "uq_commerce_raw_feed_identity" ON "commerce_raw_feed_items" ("provider_id", "merchant_id", "feed_id", "identity_hash");
CREATE INDEX "idx_commerce_raw_feed_content" ON "commerce_raw_feed_items" ("content_hash");
CREATE INDEX "idx_commerce_raw_feed_seen" ON "commerce_raw_feed_items" ("feed_id", "last_seen_at");

ALTER TABLE "product_images" ADD COLUMN "provider_id" varchar(36) REFERENCES "commerce_providers"("id");
ALTER TABLE "product_images" ADD COLUMN "variant_id" varchar(36) REFERENCES "product_variants"("id");
ALTER TABLE "product_images" ADD COLUMN "external_identity" text;
ALTER TABLE "product_images" ADD COLUMN "image_type" varchar(40);
ALTER TABLE "product_images" ADD COLUMN "provenance_method" "provenance_method" DEFAULT 'merchant_provided';
CREATE UNIQUE INDEX "uq_product_images_product_url" ON "product_images" ("product_id", "url") WHERE "provider_id" IS NOT NULL;

ALTER TABLE "offers" ADD COLUMN "variant_id" varchar(36) REFERENCES "product_variants"("id");
ALTER TABLE "offers" ADD COLUMN "provider_id" varchar(36) REFERENCES "commerce_providers"("id");
ALTER TABLE "offers" ADD COLUMN "merchant_id" varchar(36) REFERENCES "commerce_merchants"("id");
ALTER TABLE "offers" ADD COLUMN "external_offer_key" varchar(64);
ALTER TABLE "offers" ADD COLUMN "rrp_price" numeric(10,2); ALTER TABLE "offers" ADD COLUMN "saving" numeric(10,2);
ALTER TABLE "offers" ADD COLUMN "savings_percent" numeric(7,3); ALTER TABLE "offers" ADD COLUMN "in_stock" boolean;
ALTER TABLE "offers" ADD COLUMN "is_for_sale" boolean; ALTER TABLE "offers" ADD COLUMN "stock_status" text;
ALTER TABLE "offers" ADD COLUMN "valid_from" timestamp; ALTER TABLE "offers" ADD COLUMN "valid_to" timestamp;
ALTER TABLE "offers" ADD COLUMN "active" boolean DEFAULT true NOT NULL;
ALTER TABLE "offers" ADD COLUMN "provenance_method" "provenance_method" DEFAULT 'merchant_provided';
CREATE UNIQUE INDEX "uq_offers_provider_merchant_external_key" ON "offers" ("provider_id", "merchant_id", "external_offer_key");

-- Idempotent provider seed. No merchant, feed URL, API key, or secret is stored.
INSERT INTO "commerce_providers" ("code", "name", "provider_type") VALUES ('awin', 'Awin', 'affiliate_network')
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "provider_type" = EXCLUDED."provider_type", "updated_at" = now();
