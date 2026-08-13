CREATE TABLE IF NOT EXISTS "user_favorites" (
  "user_id" varchar(36) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "product_id" varchar(36) NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "product_id")
);

CREATE INDEX IF NOT EXISTS "idx_user_favorites_user_created"
  ON "user_favorites" ("user_id", "created_at" DESC);
