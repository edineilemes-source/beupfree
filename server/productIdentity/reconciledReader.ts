/** Read-only SQL and brand fallback recovered verbatim from the approved real shadow runner.
 * Kept free of CLI entrypoints so bundling the application cannot launch an audit. */
export interface Source {
  id: string; productId: string; providerId: string; merchantId: string; feedId: string | null;
  externalProductKey: string; name: string; brandId: string | null; brandName: string | null;
  rawBrand: string | null; rawBrandCount: number; merchantName: string; providerCode: string;
  updatedAt: string | null; lastSeenAt: string; provenanceMethod: string;
}
export interface ReadClient {
  connect(): Promise<unknown>;
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
  end(): Promise<unknown>;
}
export const SQL = {
  universe: `SELECT
    (SELECT count(*)::int FROM products) products,
    (SELECT count(*)::int FROM external_product_identities) identities,
    (SELECT count(*)::int FROM product_variants) variants,
    (SELECT count(*)::int FROM commerce_providers) providers,
    (SELECT count(*)::int FROM commerce_merchants) merchants,
    (SELECT count(*)::int FROM commerce_feeds) feeds,
    (SELECT count(*)::int FROM brands) brands`,
  sources: `WITH raw_brands AS (
    SELECT v.product_id,v.provider_id,v.merchant_id,r.feed_id,
      min(nullif(btrim(r.raw_payload->>'brand_name'),'')) brand,
      count(DISTINCT lower(nullif(btrim(r.raw_payload->>'brand_name'),'')))::int brand_count
    FROM product_variants v JOIN commerce_raw_feed_items r
      ON r.provider_id=v.provider_id AND r.merchant_id=v.merchant_id
      AND r.merchant_product_id=v.merchant_product_id
    GROUP BY v.product_id,v.provider_id,v.merchant_id,r.feed_id
  ) SELECT e.id,e.product_id "productId",e.provider_id "providerId",e.merchant_id "merchantId",
    e.feed_id "feedId",e.external_product_key "externalProductKey",e.provenance_method "provenanceMethod",
    e.last_seen_at::text "lastSeenAt",p.updated_at::text "updatedAt",p.main_name name,
    p.brand_id "brandId",b.name "brandName",rb.brand "rawBrand",coalesce(rb.brand_count,0) "rawBrandCount",
    m.name "merchantName",cp.code "providerCode"
    FROM external_product_identities e JOIN products p ON p.id=e.product_id
    JOIN commerce_merchants m ON m.id=e.merchant_id AND m.provider_id=e.provider_id
    JOIN commerce_providers cp ON cp.id=e.provider_id LEFT JOIN brands b ON b.id=p.brand_id
    LEFT JOIN raw_brands rb ON rb.product_id=e.product_id AND rb.provider_id=e.provider_id
      AND rb.merchant_id=e.merchant_id AND rb.feed_id=e.feed_id ORDER BY e.id`,
  feeds: `SELECT id,provider_id "providerId",merchant_id "merchantId" FROM commerce_feeds WHERE id=ANY($1::text[]) ORDER BY id`,
  variants: `SELECT id,product_id "productId",provider_id "providerId",merchant_id "merchantId",
    external_variant_key "externalVariantKey",size,colour,gtin,ean,upc,mpn,
    provenance_method "provenanceMethod",updated_at::text "updatedAt",last_seen_at::text "lastSeenAt"
    FROM product_variants WHERE product_id=ANY($1::text[]) ORDER BY id`,
};
const fold = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const sourceBrand = (s: Source) => s.brandName?.trim() || (s.rawBrandCount === 1 ? s.rawBrand?.trim() : null) || null;
