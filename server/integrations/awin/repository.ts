import type { Pool, PoolClient, QueryResult } from "pg";
import type { NormalizedAwinItem } from "./types";

export type ImportDisposition = "created" | "updated" | "unchanged" | "invalid" | "ignored";
export type AwinImportReport = Record<ImportDisposition, number> & { seen: number; missingCandidates: number };

type Queryable = { query(text: string, values?: unknown[]): Promise<QueryResult<any>> };
type TransactionPool = Pick<Pool, "connect">;

const safeDate = (value: unknown): Date | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
};

/** Defense in depth: feed transport credentials never belong in persisted row payloads. */
export function sanitizeRawPayload(payload: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !/(?:api.?key|access.?token|password|secret|feed.?url)/i.test(key)));
}

async function one(db: Queryable, text: string, values: unknown[]) {
  return (await db.query(text, values)).rows[0];
}

export class PostgresAwinRepository {
  constructor(private readonly pool: TransactionPool) {}

  async import(items: NormalizedAwinItem[], options: { feedId: string; now?: Date }): Promise<AwinImportReport> {
    const client = await this.pool.connect();
    const now = options.now ?? new Date();
    const report: AwinImportReport = { seen: items.length, created: 0, updated: 0, unchanged: 0, invalid: 0, ignored: 0, missingCandidates: 0 };
    try {
      await client.query("BEGIN");
      const provider = await one(client, `INSERT INTO commerce_providers (code,name,provider_type) VALUES ('awin','Awin','affiliate_network') ON CONFLICT (code) DO UPDATE SET updated_at=commerce_providers.updated_at RETURNING id`, []);
      const feed = await one(client, `INSERT INTO commerce_feeds (provider_id,external_feed_id,active,last_import_started_at,updated_at) VALUES ($1,$2,true,$3,$3) ON CONFLICT (provider_id,external_feed_id) DO UPDATE SET last_import_started_at=EXCLUDED.last_import_started_at,updated_at=EXCLUDED.updated_at RETURNING id`, [provider.id, options.feedId, now]);

      const existingRows = await client.query(`SELECT identity_hash,content_hash FROM commerce_raw_feed_items WHERE feed_id=$1`, [feed.id]);
      const existingContent = new Map(existingRows.rows.map((row) => [row.identity_hash as string, row.content_hash as string]));
      const unchanged = items.filter((item) => existingContent.get(item.raw.identityHash) === item.raw.contentHash);
      if (unchanged.length) {
        await client.query(`UPDATE commerce_raw_feed_items SET last_seen_at=$2,updated_at=$2 WHERE feed_id=$1 AND identity_hash=ANY($3::varchar[])`, [feed.id, now, unchanged.map((item) => item.raw.identityHash)]);
        report.unchanged = unchanged.length;
      }
      const changedItems = items.filter((item) => existingContent.get(item.raw.identityHash) !== item.raw.contentHash);
      const merchantMap = new Map<string, string>();
      for (const item of changedItems) {
        if (merchantMap.has(item.provenance.merchantId)) continue;
        const merchant = await one(client, `INSERT INTO commerce_merchants (provider_id,external_merchant_id,name,active) VALUES ($1,$2,$3,true) ON CONFLICT (provider_id,external_merchant_id) DO UPDATE SET name=EXCLUDED.name,updated_at=$4 RETURNING id`, [provider.id, item.provenance.merchantId, item.provenance.merchantName ?? item.provenance.merchantId, now]);
        merchantMap.set(item.provenance.merchantId, merchant.id);
      }
      const productKeys = Array.from(new Set(changedItems.map((item) => item.productKey)));
      const identityRows = productKeys.length ? await client.query(`SELECT e.id,e.product_id,e.external_product_key,m.external_merchant_id FROM external_product_identities e JOIN commerce_merchants m ON m.id=e.merchant_id WHERE e.provider_id=$1 AND e.external_product_key=ANY($2::varchar[])`, [provider.id, productKeys]) : { rows: [] };
      const identityMap = new Map<string, { id: string; product_id: string }>(identityRows.rows.map((row) => [`${row.external_merchant_id}:${row.external_product_key}`, { id: row.id, product_id: row.product_id }]));
      const pendingImages: Array<Record<string, unknown>> = [];
      const pendingRaw: Array<Record<string, unknown>> = [];
      for (const item of changedItems) await this.persistItem(client, provider.id, feed.id, merchantMap.get(item.provenance.merchantId)!, identityMap, existingContent, pendingImages, pendingRaw, item, now, report);
      const deduplicatedImages = Array.from(new Map(pendingImages.map((image) => [`${image.product_id}:${image.url}`, image])).values());
      if (deduplicatedImages.length) await client.query(`INSERT INTO product_images (product_id,variant_id,provider_id,url,alt,sort_order,is_primary,external_identity,image_type,provenance_method)
        SELECT product_id,variant_id,provider_id,url,alt,sort_order,is_primary,url,'merchant','merchant_provided' FROM jsonb_to_recordset($1::jsonb)
        AS x(product_id varchar,variant_id varchar,provider_id varchar,url text,alt text,sort_order integer,is_primary boolean)
        ON CONFLICT (product_id,url) WHERE provider_id IS NOT NULL DO UPDATE SET variant_id=COALESCE(product_images.variant_id,EXCLUDED.variant_id)`, [JSON.stringify(deduplicatedImages)]);
      if (pendingRaw.length) await client.query(`INSERT INTO commerce_raw_feed_items (provider_id,merchant_id,feed_id,external_product_id,merchant_product_id,identity_hash,content_hash,raw_payload,first_seen_at,last_seen_at,updated_at)
        SELECT provider_id,merchant_id,feed_id,external_product_id,merchant_product_id,identity_hash,content_hash,raw_payload,$2,$2,$2 FROM jsonb_to_recordset($1::jsonb)
        AS x(provider_id varchar,merchant_id varchar,feed_id varchar,external_product_id text,merchant_product_id text,identity_hash varchar,content_hash varchar,raw_payload jsonb)
        ON CONFLICT (provider_id,merchant_id,feed_id,identity_hash) DO UPDATE SET external_product_id=EXCLUDED.external_product_id,merchant_product_id=EXCLUDED.merchant_product_id,content_hash=EXCLUDED.content_hash,raw_payload=EXCLUDED.raw_payload,last_seen_at=$2,updated_at=$2`, [JSON.stringify(pendingRaw), now]);

      const presentHashes = items.map((item) => item.raw.identityHash);
      const missing = presentHashes.length
        ? await one(client, `SELECT count(*)::int AS count FROM commerce_raw_feed_items WHERE feed_id=$1 AND NOT (identity_hash = ANY($2::varchar[]))`, [feed.id, presentHashes])
        : await one(client, `SELECT count(*)::int AS count FROM commerce_raw_feed_items WHERE feed_id=$1`, [feed.id]);
      report.missingCandidates = missing.count;
      const feedMerchants = await client.query(`SELECT DISTINCT merchant_id FROM commerce_raw_feed_items WHERE feed_id=$1`, [feed.id]);
      const soleMerchantId = feedMerchants.rows.length === 1 ? feedMerchants.rows[0].merchant_id : null;
      await client.query(`UPDATE commerce_feeds SET merchant_id=$2,last_seen_at=$3,last_import_completed_at=$3,updated_at=$3 WHERE id=$1`, [feed.id, soleMerchantId, now]);
      await client.query("COMMIT");
      return report;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      (client as PoolClient).release();
    }
  }

  private async persistItem(db: Queryable, providerId: string, feedId: string, merchantId: string, identityMap: Map<string, { id: string; product_id: string }>, existingContent: Map<string, string>, pendingImages: Array<Record<string, unknown>>, pendingRaw: Array<Record<string, unknown>>, item: NormalizedAwinItem, now: Date, report: AwinImportReport) {
    const disposition: ImportDisposition = existingContent.has(item.raw.identityHash) ? "updated" : "created";
    const identityCacheKey = `${item.provenance.merchantId}:${item.productKey}`;

    let identity = identityMap.get(identityCacheKey);
    if (!identity) {
      const product = await one(db, `INSERT INTO products (main_name,slug,short_description,detailed_description,main_image_url,catalog_status) VALUES ($1,$2,$3,$4,$5,'draft') RETURNING id`, [item.product.name, `awin-${item.productKey}`, item.product.shortDescription, item.product.description, item.images[0] ?? null]);
      const parent = item.product.identifiers.parentProductId;
      const createdIdentity = await one(db, `INSERT INTO external_product_identities (product_id,provider_id,merchant_id,feed_id,external_product_key,parent_product_id,merchant_product_page_url,identity_method,publication_state,provenance_method,active,last_seen_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'staging','normalized',false,$9) RETURNING id,product_id`, [product.id, providerId, merchantId, feedId, item.productKey, parent, item.offer.merchantUrl, parent ? "parent_product_id" : item.offer.merchantUrl ? "merchant_page_url" : "normalized_fallback", now]);
      identity = createdIdentity;
      identityMap.set(identityCacheKey, createdIdentity);
    } else {
      await db.query(`UPDATE external_product_identities SET feed_id=$2,last_seen_at=$3,updated_at=$3 WHERE id=$1`, [identity.id, feedId, now]);
      if (disposition === "updated") await db.query(`UPDATE products SET main_name=$2,short_description=$3,detailed_description=$4,main_image_url=COALESCE($5,main_image_url),updated_at=$6 WHERE id=$1 AND catalog_status='draft'`, [identity.product_id, item.product.name, item.product.shortDescription, item.product.description, item.images[0] ?? null, now]);
    }

    if (!identity) throw new Error("Falha ao resolver identidade externa do produto");

    const ids = item.product.identifiers;
    const validGtin = item.variant.validGtin;
    const variant = await one(db, `INSERT INTO product_variants (product_id,provider_id,merchant_id,external_variant_key,merchant_product_id,aw_product_id,ean,gtin,upc,mpn,size,colour,attributes,active,last_seen_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,false,$14) ON CONFLICT (provider_id,merchant_id,external_variant_key) DO UPDATE SET product_id=EXCLUDED.product_id,merchant_product_id=EXCLUDED.merchant_product_id,aw_product_id=EXCLUDED.aw_product_id,ean=EXCLUDED.ean,gtin=EXCLUDED.gtin,upc=EXCLUDED.upc,mpn=EXCLUDED.mpn,size=EXCLUDED.size,colour=EXCLUDED.colour,attributes=EXCLUDED.attributes,last_seen_at=$14,updated_at=$14 RETURNING id`, [identity.product_id, providerId, merchantId, item.variantKey, ids.merchantProductId, ids.awProductId, validGtin ? item.variant.ean : null, validGtin, ids.upc, ids.mpn, item.variant.size, item.variant.colour, JSON.stringify({ sizeStockStatus: item.variant.sizeStockStatus }), now]);
    const availability = item.offer.availability;
    await db.query(`INSERT INTO offers (product_id,variant_id,provider_id,merchant_id,external_offer_key,current_price,original_price,rrp_price,saving,savings_percent,currency,original_url,affiliate_url,external_id,in_stock,is_for_sale,stock_status,valid_from,valid_to,status,active,last_seen_at,captured_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'paused',false,$20,$20,$20) ON CONFLICT (provider_id,merchant_id,external_offer_key) DO UPDATE SET variant_id=EXCLUDED.variant_id,current_price=EXCLUDED.current_price,original_price=EXCLUDED.original_price,rrp_price=EXCLUDED.rrp_price,saving=EXCLUDED.saving,savings_percent=EXCLUDED.savings_percent,currency=EXCLUDED.currency,original_url=EXCLUDED.original_url,affiliate_url=EXCLUDED.affiliate_url,in_stock=EXCLUDED.in_stock,is_for_sale=EXCLUDED.is_for_sale,stock_status=EXCLUDED.stock_status,valid_from=EXCLUDED.valid_from,valid_to=EXCLUDED.valid_to,last_seen_at=$20,updated_at=$20`, [identity.product_id, variant.id, providerId, merchantId, item.offerKey, String(item.offer.currentPrice), item.offer.prices.old?.toString() ?? null, item.offer.prices.rrp?.toString() ?? null, item.offer.prices.saving?.toString() ?? null, item.offer.prices.savingsPercent?.toString() ?? null, item.offer.currency, item.offer.merchantUrl, item.offer.affiliateUrl, ids.awProductId ?? ids.merchantProductId, availability.inStock, availability.isForSale, availability.stockStatus, safeDate(availability.validFrom), safeDate(availability.validTo), now]);
    for (let index = 0; index < item.images.length; index++) pendingImages.push({ product_id: identity.product_id, variant_id: variant.id, provider_id: providerId, url: item.images[index], alt: item.product.name, sort_order: index, is_primary: index === 0 });
    pendingRaw.push({ provider_id: providerId, merchant_id: merchantId, feed_id: feedId, external_product_id: ids.awProductId, merchant_product_id: ids.merchantProductId, identity_hash: item.raw.identityHash, content_hash: item.raw.contentHash, raw_payload: sanitizeRawPayload(item.raw.payload) });
    report[disposition]++;
  }
}
