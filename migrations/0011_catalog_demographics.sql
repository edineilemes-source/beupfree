-- Additive V4 schema. Apply/reproject only in a separately authorized operation.
ALTER TABLE catalog_search_products ADD COLUMN gender_normalized varchar(20);
ALTER TABLE catalog_search_products ADD COLUMN age_group_normalized varchar(20);
ALTER TABLE catalog_search_products ADD COLUMN demographic_taxonomy_version varchar(80);
ALTER TABLE catalog_search_products ADD COLUMN demographic_evidence jsonb;
ALTER TABLE catalog_search_products ADD CONSTRAINT catalog_gender_values CHECK (gender_normalized IN ('MASCULINO','FEMININO','UNISSEX'));
ALTER TABLE catalog_search_products ADD CONSTRAINT catalog_age_group_values CHECK (age_group_normalized IN ('ADULTO','INFANTIL','BEBE'));
CREATE INDEX idx_catalog_search_gender ON catalog_search_products (merchant_id,gender_normalized,product_id);
CREATE INDEX idx_catalog_search_age_group ON catalog_search_products (merchant_id,age_group_normalized,product_id);
