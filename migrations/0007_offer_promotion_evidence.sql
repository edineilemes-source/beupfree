-- DAFITI002: explicit, additive promotion evidence for staged commerce offers.
-- No existing row is changed and no publication state is relaxed.

CREATE TABLE IF NOT EXISTS "offer_promotion_evidence" (
  "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "offer_id" varchar(36) NOT NULL REFERENCES "offers"("id") ON DELETE CASCADE,
  "feed_id" varchar(36) REFERENCES "commerce_feeds"("id"),
  "promotion_status" varchar(40) NOT NULL,
  "promotion_evidence_type" varchar(60) NOT NULL,
  "old_price" numeric(10,2) NOT NULL,
  "current_price" numeric(10,2) NOT NULL,
  "discount_percent" numeric(7,3) NOT NULL,
  "evidence_source" varchar(80) NOT NULL,
  "evidence_observed_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_offer_promotion_price_order" CHECK ("old_price" > "current_price" AND "current_price" > 0),
  CONSTRAINT "chk_offer_promotion_discount" CHECK ("discount_percent" > 0 AND "discount_percent" <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_offer_promotion_evidence_offer_source"
  ON "offer_promotion_evidence" ("offer_id", "evidence_source");
CREATE INDEX IF NOT EXISTS "idx_offer_promotion_evidence_feed"
  ON "offer_promotion_evidence" ("feed_id", "evidence_observed_at");
