import type { Pool, PoolClient, QueryResult } from "pg";
import type { AwinFeedItem, NormalizedAwinItem } from "./types";
import { classifyDafitiPromotion, parseDafitiMoney } from "./dafitiAudit";
import { isInvalidAwinItem, normalizeAwinItem, parseAwinBoolean } from "./normalize";
import { sanitizeRawPayload } from "./repository";

const IMAGE_FIELDS = ["merchant_image_url", "aw_image_url", "merchant_thumb_url", "large_image", "aw_thumb_url", "alternate_image", "alternate_image_two", "alternate_image_three", "alternate_image_four"];
const clean = (value: string | null | undefined) => (value ?? "").trim();
const fold = (value: string | null | undefined) => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
const validUrl = (input: string | undefined) => { try { const url = new URL(clean(input)); return ["http:", "https:"].includes(url.protocol); } catch { return false; } };
const inStock = (raw: Record<string, string>) => parseAwinBoolean(clean(raw.in_stock) || null) ?? /^(?:in stock|available|em estoque)$/i.test(clean(raw.stock_status));
const slug = (key: string) => `awin-${key}`;

export type DafitiEligibleItem = NormalizedAwinItem & {
  dafiti: { dataFeedId: string; category: "tênis" | "tênis performance"; oldPrice: number; currentPrice: number; discountPercent: number };
};

export function eligibleDafitiItem(row: AwinFeedItem): { item: DafitiEligibleItem | null; reason: string } {
  const category = fold(row.raw.merchant_category);
  if (category !== "tenis" && category !== "tenis performance") return { item: null, reason: "not_confirmed_sneaker" };
  const promotion = classifyDafitiPromotion(row.raw);
  if (promotion.classification !== "PROMOTION_CONFIRMED") return { item: null, reason: `promotion_${promotion.classification.toLowerCase()}` };
  if (!inStock(row.raw)) return { item: null, reason: "not_in_stock" };
  if (!validUrl(row.raw.aw_deep_link)) return { item: null, reason: "invalid_affiliate_url" };
  if (!validUrl(row.raw.merchant_deep_link)) return { item: null, reason: "invalid_merchant_url" };
  if (!clean(row.raw.brand_name)) return { item: null, reason: "missing_brand" };
  if (!IMAGE_FIELDS.some((field) => validUrl(row.raw[field]))) return { item: null, reason: "missing_image" };
  const dataFeedId = clean(row.raw.data_feed_id);
  if (!dataFeedId) return { item: null, reason: "missing_data_feed_id" };
  const normalized = normalizeAwinItem(row, { feedId: dataFeedId, ingestedAt: "dafiti-staging" });
  if (isInvalidAwinItem(normalized)) return { item: null, reason: `invalid:${normalized.reasons.join("|")}` };
  if (!clean(row.raw.parent_product_id) && !validUrl(row.raw.merchant_deep_link)) return { item: null, reason: "unsafe_product_identity" };
  if (!clean(row.raw.merchant_product_id) && !normalized.variant.validGtin) return { item: null, reason: "unsafe_variant_identity" };
  normalized.variant.size = clean(row.raw["Fashion:size"]) || normalized.variant.size;
  normalized.offer.prices.old = promotion.old;
  normalized.offer.prices.savingsPercent = promotion.discountPercent;
  normalized.offer.prices.saving = promotion.old! - promotion.current!;
  return { item: Object.assign(normalized, { dafiti: { dataFeedId, category: clean(row.raw.merchant_category) as "tênis" | "tênis performance", oldPrice: promotion.old!, currentPrice: promotion.current!, discountPercent: promotion.discountPercent! } }), reason: "eligible" };
}

export type DafitiImportReport = { seen: number; eligible: number; ignored: number; invalid: number; created: number; updated: number; unchanged: number; batches: number; roundTrips: number; ignoredReasons: Record<string, number> };
type Queryable = { query(text: string, values?: unknown[]): Promise<QueryResult<any>> };
const one = async (db: Queryable, sql: string, values: unknown[] = []) => (await db.query(sql, values)).rows[0];

export class DafitiStagingRepository {
  private providerId = "";
  private merchantDbIds = new Map<string, string>();
  private feedDbIds = new Map<string, string>();
  private productIds = new Map<string, string>();
  roundTrips = 0;
  constructor(private readonly pool: Pick<Pool, "connect">) {}
  private async query(db: Queryable, sql: string, values: unknown[] = []) { this.roundTrips++; return db.query(sql, values); }

  async initialize(sample: DafitiEligibleItem, now: Date) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const provider = await one(client, "INSERT INTO commerce_providers (code,name,provider_type) VALUES ($1,$2,$3) ON CONFLICT (code) DO UPDATE SET updated_at=commerce_providers.updated_at RETURNING id", ["awin", "Awin", "affiliate_network"]); this.roundTrips++;
      this.providerId = provider.id;
      const merchant = await one(client, "INSERT INTO commerce_merchants (provider_id,external_merchant_id,name,active) VALUES ($1,$2,$3,true) ON CONFLICT (provider_id,external_merchant_id) DO UPDATE SET name=EXCLUDED.name,updated_at=$4 RETURNING id", [this.providerId, sample.provenance.merchantId, sample.provenance.merchantName ?? sample.provenance.merchantId, now]); this.roundTrips++;
      this.merchantDbIds.set(sample.provenance.merchantId, merchant.id);
      const existing = await this.query(client, "SELECT external_product_key,product_id FROM external_product_identities WHERE provider_id=$1 AND merchant_id=$2", [this.providerId, merchant.id]);
      for (const row of existing.rows) this.productIds.set(row.external_product_key, row.product_id);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { (client as PoolClient).release(); }
  }

  private async ensureFeeds(db: Queryable, items: DafitiEligibleItem[], now: Date) {
    const feedIds = Array.from(new Set(items.map((item) => item.dafiti.dataFeedId))).filter((id) => !this.feedDbIds.has(id));
    if (!feedIds.length) return;
    const merchantId = this.merchantDbIds.get(items[0].provenance.merchantId)!;
    const result = await this.query(db, "INSERT INTO commerce_feeds (provider_id,merchant_id,external_feed_id,name,active,last_import_started_at,metadata,updated_at) SELECT $1,$2,x.external_feed_id,$3,true,$4,jsonb_build_object($5::text,$6::text),$4 FROM unnest($7::text[]) x(external_feed_id) ON CONFLICT (provider_id,external_feed_id) DO UPDATE SET merchant_id=EXCLUDED.merchant_id,last_import_started_at=EXCLUDED.last_import_started_at,updated_at=EXCLUDED.updated_at RETURNING id,external_feed_id", [this.providerId, merchantId, "Dafiti Awin Product Feed", now, "source", "local_file", feedIds]);
    for (const row of result.rows) this.feedDbIds.set(row.external_feed_id, row.id);
  }

  async importBatch(items: DafitiEligibleItem[], now: Date) {
    const client = await this.pool.connect();
    const result = { created: 0, updated: 0, unchanged: 0 };
    try {
      await client.query("BEGIN");
      await this.ensureFeeds(client, items, now);
      const merchantId = this.merchantDbIds.get(items[0].provenance.merchantId)!;
      const rawKeys = items.map((item) => ({ feed_id: this.feedDbIds.get(item.dafiti.dataFeedId), identity_hash: item.raw.identityHash }));
      const existingRaw = await this.query(client, "SELECT r.identity_hash,r.content_hash,r.feed_id FROM commerce_raw_feed_items r JOIN jsonb_to_recordset($1::jsonb) x(feed_id varchar,identity_hash varchar) ON x.feed_id=r.feed_id AND x.identity_hash=r.identity_hash WHERE r.provider_id=$2 AND r.merchant_id=$3", [JSON.stringify(rawKeys), this.providerId, merchantId]);
      const hashes = new Map(existingRaw.rows.map((row) => [`${row.feed_id}:${row.identity_hash}`, row.content_hash]));
      const changed = items.filter((item) => hashes.get(`${this.feedDbIds.get(item.dafiti.dataFeedId)}:${item.raw.identityHash}`) !== item.raw.contentHash);
      result.unchanged = items.length - changed.length;
      if (result.unchanged) await this.query(client, "UPDATE commerce_raw_feed_items r SET last_seen_at=$2,updated_at=$2 FROM jsonb_to_recordset($1::jsonb) x(feed_id varchar,identity_hash varchar) WHERE r.feed_id=x.feed_id AND r.identity_hash=x.identity_hash", [JSON.stringify(rawKeys.filter((key) => hashes.has(`${key.feed_id}:${key.identity_hash}`))), now]);
      if (!changed.length) { await client.query("COMMIT"); return result; }
      result.created = changed.filter((item) => !hashes.has(`${this.feedDbIds.get(item.dafiti.dataFeedId)}:${item.raw.identityHash}`)).length;
      result.updated = changed.length - result.created;

      const newProducts = Array.from(new Map(changed.filter((item) => !this.productIds.has(item.productKey)).map((item) => [item.productKey, item])).values());
      if (newProducts.length) {
        const rows = newProducts.map((item) => ({ product_key: item.productKey, name: item.product.name, short_description: item.product.shortDescription, description: item.product.description, image: item.images[0] ?? null, usage: item.dafiti.category, colour: item.variant.colour }));
        const inserted = await this.query(client, "INSERT INTO products (main_name,slug,short_description,detailed_description,main_image_url,usage_type,primary_color,catalog_status) SELECT x.name,$2||x.product_key,x.short_description,x.description,x.image,x.usage,x.colour,$3 FROM jsonb_to_recordset($1::jsonb) x(product_key varchar,name text,short_description text,description text,image text,usage varchar,colour varchar) ON CONFLICT (slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id,slug", [JSON.stringify(rows), "awin-", "draft"]);
        const insertedMap = new Map(inserted.rows.map((row) => [row.slug, row.id]));
        const identities = newProducts.map((item) => ({ product_id: insertedMap.get(slug(item.productKey)), product_key: item.productKey, feed_id: this.feedDbIds.get(item.dafiti.dataFeedId), page_url: item.offer.merchantUrl, parent_id: item.product.identifiers.parentProductId }));
        await this.query(client, "INSERT INTO external_product_identities (product_id,provider_id,merchant_id,feed_id,external_product_key,parent_product_id,merchant_product_page_url,identity_method,publication_state,provenance_method,active,last_seen_at) SELECT x.product_id,$2,$3,x.feed_id,x.product_key,x.parent_id,x.page_url,CASE WHEN x.parent_id IS NOT NULL THEN $4 ELSE $5 END,$6,$7,false,$8 FROM jsonb_to_recordset($1::jsonb) x(product_id varchar,product_key varchar,feed_id varchar,page_url text,parent_id text) ON CONFLICT (provider_id,merchant_id,external_product_key) DO UPDATE SET feed_id=EXCLUDED.feed_id,last_seen_at=EXCLUDED.last_seen_at,updated_at=EXCLUDED.last_seen_at", [JSON.stringify(identities), this.providerId, merchantId, "parent_product_id", "merchant_page_url", "staging", "normalized", now]);
        for (const item of newProducts) this.productIds.set(item.productKey, insertedMap.get(slug(item.productKey))!);
      }

      const variantRows = changed.map((item) => ({ product_id: this.productIds.get(item.productKey), variant_key: item.variantKey, merchant_product_id: item.product.identifiers.merchantProductId, aw_product_id: item.product.identifiers.awProductId, size: item.variant.size, colour: item.variant.colour, mpn: item.product.identifiers.mpn, attributes: { sizeStockStatus: item.variant.sizeStockStatus, dataFeedId: item.dafiti.dataFeedId, category: item.dafiti.category } }));
      await this.query(client, "INSERT INTO product_variants (product_id,provider_id,merchant_id,external_variant_key,merchant_product_id,aw_product_id,mpn,size,colour,attributes,provenance_method,active,last_seen_at) SELECT x.product_id,$2,$3,x.variant_key,x.merchant_product_id,x.aw_product_id,x.mpn,x.size,x.colour,x.attributes,$4,false,$5 FROM jsonb_to_recordset($1::jsonb) x(product_id varchar,variant_key varchar,merchant_product_id text,aw_product_id text,mpn text,size text,colour text,attributes jsonb) ON CONFLICT (provider_id,merchant_id,external_variant_key) DO UPDATE SET product_id=EXCLUDED.product_id,merchant_product_id=EXCLUDED.merchant_product_id,aw_product_id=EXCLUDED.aw_product_id,mpn=EXCLUDED.mpn,size=EXCLUDED.size,colour=EXCLUDED.colour,attributes=EXCLUDED.attributes,active=false,last_seen_at=$5,updated_at=$5", [JSON.stringify(variantRows), this.providerId, merchantId, "merchant_provided", now]);
      const variantIdsResult = await this.query(client, "SELECT external_variant_key,id FROM product_variants WHERE provider_id=$1 AND merchant_id=$2 AND external_variant_key=ANY($3::varchar[])", [this.providerId, merchantId, changed.map((item) => item.variantKey)]);
      const variantIds = new Map(variantIdsResult.rows.map((row) => [row.external_variant_key, row.id]));
      const offerRows = changed.map((item) => ({ product_id: this.productIds.get(item.productKey), variant_id: variantIds.get(item.variantKey), offer_key: item.offerKey, current_price: item.dafiti.currentPrice, old_price: item.dafiti.oldPrice, discount: item.dafiti.discountPercent, currency: item.offer.currency, merchant_url: item.offer.merchantUrl, affiliate_url: item.offer.affiliateUrl, external_id: item.product.identifiers.awProductId ?? item.product.identifiers.merchantProductId, stock_status: item.offer.availability.stockStatus }));
      await this.query(client, "INSERT INTO offers (product_id,variant_id,provider_id,merchant_id,external_offer_key,current_price,original_price,saving,savings_percent,discount_percent,currency,original_url,affiliate_url,external_id,in_stock,is_for_sale,stock_status,status,active,provenance_method,last_seen_at,captured_at,updated_at) SELECT x.product_id,x.variant_id,$2,$3,x.offer_key,x.current_price,x.old_price,x.old_price-x.current_price,x.discount,round(x.discount)::integer,x.currency,x.merchant_url,x.affiliate_url,x.external_id,true,true,x.stock_status,$4,false,$5,$6,$6,$6 FROM jsonb_to_recordset($1::jsonb) x(product_id varchar,variant_id varchar,offer_key varchar,current_price numeric,old_price numeric,discount numeric,currency varchar,merchant_url text,affiliate_url text,external_id varchar,stock_status text) ON CONFLICT (provider_id,merchant_id,external_offer_key) DO UPDATE SET product_id=EXCLUDED.product_id,variant_id=EXCLUDED.variant_id,current_price=EXCLUDED.current_price,original_price=EXCLUDED.original_price,saving=EXCLUDED.saving,savings_percent=EXCLUDED.savings_percent,discount_percent=EXCLUDED.discount_percent,currency=EXCLUDED.currency,original_url=EXCLUDED.original_url,affiliate_url=EXCLUDED.affiliate_url,in_stock=true,is_for_sale=true,stock_status=EXCLUDED.stock_status,status=$4,active=false,last_seen_at=$6,updated_at=$6", [JSON.stringify(offerRows), this.providerId, merchantId, "paused", "merchant_provided", now]);
      const offerIdsResult = await this.query(client, "SELECT external_offer_key,id FROM offers WHERE provider_id=$1 AND merchant_id=$2 AND external_offer_key=ANY($3::varchar[])", [this.providerId, merchantId, changed.map((item) => item.offerKey)]);
      const offerIds = new Map(offerIdsResult.rows.map((row) => [row.external_offer_key, row.id]));
      const evidence = changed.map((item) => ({ offer_id: offerIds.get(item.offerKey), feed_id: this.feedDbIds.get(item.dafiti.dataFeedId), old_price: item.dafiti.oldPrice, current_price: item.dafiti.currentPrice, discount: item.dafiti.discountPercent }));
      await this.query(client, "INSERT INTO offer_promotion_evidence (offer_id,feed_id,promotion_status,promotion_evidence_type,old_price,current_price,discount_percent,evidence_source,evidence_observed_at) SELECT x.offer_id,x.feed_id,$2,$3,x.old_price,x.current_price,x.discount,$4,$5 FROM jsonb_to_recordset($1::jsonb) x(offer_id varchar,feed_id varchar,old_price numeric,current_price numeric,discount numeric) ON CONFLICT (offer_id,evidence_source) DO UPDATE SET feed_id=EXCLUDED.feed_id,promotion_status=EXCLUDED.promotion_status,promotion_evidence_type=EXCLUDED.promotion_evidence_type,old_price=EXCLUDED.old_price,current_price=EXCLUDED.current_price,discount_percent=EXCLUDED.discount_percent,evidence_observed_at=EXCLUDED.evidence_observed_at,updated_at=$5", [JSON.stringify(evidence), "PROMOTION_CONFIRMED", "OLD_PRICE_GT_CURRENT_PRICE", "AWIN_DAFITI_FEED", now]);
      const images = Array.from(new Map(changed.flatMap((item) => item.images.filter(validUrl).map((url, index) => [`${this.productIds.get(item.productKey)}:${url}`, { product_id: this.productIds.get(item.productKey), variant_id: variantIds.get(item.variantKey), url, alt: item.product.name, sort_order: index, is_primary: index === 0 }]))).values());
      if (images.length) await this.query(client, "INSERT INTO product_images (product_id,variant_id,provider_id,url,alt,sort_order,is_primary,external_identity,image_type,provenance_method) SELECT x.product_id,x.variant_id,$2,x.url,x.alt,x.sort_order,x.is_primary,x.url,$3,$4 FROM jsonb_to_recordset($1::jsonb) x(product_id varchar,variant_id varchar,url text,alt text,sort_order integer,is_primary boolean) ON CONFLICT (product_id,url) WHERE provider_id IS NOT NULL DO UPDATE SET alt=EXCLUDED.alt", [JSON.stringify(images), this.providerId, "merchant", "merchant_provided"]);
      const rawRows = changed.map((item) => ({ provider_id: this.providerId, merchant_id: merchantId, feed_id: this.feedDbIds.get(item.dafiti.dataFeedId), external_product_id: item.product.identifiers.awProductId, merchant_product_id: item.product.identifiers.merchantProductId, identity_hash: item.raw.identityHash, content_hash: item.raw.contentHash, raw_payload: sanitizeRawPayload(item.raw.payload) }));
      await this.query(client, "INSERT INTO commerce_raw_feed_items (provider_id,merchant_id,feed_id,external_product_id,merchant_product_id,identity_hash,content_hash,raw_payload,first_seen_at,last_seen_at,updated_at) SELECT x.provider_id,x.merchant_id,x.feed_id,x.external_product_id,x.merchant_product_id,x.identity_hash,x.content_hash,x.raw_payload,$2,$2,$2 FROM jsonb_to_recordset($1::jsonb) x(provider_id varchar,merchant_id varchar,feed_id varchar,external_product_id text,merchant_product_id text,identity_hash varchar,content_hash varchar,raw_payload jsonb) ON CONFLICT (provider_id,merchant_id,feed_id,identity_hash) DO UPDATE SET content_hash=EXCLUDED.content_hash,raw_payload=EXCLUDED.raw_payload,last_seen_at=$2,updated_at=$2", [JSON.stringify(rawRows), now]);
      await client.query("COMMIT");
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { (client as PoolClient).release(); }
  }

  async finalize(now: Date) {
    const client = await this.pool.connect();
    try { for (const feedId of Array.from(this.feedDbIds.values())) await this.query(client, "UPDATE commerce_feeds SET last_seen_at=$2,last_import_completed_at=$2,updated_at=$2 WHERE id=$1", [feedId, now]); }
    finally { (client as PoolClient).release(); }
  }
}

export function emptyDafitiImportReport(): DafitiImportReport { return { seen: 0, eligible: 0, ignored: 0, invalid: 0, created: 0, updated: 0, unchanged: 0, batches: 0, roundTrips: 0, ignoredReasons: {} }; }
