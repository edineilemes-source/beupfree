/** Fixed SELECT inventory. No caller supplies SQL, table names, or predicates. */
export const DISTINCT_LIMIT = 50_000;
export const TOP_LIMIT = 100;
export const EXAMPLE_LIMIT = 50;
export const REQUIRED_COLUMNS: Record<string, string[]> = {
  products: ["id", "primary_color"],
  product_variants: ["id", "product_id", "provider_id", "merchant_id", "colour", "active"],
  catalog_search_products: ["product_id", "provider_id", "merchant_id", "normalized_colors"],
  external_product_identities: ["product_id", "merchant_id", "provider_id"],
  commerce_merchants: ["id", "provider_id", "name", "external_merchant_id"],
  commerce_providers: ["id", "code"],
};
export const OPTIONAL_COLUMNS: Record<string, string[]> = {
  commerce_feeds: ["id", "external_feed_id"],
  commerce_raw_feed_items: ["feed_id", "provider_id", "merchant_id", "raw_payload"],
  offers: ["variant_id", "merchant_id", "provider_id", "in_stock"],
};
export const SCHEMA_SQL = `SELECT table_name, column_name FROM information_schema.columns
 WHERE table_schema='public' AND table_name=ANY($1::text[]) ORDER BY table_name,column_name`;
// pg_catalog is implicit only when omitted: SET LOCAL names it explicitly, so false includes it.
// Check configured tokens as well as resolved schemas; true also detects an implicit temp schema.
export const GUARD_SQL = `SELECT current_setting('transaction_read_only') AS read_only,
 current_setting('transaction_isolation') AS isolation_level,
 current_schemas(false) AS search_schemas,
 (regexp_replace(current_setting('search_path'), '[[:space:]" ]', '', 'g') = 'pg_catalog,public'
 AND current_schemas(false) = ARRAY['pg_catalog','public']::name[]
 AND current_schemas(true) = ARRAY['pg_catalog','public']::name[]) AS search_path_safe,
 (current_setting('statement_timeout')::interval > interval '0 seconds'
 AND current_setting('statement_timeout')::interval <= interval '60 seconds'
 AND current_setting('lock_timeout')::interval > interval '0 seconds'
 AND current_setting('lock_timeout')::interval <= interval '2 seconds') AS timeouts_bounded`;
const coverage = (table: string, column: string) => `SELECT count(*)::int total,
 count(*) FILTER(WHERE ${column} IS NULL)::int nulls,
 count(*) FILTER(WHERE ${column}='')::int empty,
 count(*) FILTER(WHERE ${column}<>'' AND ${column} ~ '^[[:space:]]*$')::int whitespace,
 count(*) FILTER(WHERE ${column} IS NOT NULL AND ${column} !~ '^[[:space:]]*$')::int with_color,
 count(DISTINCT ${column} COLLATE "C")::int distinct_values FROM ${table}`;
export const GLOBAL_SQL = `SELECT jsonb_build_object(
 'products',(SELECT to_jsonb(x) FROM (${coverage("products", "primary_color")}) x),
 'variants',(SELECT to_jsonb(x) FROM (${coverage("product_variants", "colour")}) x),
 'projection',(SELECT to_jsonb(x) FROM (SELECT count(*)::int total,
 count(*) FILTER(WHERE normalized_colors IS NULL)::int nulls,
 count(*) FILTER(WHERE cardinality(normalized_colors)=0)::int empty_arrays,
 count(*) FILTER(WHERE cardinality(normalized_colors)>0)::int nonempty_arrays,
 count(*) FILTER(WHERE EXISTS(SELECT 1 FROM unnest(normalized_colors) color WHERE color IS NOT NULL AND color !~ '^[[:space:]]*$'))::int with_color
 FROM catalog_search_products)x),
 'projectionElements',(SELECT to_jsonb(x) FROM (SELECT count(*)::int total,
 count(*) FILTER(WHERE color IS NULL)::int nulls,
 count(*) FILTER(WHERE color='')::int empty,
 count(*) FILTER(WHERE color<>'' AND color ~ '^[[:space:]]*$')::int whitespace,
 count(DISTINCT color COLLATE "C")::int distinct_values FROM catalog_search_products CROSS JOIN LATERAL unnest(normalized_colors) color)x)) AS metrics`;

// UNION deduplicates product associations before primary-color joins. No exclusive merchant assumption.
const associations = `associations AS (
 SELECT product_id,merchant_id,provider_id FROM product_variants
 UNION SELECT product_id,merchant_id,provider_id FROM catalog_search_products
 UNION SELECT product_id,merchant_id,provider_id FROM external_product_identities)`;
export const DISTRIBUTION_SQL = `WITH ${associations}, distribution AS (
 SELECT 'variant'::text source,colour COLLATE "C" value,count(*)::int frequency,count(DISTINCT product_id)::int products,
 count(*)::int variants,count(DISTINCT merchant_id)::int merchants FROM product_variants GROUP BY colour COLLATE "C"
 UNION ALL SELECT 'primary',p.primary_color COLLATE "C",count(DISTINCT p.id)::int,count(DISTINCT p.id)::int,NULL::int,
 count(DISTINCT a.merchant_id)::int FROM products p LEFT JOIN associations a ON a.product_id=p.id GROUP BY p.primary_color COLLATE "C"
 UNION ALL SELECT 'projection',color,count(*)::int,count(DISTINCT product_id)::int,NULL::int,count(DISTINCT merchant_id)::int
 FROM (SELECT DISTINCT c.product_id,c.merchant_id,color COLLATE "C" color FROM catalog_search_products c CROSS JOIN LATERAL unnest(c.normalized_colors) color)x GROUP BY color
 ), ranked AS (SELECT *,row_number() OVER(PARTITION BY source ORDER BY frequency DESC,value COLLATE "C" NULLS FIRST) rank FROM distribution)
 SELECT source,value,frequency,products,variants,merchants FROM ranked WHERE rank <= $1 ORDER BY source,rank`;

const facts = `${associations}, facts AS (
 SELECT 'product'::text entity,p.id row_id,a.product_id,a.merchant_id,a.provider_id,ARRAY[p.primary_color] COLLATE "C" colors FROM associations a JOIN products p ON p.id=a.product_id
 UNION ALL SELECT 'variant',id,product_id,merchant_id,provider_id,ARRAY[colour] COLLATE "C" FROM product_variants
 UNION ALL SELECT 'projection',product_id,product_id,merchant_id,provider_id,normalized_colors COLLATE "C" FROM catalog_search_products
 ), scoped AS (
 SELECT 'merchant'::text scope,merchant_id scope_id,* FROM facts
 UNION ALL SELECT 'provider',provider_id,* FROM facts
 )`;
export const SCOPED_SQL = `WITH ${facts}, totals AS (
 SELECT scope,scope_id,
 count(DISTINCT (row_id,merchant_id)) FILTER(WHERE entity='product')::int product_associations,
 count(DISTINCT product_id) FILTER(WHERE entity='product')::int products,
 count(DISTINCT product_id) FILTER(WHERE entity='product' AND color IS NULL)::int primary_nulls,
 count(DISTINCT product_id) FILTER(WHERE entity='product' AND color='')::int primary_empty,
 count(DISTINCT product_id) FILTER(WHERE entity='product' AND color<>'' AND color ~ '^[[:space:]]*$')::int primary_whitespace,
 count(DISTINCT row_id) FILTER(WHERE entity='variant')::int variants,
 count(DISTINCT row_id) FILTER(WHERE entity='variant' AND colors[1] IS NULL)::int variant_nulls,
 count(DISTINCT row_id) FILTER(WHERE entity='variant' AND colors[1]='')::int variant_empty,
 count(DISTINCT row_id) FILTER(WHERE entity='variant' AND colors[1]<>'' AND colors[1] ~ '^[[:space:]]*$')::int variant_whitespace,
 count(DISTINCT row_id) FILTER(WHERE entity='variant' AND colors[1] !~ '^[[:space:]]*$')::int variants_with_color,
 count(DISTINCT (row_id,merchant_id)) FILTER(WHERE entity='projection')::int projection_rows,
 count(DISTINCT (row_id,merchant_id)) FILTER(WHERE entity='projection' AND cardinality(colors)=0)::int projection_empty_arrays,
 count(DISTINCT (row_id,merchant_id)) FILTER(WHERE entity='projection' AND color !~ '^[[:space:]]*$')::int projection_rows_with_color,
 count(DISTINCT color) FILTER(WHERE entity='product')::int primary_distinct_colors,
 count(DISTINCT color) FILTER(WHERE entity='variant')::int variant_distinct_colors,
 count(DISTINCT color) FILTER(WHERE entity='projection')::int projection_distinct_colors
 FROM scoped LEFT JOIN LATERAL unnest(colors) color ON true GROUP BY scope,scope_id)
 SELECT s.scope,s.scope_id,s.name,s.external_merchant_id,s.provider_id,
 coalesce(t.product_associations,0) product_associations,coalesce(t.products,0) products,
 coalesce(t.primary_nulls,0) primary_nulls,coalesce(t.primary_empty,0) primary_empty,coalesce(t.primary_whitespace,0) primary_whitespace,
 coalesce(t.variants,0) variants,coalesce(t.variant_nulls,0) variant_nulls,coalesce(t.variant_empty,0) variant_empty,
 coalesce(t.variant_whitespace,0) variant_whitespace,coalesce(t.variants_with_color,0) variants_with_color,
 coalesce(t.projection_rows,0) projection_rows,coalesce(t.projection_empty_arrays,0) projection_empty_arrays,
 coalesce(t.projection_rows_with_color,0) projection_rows_with_color,
 coalesce(t.primary_distinct_colors,0) primary_distinct_colors,
 coalesce(t.variant_distinct_colors,0) variant_distinct_colors,coalesce(t.projection_distinct_colors,0) projection_distinct_colors,
 CASE WHEN coalesce(t.variants,0)=0 THEN NULL ELSE round(100.0*t.variants_with_color/t.variants,4) END color_coverage_percent
 FROM (SELECT 'merchant'::text scope,id scope_id,name,external_merchant_id,provider_id FROM commerce_merchants
 UNION ALL SELECT 'provider',id,code,NULL::text,id FROM commerce_providers)s
 LEFT JOIN totals t USING(scope,scope_id) ORDER BY s.scope,s.scope_id`;
export const SCOPED_TOP_SQL = `WITH ${facts}, counts AS (
 SELECT scope,scope_id,entity,value,
 CASE WHEN entity='product' THEN count(DISTINCT row_id) ELSE count(DISTINCT (row_id,merchant_id)) END::int frequency,count(DISTINCT product_id)::int products
 FROM scoped CROSS JOIN LATERAL unnest(colors) value GROUP BY scope,scope_id,entity,value
 ), ranked AS (SELECT *,row_number() OVER(PARTITION BY scope,scope_id,entity ORDER BY frequency DESC,value COLLATE "C" NULLS FIRST) rank FROM counts)
 SELECT scope,scope_id,entity,value,frequency,products FROM ranked WHERE rank<=100 ORDER BY scope,scope_id,entity,rank`;

export const COMPARISON_SQL = `WITH
 v AS (SELECT product_id,merchant_id,array_agg(DISTINCT colour COLLATE "C" ORDER BY colour COLLATE "C") FILTER(WHERE colour IS NOT NULL) colors FROM product_variants GROUP BY product_id,merchant_id),
 c AS (SELECT product_id,merchant_id,array_agg(DISTINCT color COLLATE "C" ORDER BY color COLLATE "C") FILTER(WHERE color IS NOT NULL) colors FROM catalog_search_products LEFT JOIN LATERAL unnest(normalized_colors) color ON true GROUP BY product_id,merchant_id),
 pairs AS (SELECT coalesce(v.product_id,c.product_id) product_id,coalesce(v.merchant_id,c.merchant_id) merchant_id,
 coalesce(v.colors,ARRAY[]::text[]) variant_colors,coalesce(c.colors,ARRAY[]::text[]) projection_colors FROM v FULL JOIN c USING(product_id,merchant_id)),
 divergent AS (SELECT * FROM pairs WHERE variant_colors COLLATE "C" IS DISTINCT FROM projection_colors COLLATE "C"),
 variant_product AS (SELECT product_id,count(DISTINCT colour COLLATE "C")::int n FROM product_variants GROUP BY product_id),
 projection_product AS (SELECT product_id,count(DISTINCT color COLLATE "C")::int n FROM catalog_search_products LEFT JOIN LATERAL unnest(normalized_colors) color ON true GROUP BY product_id),
 hist AS (SELECT 'variant'::text source,least(coalesce(v.n,0),4) bucket,count(*)::int products FROM products p LEFT JOIN variant_product v ON v.product_id=p.id GROUP BY least(coalesce(v.n,0),4)
 UNION ALL SELECT 'projection',least(coalesce(c.n,0),4),count(*)::int FROM products p LEFT JOIN projection_product c ON c.product_id=p.id GROUP BY least(coalesce(c.n,0),4))
 SELECT jsonb_build_object(
 'pairTotal',(SELECT count(*)::int FROM pairs),
 'divergentPairs',(SELECT count(*)::int FROM divergent),
 'divergentProducts',(SELECT count(DISTINCT product_id)::int FROM divergent),
 'variantValuesMissingProjection',(SELECT count(*)::int FROM pairs CROSS JOIN LATERAL unnest(variant_colors) value WHERE NOT(value COLLATE "C"=ANY(projection_colors))),
 'projectionValuesMissingVariant',(SELECT count(*)::int FROM pairs CROSS JOIN LATERAL unnest(projection_colors) value WHERE NOT(value COLLATE "C"=ANY(variant_colors))),
 'primaryValuesMissingProjectionPerPair',(SELECT count(*)::int FROM pairs JOIN products p ON p.id=pairs.product_id WHERE p.primary_color IS NOT NULL AND NOT(p.primary_color COLLATE "C"=ANY(projection_colors))),
 'primaryProductsMissingAnyProjection',(SELECT count(*)::int FROM products p WHERE p.primary_color IS NOT NULL AND NOT EXISTS(SELECT 1 FROM catalog_search_products c WHERE c.product_id=p.id AND p.primary_color COLLATE "C"=ANY(c.normalized_colors))),
 'variantRowsMissingProjection',(SELECT count(*)::int FROM product_variants v LEFT JOIN catalog_search_products c ON c.product_id=v.product_id AND c.merchant_id=v.merchant_id WHERE v.colour IS NOT NULL AND NOT(v.colour COLLATE "C"=ANY(coalesce(c.normalized_colors,ARRAY[]::text[])))),
 'histograms',coalesce((SELECT jsonb_agg(x ORDER BY source,bucket) FROM hist x),'[]'::jsonb),
 'examples',coalesce((SELECT jsonb_agg(x) FROM (SELECT * FROM divergent ORDER BY product_id,merchant_id LIMIT 50)x),'[]'::jsonb)) metrics`;
export const AVAILABILITY_SQL = `SELECT count(*)::int variants,
 count(*) FILTER(WHERE active)::int active_variants,
 count(*) FILTER(WHERE colour IS NOT NULL AND colour !~ '^[[:space:]]*$')::int colored_variants,
 count(*) FILTER(WHERE colour IS NOT NULL AND colour !~ '^[[:space:]]*$' AND EXISTS(
 SELECT 1 FROM offers o WHERE o.variant_id=v.id AND o.merchant_id=v.merchant_id AND o.provider_id=v.provider_id AND o.in_stock=true))::int colored_variants_with_stock_offer
 FROM product_variants v`;
export const FEED_SQL = `WITH raw AS (
 SELECT r.feed_id,r.provider_id,r.merchant_id,
 CASE WHEN jsonb_typeof(raw_payload->'colour')='string' THEN (raw_payload->>'colour') COLLATE "C" ELSE NULL END value,
 jsonb_typeof(raw_payload->'colour') kind FROM commerce_raw_feed_items r
 ), totals AS (SELECT feed_id,provider_id,merchant_id,count(*)::int raw_rows,
 count(*) FILTER(WHERE kind IS NULL)::int missing_field,
 count(*) FILTER(WHERE kind='null')::int json_null,
 count(*) FILTER(WHERE kind IS NOT NULL AND kind NOT IN('string','null'))::int nonstring_field,
 count(*) FILTER(WHERE value='')::int empty,
 count(*) FILTER(WHERE value<>'' AND value ~ '^[[:space:]]*$')::int whitespace,
 count(*) FILTER(WHERE value !~ '^[[:space:]]*$')::int with_color,
 count(DISTINCT value)::int distinct_values FROM raw GROUP BY feed_id,provider_id,merchant_id),
 ranked AS (SELECT feed_id,provider_id,merchant_id,value,count(*)::int frequency,
 row_number() OVER(PARTITION BY feed_id,provider_id,merchant_id ORDER BY count(*) DESC,value COLLATE "C" NULLS FIRST) rank
 FROM raw GROUP BY feed_id,provider_id,merchant_id,value)
 SELECT t.*,f.external_feed_id,round(100.0*t.with_color/nullif(t.raw_rows,0),4) color_coverage_percent,coalesce((SELECT jsonb_agg(jsonb_build_object('value',value,'frequency',frequency) ORDER BY rank)
 FROM ranked r WHERE r.feed_id=t.feed_id AND r.provider_id=t.provider_id AND r.merchant_id=t.merchant_id AND rank<=100),'[]'::jsonb) top
 FROM totals t JOIN commerce_feeds f ON f.id=t.feed_id ORDER BY t.feed_id,t.provider_id,t.merchant_id`;

// Offline analysis supplies exact stored values as bound parameters, never SQL.
export const IMPACT_SQL = `SELECT jsonb_build_object(
 'variant',jsonb_build_object(
 'changedProducts',(SELECT count(DISTINCT product_id)::int FROM product_variants WHERE colour COLLATE "C"=ANY($1::text[])),
 'collisionProducts',(SELECT count(DISTINCT product_id)::int FROM product_variants WHERE colour COLLATE "C"=ANY($2::text[]))),
 'primary',jsonb_build_object(
 'changedProducts',(SELECT count(*)::int FROM products WHERE primary_color COLLATE "C"=ANY($3::text[])),
 'collisionProducts',(SELECT count(*)::int FROM products WHERE primary_color COLLATE "C"=ANY($4::text[]))),
 'projection',jsonb_build_object(
 'changedProducts',(SELECT count(DISTINCT product_id)::int FROM catalog_search_products WHERE normalized_colors COLLATE "C" && $5::text[]),
 'collisionProducts',(SELECT count(DISTINCT product_id)::int FROM catalog_search_products WHERE normalized_colors COLLATE "C" && $6::text[]),
 'changedRows',(SELECT count(*)::int FROM catalog_search_products WHERE normalized_colors COLLATE "C" && $5::text[]),
 'collisionRows',(SELECT count(*)::int FROM catalog_search_products WHERE normalized_colors COLLATE "C" && $6::text[]))) AS metrics`;
