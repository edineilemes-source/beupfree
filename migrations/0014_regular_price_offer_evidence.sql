-- UpPulse V1: permitir preço regular SEM inventar promoção.
-- NÃO executar automaticamente; exige backup/restauração testada, inspeção de constraints reais e gate de homologação.
-- Preserva todas as linhas existentes. A evidência bruta de old_price ausente permanece em commerce_raw_feed_items.

BEGIN;

ALTER TABLE offer_promotion_evidence
 DROP CONSTRAINT IF EXISTS chk_offer_promotion_price_order;
ALTER TABLE offer_promotion_evidence
 DROP CONSTRAINT IF EXISTS chk_offer_promotion_discount;
ALTER TABLE offer_promotion_evidence
 ADD CONSTRAINT chk_offer_promotion_price_order CHECK (
   current_price > 0 AND (
     (promotion_status = 'REGULAR_PRICE' AND old_price = current_price)
     OR (promotion_status <> 'REGULAR_PRICE' AND old_price > current_price)
   )
 );
ALTER TABLE offer_promotion_evidence
 ADD CONSTRAINT chk_offer_promotion_discount CHECK (
   (promotion_status = 'REGULAR_PRICE' AND discount_percent = 0)
   OR (promotion_status <> 'REGULAR_PRICE' AND discount_percent > 0 AND discount_percent <= 100)
 );

ALTER TABLE catalog_search_products
 ADD COLUMN IF NOT EXISTS promotion_status varchar(40) NOT NULL DEFAULT 'PROMOTION_CONFIRMED';
ALTER TABLE catalog_search_products
 DROP CONSTRAINT IF EXISTS chk_catalog_search_prices;
ALTER TABLE catalog_search_products
 DROP CONSTRAINT IF EXISTS chk_catalog_search_discount;
ALTER TABLE catalog_search_products
 ADD CONSTRAINT chk_catalog_search_prices CHECK (
  current_price > 0 AND (
   (promotion_status='REGULAR_PRICE' AND previous_price=current_price)
   OR (promotion_status<>'REGULAR_PRICE' AND previous_price>current_price)
  )
 );
ALTER TABLE catalog_search_products
 ADD CONSTRAINT chk_catalog_search_discount CHECK (
  (promotion_status='REGULAR_PRICE' AND discount_percent=0)
  OR (promotion_status<>'REGULAR_PRICE' AND discount_percent>0 AND discount_percent<=100)
 );

COMMIT;
