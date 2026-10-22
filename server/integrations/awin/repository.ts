import type { Pool, PoolClient, QueryResult } from "pg";
import type { NormalizedAwinItem } from "./types";

export type ImportDisposition = "created" | "updated" | "unchanged" | "invalid" | "ignored";
export type AwinImportPhase = "initializing" | "staging" | "merging" | "finalizing";
export type AwinSqlStep = { name: string; durationMs: number; rowCount: number | null; roundTrips: number };
export type AwinImportProgress = { phase: AwinImportPhase; processed: number; batches: number; roundTrips: number; sqlStep?: AwinSqlStep };
export type AwinImportReport = Record<ImportDisposition, number> & { seen: number; staged: number; changed: number; missingCandidates: number; batches: number; roundTrips: number; maxBatchItems: number; merges_skipped: number; fast_path: boolean; raw_last_seen_refreshed: number; raw_last_seen_refresh_ms: number; sql_steps: AwinSqlStep[] };
export type AwinImportOptions = { feedId: string; now?: Date; chunkSize?: number; expectedMerchant?: string; expectedCount?: number; statementTimeoutMs?: number; lockTimeoutMs?: number; rawItemLastSeenRefreshMs?: number; onProgress?: (value: AwinImportProgress) => void };
type Queryable = { query(text: string, values?: unknown[]): Promise<QueryResult<any>> };
type TransactionPool = Pick<Pool, "connect">;
const MAX_CHUNK_SIZE = 5_000;
const MAX_POSTGRES_TIMEOUT_MS = 2_147_483_647;
const DEFAULT_RAW_LAST_SEEN_REFRESH_MS = 24 * 60 * 60 * 1_000;

const postgresTimeout = (value: number | undefined, fallback: number, option: string): string => {
  const timeout = value ?? fallback;
  if (!Number.isInteger(timeout) || timeout < 0 || timeout > MAX_POSTGRES_TIMEOUT_MS) {
    throw new Error(`${option}: use 0..${MAX_POSTGRES_TIMEOUT_MS}`);
  }
  return `${timeout}ms`;
};

const safeDate = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value); return Number.isNaN(date.valueOf()) ? null : date.toISOString();
};
export function sanitizeRawPayload(payload: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !/(?:api.?key|access.?token|password|secret|feed.?url)/i.test(key)));
}
async function* iterable(input: Iterable<NormalizedAwinItem> | AsyncIterable<NormalizedAwinItem>) {
  if (Symbol.asyncIterator in Object(input)) { for await (const item of input as AsyncIterable<NormalizedAwinItem>) yield item; }
  else yield* input as Iterable<NormalizedAwinItem>;
}

/**
 * Shared Awin persistence engine. Rows are streamed into a transaction-local staging
 * table in bounded jsonb batches, then reconciled with fixed, set-based SQL merges.
 * jsonb_to_recordset avoids an extra COPY dependency while retaining O(batches) I/O.
 */
export class PostgresAwinRepository {
  constructor(private readonly pool: TransactionPool) {}
  async import(input: Iterable<NormalizedAwinItem> | AsyncIterable<NormalizedAwinItem>, options: AwinImportOptions): Promise<AwinImportReport> {
    const chunkSize = options.chunkSize ?? 1_000;
    if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > MAX_CHUNK_SIZE) throw new Error(`AWIN_CHUNK_SIZE_INVALID: use 1..${MAX_CHUNK_SIZE}`);
    const statementTimeout = postgresTimeout(options.statementTimeoutMs, 300_000, "AWIN_STATEMENT_TIMEOUT_INVALID");
    const lockTimeout = postgresTimeout(options.lockTimeoutMs, 10_000, "AWIN_LOCK_TIMEOUT_INVALID");
    const rawLastSeenRefreshMs = options.rawItemLastSeenRefreshMs ?? DEFAULT_RAW_LAST_SEEN_REFRESH_MS;
    if (!Number.isInteger(rawLastSeenRefreshMs) || rawLastSeenRefreshMs < 0 || rawLastSeenRefreshMs > MAX_POSTGRES_TIMEOUT_MS) throw new Error(`AWIN_RAW_LAST_SEEN_REFRESH_INVALID: use 0..${MAX_POSTGRES_TIMEOUT_MS}`);
    const client = await this.pool.connect(); const now = options.now ?? new Date();
    let roundTrips = 0, batches = 0, seen = 0, maxBatchItems = 0;
    let phase: AwinImportPhase = "initializing";
    const sqlSteps = new Map<string, AwinSqlStep>();
    const progress = (nextPhase = phase, sqlStep?: AwinSqlStep) => { phase = nextPhase; options.onProgress?.({ phase, processed: seen, batches, roundTrips, sqlStep }); };
    const logicalName = (sql: string) => {
      const match = sql.match(/^(?:INSERT INTO|UPDATE|CREATE TEMP TABLE|CREATE INDEX ON|SELECT).*?\b(commerce_[a-z_]+|products|external_product_identities|product_variants|offers|product_images|awin_import_stage)\b/i);
      return match ? `sql_${match[1].toLowerCase()}` : "sql_transaction";
    };
    const query = async (nameOrSql: string, sqlOrValues: string | unknown[] = [], explicitValues: unknown[] = []) => {
      const explicitlyNamed = typeof sqlOrValues === "string";
      const name = explicitlyNamed ? nameOrSql : logicalName(nameOrSql), sql = explicitlyNamed ? sqlOrValues : nameOrSql, values = explicitlyNamed ? explicitValues : sqlOrValues;
      const started = performance.now(); roundTrips++;
      const result = await client.query(sql, values), prior = sqlSteps.get(name);
      const currentRowCount = result.rowCount ?? null;
      const measurement = { name, durationMs: Number(((prior?.durationMs ?? 0) + performance.now() - started).toFixed(3)), rowCount: prior?.rowCount === null || currentRowCount === null ? null : (prior?.rowCount ?? 0) + currentRowCount, roundTrips: (prior?.roundTrips ?? 0) + 1 };
      sqlSteps.set(name, measurement); progress(phase, measurement); return result;
    };
    try {
      await query("transaction_begin", "BEGIN");
      await query("configure_statement_timeout", "SELECT set_config('statement_timeout', $1, true)", [statementTimeout]);
      await query("configure_lock_timeout", "SELECT set_config('lock_timeout', $1, true)", [lockTimeout]);
      progress("initializing");
      await query("create_staging", `CREATE TEMP TABLE awin_import_stage (
        ordinal bigint NOT NULL, external_feed_id text NOT NULL, merchant_external_id text NOT NULL, merchant_name text NOT NULL,
        product_key varchar(64) NOT NULL, variant_key varchar(64) NOT NULL, offer_key varchar(64) NOT NULL,
        product_name text NOT NULL, short_description text, description text, main_image_url text, parent_product_id text,
        merchant_url text, affiliate_url text NOT NULL, aw_product_id text, merchant_product_id text,
        ean text, gtin text, upc text, mpn text, size text, colour text, attributes jsonb NOT NULL,
        current_price numeric(10,2) NOT NULL, original_price numeric(10,2), rrp_price numeric(10,2), saving numeric(10,2), savings_percent numeric(7,3), currency varchar(10),
        in_stock boolean, is_for_sale boolean, stock_status text, valid_from timestamp, valid_to timestamp,
        images jsonb NOT NULL, identity_hash varchar(64) NOT NULL, content_hash varchar(64) NOT NULL, raw_payload jsonb NOT NULL, disposition text NOT NULL DEFAULT 'created',
        raw_item_id varchar(36), existing_last_seen_at timestamp
      ) ON COMMIT DROP`);
      let chunk: Record<string, unknown>[] = [];
      const flush = async () => {
        if (!chunk.length) return;
        await query("load_staging_batches", `INSERT INTO awin_import_stage (ordinal,external_feed_id,merchant_external_id,merchant_name,product_key,variant_key,offer_key,product_name,short_description,description,main_image_url,parent_product_id,merchant_url,affiliate_url,aw_product_id,merchant_product_id,ean,gtin,upc,mpn,size,colour,attributes,current_price,original_price,rrp_price,saving,savings_percent,currency,in_stock,is_for_sale,stock_status,valid_from,valid_to,images,identity_hash,content_hash,raw_payload)
          SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(ordinal bigint,external_feed_id text,merchant_external_id text,merchant_name text,product_key varchar,variant_key varchar,offer_key varchar,product_name text,short_description text,description text,main_image_url text,parent_product_id text,merchant_url text,affiliate_url text,aw_product_id text,merchant_product_id text,ean text,gtin text,upc text,mpn text,size text,colour text,attributes jsonb,current_price numeric,original_price numeric,rrp_price numeric,saving numeric,savings_percent numeric,currency varchar,in_stock boolean,is_for_sale boolean,stock_status text,valid_from timestamp,valid_to timestamp,images jsonb,identity_hash varchar,content_hash varchar,raw_payload jsonb)`, [JSON.stringify(chunk)]);
        batches++; maxBatchItems = Math.max(maxBatchItems, chunk.length); chunk = []; progress("staging");
      };
      for await (const item of iterable(input)) {
        seen++; const ids = item.product.identifiers; const availability = item.offer.availability;
        chunk.push({ ordinal: seen, external_feed_id: item.provenance.feedId || options.feedId, merchant_external_id: item.provenance.merchantId, merchant_name: item.provenance.merchantName ?? item.provenance.merchantId,
          product_key: item.productKey, variant_key: item.variantKey, offer_key: item.offerKey, product_name: item.product.name, short_description: item.product.shortDescription, description: item.product.description,
          main_image_url: item.images[0] ?? null, parent_product_id: ids.parentProductId, merchant_url: item.offer.merchantUrl, affiliate_url: item.offer.affiliateUrl,
          aw_product_id: ids.awProductId, merchant_product_id: ids.merchantProductId, ean: item.variant.validGtin ? item.variant.ean : null, gtin: item.variant.validGtin, upc: ids.upc, mpn: ids.mpn,
          size: item.variant.size, colour: item.variant.colour, attributes: { sizeStockStatus: item.variant.sizeStockStatus }, current_price: item.offer.currentPrice,
          original_price: item.offer.prices.old, rrp_price: item.offer.prices.rrp, saving: item.offer.prices.saving, savings_percent: item.offer.prices.savingsPercent, currency: item.offer.currency,
          in_stock: availability.inStock, is_for_sale: availability.isForSale, stock_status: availability.stockStatus, valid_from: safeDate(availability.validFrom), valid_to: safeDate(availability.validTo),
          images: item.images, identity_hash: item.raw.identityHash, content_hash: item.raw.contentHash, raw_payload: sanitizeRawPayload(item.raw.payload) });
        if (chunk.length >= chunkSize) await flush();
      }
      await flush();
      if (options.expectedCount !== undefined && seen !== options.expectedCount) throw new Error(`AWIN_SOURCE_COUNT_MISMATCH: expected=${options.expectedCount} observed=${seen}`);
      const source = (await query("validate_staged_source", "SELECT count(DISTINCT merchant_external_id)::int merchants,min(merchant_external_id) merchant,min(external_feed_id) feed,max(external_feed_id) max_feed FROM awin_import_stage")).rows[0];
      if (seen && options.expectedMerchant && (source.merchants !== 1 || source.merchant !== options.expectedMerchant)) throw new Error("AWIN_SOURCE_MERCHANT_MISMATCH");
      if (seen && (source.feed !== source.max_feed || source.feed !== options.feedId)) throw new Error("AWIN_SOURCE_FEED_MISMATCH");
      progress("merging");
      await query("index_and_analyze_staging", "CREATE INDEX ON awin_import_stage (merchant_external_id,product_key); CREATE INDEX ON awin_import_stage (merchant_external_id,variant_key); CREATE INDEX ON awin_import_stage (merchant_external_id,offer_key); CREATE INDEX ON awin_import_stage (external_feed_id,merchant_external_id,identity_hash); ANALYZE awin_import_stage");
      const provider = (await query("INSERT INTO commerce_providers (code,name,provider_type) VALUES ('awin','Awin','affiliate_network') ON CONFLICT (code) DO UPDATE SET updated_at=commerce_providers.updated_at RETURNING id")).rows[0];
      await query(`INSERT INTO commerce_merchants (provider_id,external_merchant_id,name,active,updated_at) SELECT $1,merchant_external_id,max(merchant_name),true,$2 FROM awin_import_stage GROUP BY merchant_external_id ON CONFLICT (provider_id,external_merchant_id) DO UPDATE SET name=EXCLUDED.name,updated_at=EXCLUDED.updated_at WHERE commerce_merchants.name IS DISTINCT FROM EXCLUDED.name`, [provider.id, now]);
      await query(`INSERT INTO commerce_feeds (provider_id,merchant_id,external_feed_id,active,last_import_started_at,updated_at) SELECT $1,m.id,s.external_feed_id,true,$2,$2 FROM (SELECT DISTINCT merchant_external_id,external_feed_id FROM awin_import_stage) s JOIN commerce_merchants m ON m.provider_id=$1 AND m.external_merchant_id=s.merchant_external_id ON CONFLICT (provider_id,external_feed_id) DO UPDATE SET merchant_id=EXCLUDED.merchant_id,last_import_started_at=EXCLUDED.last_import_started_at,updated_at=EXCLUDED.updated_at`, [provider.id, now]);
      const rawCounts = (await query("classify_and_count_staging", `WITH classified AS (
        UPDATE awin_import_stage s SET disposition=CASE WHEN r.content_hash=s.content_hash THEN 'unchanged' ELSE 'updated' END,raw_item_id=r.id,existing_last_seen_at=r.last_seen_at
        FROM commerce_raw_feed_items r
        JOIN commerce_feeds f ON f.id=r.feed_id AND f.provider_id=r.provider_id
        JOIN commerce_merchants m ON m.id=r.merchant_id AND m.provider_id=r.provider_id
        WHERE r.provider_id=$1 AND r.identity_hash=s.identity_hash
          AND f.external_feed_id=s.external_feed_id AND m.external_merchant_id=s.merchant_external_id
        RETURNING s.disposition
      ) SELECT ($2::bigint-count(*))::bigint created,
        count(*) FILTER (WHERE disposition='updated')::bigint updated,
        count(*) FILTER (WHERE disposition='unchanged')::bigint unchanged,
        (($2::bigint-count(*)) + count(*) FILTER (WHERE disposition='updated'))::bigint changed
        FROM classified`, [provider.id, seen])).rows[0];
      const counts = {
        created: Number(rawCounts.created ?? 0),
        updated: Number(rawCounts.updated ?? 0),
        unchanged: Number(rawCounts.unchanged ?? 0),
      };
      const changed = Number(rawCounts.changed ?? 0);
      const counters = [...Object.values(counts), changed];
      if (counters.some(value => !Number.isSafeInteger(value) || value < 0)
        || counts.created + counts.updated + counts.unchanged !== seen
        || changed !== counts.created + counts.updated
        || changed > seen
        || changed + counts.unchanged > seen) {
        throw new Error("AWIN_STAGING_COUNTS_INVALID");
      }
      if (changed > 0) {
      await query("merge_products", `INSERT INTO products (main_name,slug,short_description,detailed_description,main_image_url,catalog_status) SELECT DISTINCT ON (s.merchant_external_id,s.product_key) s.product_name,'awin-'||s.merchant_external_id||'-'||s.product_key,s.short_description,s.description,s.main_image_url,'draft' FROM awin_import_stage s JOIN commerce_merchants m ON m.provider_id=$1 AND m.external_merchant_id=s.merchant_external_id LEFT JOIN external_product_identities e ON e.provider_id=$1 AND e.merchant_id=m.id AND e.external_product_key=s.product_key WHERE s.disposition<>'unchanged' AND e.id IS NULL ORDER BY s.merchant_external_id,s.product_key,s.ordinal`, [provider.id]);
      await query("merge_external_product_identities", `UPDATE external_product_identities e SET feed_id=f.id,parent_product_id=s.parent_product_id,merchant_product_page_url=s.merchant_url,last_seen_at=$2,updated_at=$2 FROM (SELECT DISTINCT ON (merchant_external_id,product_key) * FROM awin_import_stage WHERE disposition<>'unchanged' ORDER BY merchant_external_id,product_key,ordinal DESC) s JOIN commerce_merchants m ON m.provider_id=$1 AND m.external_merchant_id=s.merchant_external_id JOIN commerce_feeds f ON f.provider_id=$1 AND f.external_feed_id=s.external_feed_id WHERE e.provider_id=$1 AND e.merchant_id=m.id AND e.external_product_key=s.product_key`, [provider.id, now]);
      await query("merge_external_product_identities", `INSERT INTO external_product_identities (product_id,provider_id,merchant_id,feed_id,external_product_key,parent_product_id,merchant_product_page_url,identity_method,publication_state,provenance_method,active,last_seen_at) SELECT p.id,$1,m.id,f.id,s.product_key,s.parent_product_id,s.merchant_url,CASE WHEN s.parent_product_id IS NOT NULL THEN 'parent_product_id' WHEN s.merchant_url IS NOT NULL THEN 'merchant_page_url' ELSE 'normalized_fallback' END,'staging','normalized',false,$2 FROM (SELECT DISTINCT ON (merchant_external_id,product_key) * FROM awin_import_stage WHERE disposition<>'unchanged' ORDER BY merchant_external_id,product_key,ordinal) s JOIN commerce_merchants m ON m.provider_id=$1 AND m.external_merchant_id=s.merchant_external_id JOIN commerce_feeds f ON f.provider_id=$1 AND f.external_feed_id=s.external_feed_id JOIN products p ON p.slug='awin-'||s.merchant_external_id||'-'||s.product_key ON CONFLICT (provider_id,merchant_id,external_product_key) DO UPDATE SET feed_id=EXCLUDED.feed_id,parent_product_id=EXCLUDED.parent_product_id,merchant_product_page_url=EXCLUDED.merchant_product_page_url,last_seen_at=$2,updated_at=$2`, [provider.id, now]);
      await query("merge_products", `UPDATE products p SET main_name=s.product_name,short_description=s.short_description,detailed_description=s.description,main_image_url=COALESCE(s.main_image_url,p.main_image_url),updated_at=$2 FROM (SELECT DISTINCT ON (merchant_external_id,product_key) * FROM awin_import_stage WHERE disposition='updated' ORDER BY merchant_external_id,product_key,ordinal DESC) s JOIN commerce_merchants m ON m.provider_id=$1 AND m.external_merchant_id=s.merchant_external_id JOIN external_product_identities e ON e.provider_id=$1 AND e.merchant_id=m.id AND e.external_product_key=s.product_key WHERE p.id=e.product_id AND p.catalog_status='draft'`, [provider.id, now]);
      await query("merge_product_variants", `INSERT INTO product_variants (product_id,provider_id,merchant_id,external_variant_key,merchant_product_id,aw_product_id,ean,gtin,upc,mpn,size,colour,attributes,provenance_method,active,last_seen_at) SELECT e.product_id,$1,m.id,s.variant_key,s.merchant_product_id,s.aw_product_id,s.ean,s.gtin,s.upc,s.mpn,s.size,s.colour,s.attributes,'merchant_provided',false,$2 FROM (SELECT DISTINCT ON (merchant_external_id,variant_key) * FROM awin_import_stage WHERE disposition<>'unchanged' ORDER BY merchant_external_id,variant_key,ordinal DESC) s JOIN commerce_merchants m ON m.provider_id=$1 AND m.external_merchant_id=s.merchant_external_id JOIN external_product_identities e ON e.provider_id=$1 AND e.merchant_id=m.id AND e.external_product_key=s.product_key ON CONFLICT (provider_id,merchant_id,external_variant_key) DO UPDATE SET product_id=EXCLUDED.product_id,merchant_product_id=EXCLUDED.merchant_product_id,aw_product_id=EXCLUDED.aw_product_id,ean=EXCLUDED.ean,gtin=EXCLUDED.gtin,upc=EXCLUDED.upc,mpn=EXCLUDED.mpn,size=EXCLUDED.size,colour=EXCLUDED.colour,attributes=EXCLUDED.attributes,last_seen_at=$2,updated_at=$2`, [provider.id, now]);
      await query("merge_offers", `INSERT INTO offers (product_id,variant_id,provider_id,merchant_id,external_offer_key,current_price,original_price,rrp_price,saving,savings_percent,currency,original_url,affiliate_url,external_id,in_stock,is_for_sale,stock_status,valid_from,valid_to,status,active,last_seen_at,captured_at,updated_at) SELECT e.product_id,v.id,$1,m.id,s.offer_key,s.current_price,s.original_price,s.rrp_price,s.saving,s.savings_percent,s.currency,s.merchant_url,s.affiliate_url,COALESCE(s.aw_product_id,s.merchant_product_id),s.in_stock,s.is_for_sale,s.stock_status,s.valid_from,s.valid_to,'paused',false,$2,$2,$2 FROM (SELECT DISTINCT ON (merchant_external_id,offer_key) * FROM awin_import_stage WHERE disposition<>'unchanged' ORDER BY merchant_external_id,offer_key,ordinal DESC) s JOIN commerce_merchants m ON m.provider_id=$1 AND m.external_merchant_id=s.merchant_external_id JOIN external_product_identities e ON e.provider_id=$1 AND e.merchant_id=m.id AND e.external_product_key=s.product_key JOIN product_variants v ON v.provider_id=$1 AND v.merchant_id=m.id AND v.external_variant_key=s.variant_key ON CONFLICT (provider_id,merchant_id,external_offer_key) DO UPDATE SET product_id=EXCLUDED.product_id,variant_id=EXCLUDED.variant_id,current_price=EXCLUDED.current_price,original_price=EXCLUDED.original_price,rrp_price=EXCLUDED.rrp_price,saving=EXCLUDED.saving,savings_percent=EXCLUDED.savings_percent,currency=EXCLUDED.currency,original_url=EXCLUDED.original_url,affiliate_url=EXCLUDED.affiliate_url,external_id=EXCLUDED.external_id,in_stock=EXCLUDED.in_stock,is_for_sale=EXCLUDED.is_for_sale,stock_status=EXCLUDED.stock_status,valid_from=EXCLUDED.valid_from,valid_to=EXCLUDED.valid_to,last_seen_at=$2,updated_at=$2`, [provider.id, now]);
      await query("merge_product_images", `INSERT INTO product_images (product_id,variant_id,provider_id,url,alt,sort_order,is_primary,external_identity,image_type,provenance_method) SELECT DISTINCT ON (e.product_id,image.url) e.product_id,v.id,$1,image.url,s.product_name,(image.ordinality-1)::int,image.ordinality=1,image.url,'merchant','merchant_provided' FROM awin_import_stage s CROSS JOIN LATERAL jsonb_array_elements_text(s.images) WITH ORDINALITY image(url,ordinality) JOIN commerce_merchants m ON m.provider_id=$1 AND m.external_merchant_id=s.merchant_external_id JOIN external_product_identities e ON e.provider_id=$1 AND e.merchant_id=m.id AND e.external_product_key=s.product_key JOIN product_variants v ON v.provider_id=$1 AND v.merchant_id=m.id AND v.external_variant_key=s.variant_key WHERE s.disposition<>'unchanged' ORDER BY e.product_id,image.url,s.ordinal DESC ON CONFLICT (product_id,url) WHERE provider_id IS NOT NULL DO UPDATE SET variant_id=COALESCE(product_images.variant_id,EXCLUDED.variant_id),alt=EXCLUDED.alt`, [provider.id]);
      await query(`INSERT INTO commerce_raw_feed_items (provider_id,merchant_id,feed_id,external_product_id,merchant_product_id,identity_hash,content_hash,raw_payload,first_seen_at,last_seen_at,updated_at) SELECT $1,m.id,f.id,s.aw_product_id,s.merchant_product_id,s.identity_hash,s.content_hash,s.raw_payload,$2,$2,$2 FROM (SELECT DISTINCT ON (merchant_external_id,external_feed_id,identity_hash) * FROM awin_import_stage WHERE disposition<>'unchanged' ORDER BY merchant_external_id,external_feed_id,identity_hash,ordinal DESC) s JOIN commerce_merchants m ON m.provider_id=$1 AND m.external_merchant_id=s.merchant_external_id JOIN commerce_feeds f ON f.provider_id=$1 AND f.external_feed_id=s.external_feed_id ON CONFLICT (provider_id,merchant_id,feed_id,identity_hash) DO UPDATE SET external_product_id=EXCLUDED.external_product_id,merchant_product_id=EXCLUDED.merchant_product_id,content_hash=EXCLUDED.content_hash,raw_payload=EXCLUDED.raw_payload,last_seen_at=$2,updated_at=$2`, [provider.id, now]);
      }
      const rawRefreshCutoff = new Date(now.getTime() - rawLastSeenRefreshMs);
      const rawRefresh = await query("refresh_unchanged_raw_presence", `UPDATE commerce_raw_feed_items r SET last_seen_at=$1,updated_at=$1
        FROM awin_import_stage s WHERE s.disposition='unchanged' AND r.id=s.raw_item_id
          AND ($3::boolean OR s.existing_last_seen_at IS NULL OR s.existing_last_seen_at <= $2::timestamp without time zone)`, [now, rawRefreshCutoff, rawLastSeenRefreshMs === 0]);
      const missing = (await query(`SELECT count(*)::int count FROM commerce_raw_feed_items r JOIN commerce_feeds f ON f.id=r.feed_id JOIN commerce_merchants m ON m.id=r.merchant_id LEFT JOIN awin_import_stage s ON s.external_feed_id=f.external_feed_id AND s.merchant_external_id=m.external_merchant_id AND s.identity_hash=r.identity_hash WHERE f.provider_id=$1 AND f.external_feed_id=$2 AND s.identity_hash IS NULL`, [provider.id, options.feedId])).rows[0];
      await query("UPDATE commerce_feeds SET last_seen_at=$2,last_import_completed_at=$2,updated_at=$2 WHERE provider_id=$1 AND external_feed_id=$3", [provider.id, now, options.feedId]);
      progress("finalizing"); await query("transaction_commit", "COMMIT");
      return { seen, staged: seen, changed, created: counts.created, updated: counts.updated, unchanged: counts.unchanged, invalid: 0, ignored: 0, missingCandidates: missing.count, batches, roundTrips, maxBatchItems, merges_skipped: changed === 0 ? 5 : 0, fast_path: changed === 0, raw_last_seen_refreshed: rawRefresh.rowCount ?? 0, raw_last_seen_refresh_ms: rawLastSeenRefreshMs, sql_steps: [...sqlSteps.values()] };
    } catch (error) { try { await query("transaction_rollback", "ROLLBACK"); } catch {} throw error; }
    finally { (client as PoolClient).release(); }
  }
}
