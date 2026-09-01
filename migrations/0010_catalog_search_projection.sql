-- UPCAT001.3: rebuildable, multi-merchant read projection. Do not apply in this mission.
CREATE TABLE "catalog_search_products" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" varchar(36) NOT NULL REFERENCES "products"("id"),
  "provider_id" varchar(36) NOT NULL REFERENCES "commerce_providers"("id"),
  "merchant_id" varchar(36) NOT NULL REFERENCES "commerce_merchants"("id"),
  "representative_offer_id" varchar(36) NOT NULL REFERENCES "offers"("id"),
  "product_name" text NOT NULL,
  "brand_raw" text NOT NULL,
  "brand_normalized" text NOT NULL,
  "audience_raw" text,
  "audience_normalized" varchar(20) NOT NULL,
  "universe" varchar(40) NOT NULL,
  "style" varchar(40) NOT NULL,
  "activities" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "current_price" numeric(10,2) NOT NULL,
  "previous_price" numeric(10,2) NOT NULL,
  "discount_percent" numeric(7,3) NOT NULL,
  "currency" varchar(10) NOT NULL,
  "available" boolean DEFAULT false NOT NULL,
  "normalized_sizes" numeric(6,2)[] DEFAULT ARRAY[]::numeric[] NOT NULL,
  "normalized_colors" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "primary_image_url" text,
  "catalog_state" varchar(30) NOT NULL,
  "classifier_version" varchar(80) NOT NULL,
  "normalizer_version" varchar(80) NOT NULL,
  "source_snapshot" text NOT NULL,
  "projection_version" varchar(80) NOT NULL,
  "source_updated_at" timestamp NOT NULL,
  "projected_at" timestamp NOT NULL,
  CONSTRAINT "uq_catalog_search_product_merchant" UNIQUE("product_id","merchant_id"),
  CONSTRAINT "chk_catalog_search_eligible" CHECK ("catalog_state" = 'CATALOG_ELIGIBLE'),
  CONSTRAINT "chk_catalog_search_prices" CHECK ("current_price" > 0 AND "previous_price" > "current_price"),
  CONSTRAINT "chk_catalog_search_discount" CHECK ("discount_percent" > 0 AND "discount_percent" <= 100)
);

CREATE INDEX "idx_catalog_search_brand" ON "catalog_search_products" ("merchant_id","brand_normalized","product_id");
CREATE INDEX "idx_catalog_search_audience" ON "catalog_search_products" ("merchant_id","audience_normalized","product_id");
CREATE INDEX "idx_catalog_search_style" ON "catalog_search_products" ("merchant_id","style","product_id");
CREATE INDEX "idx_catalog_search_price" ON "catalog_search_products" ("merchant_id","current_price","product_id");
CREATE INDEX "idx_catalog_search_discount" ON "catalog_search_products" ("merchant_id","discount_percent" DESC,"product_id");
CREATE INDEX "idx_catalog_search_name" ON "catalog_search_products" ("merchant_id","product_name","product_id");
CREATE INDEX "idx_catalog_search_available" ON "catalog_search_products" ("merchant_id","available","product_id");
CREATE INDEX "idx_catalog_search_activities" ON "catalog_search_products" USING gin ("activities");
CREATE INDEX "idx_catalog_search_sizes" ON "catalog_search_products" USING gin ("normalized_sizes");
CREATE INDEX "idx_catalog_search_colors" ON "catalog_search_products" USING gin ("normalized_colors");
