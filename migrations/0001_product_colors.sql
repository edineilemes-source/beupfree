CREATE TABLE IF NOT EXISTS "product_colors" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" varchar(36) NOT NULL,
  "color_name" varchar(120) NOT NULL,
  "normalized_color" varchar(120) NOT NULL,
  "source" varchar(60) NOT NULL,
  "confidence" numeric(4, 3) NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "chk_product_colors_confidence" CHECK ("confidence" >= 0 AND "confidence" <= 1),
  CONSTRAINT "product_colors_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_product_colors_product_normalized"
  ON "product_colors" USING btree ("product_id", "normalized_color");
CREATE INDEX IF NOT EXISTS "idx_product_colors_product"
  ON "product_colors" USING btree ("product_id");
CREATE INDEX IF NOT EXISTS "idx_product_colors_normalized"
  ON "product_colors" USING btree ("normalized_color");
