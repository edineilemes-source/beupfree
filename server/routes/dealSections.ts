import { Router } from "express";
import { db, pool } from "../db";
import { collectionBatches, collectionSources } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const router = Router();

export interface DealItem {
  id: string;
  title: string;
  imageUrl: string | null;
  itemUrl: string;
  currentPrice: number;
  oldPrice: number | null;
  discountPercent: number | null;
  soldOut: boolean;
  freeShipping: boolean;
  lastSeenAt: string;
}

export interface DealSectionResponse {
  lastUpdatedAt: string | null;
  items: DealItem[];
  total?: number;
  page?: number;
  pageSize?: number;
}

const GERAL_SOURCE_URL = "https://www.mercadolivre.com.br/ofertas?category=MLB3900";

async function getGeralSourceId(): Promise<string | null> {
  const [src] = await db
    .select({ id: collectionSources.id })
    .from(collectionSources)
    .where(sql`${collectionSources.url} LIKE ${`${GERAL_SOURCE_URL}%`}`)
    .limit(1);
  return src?.id ?? null;
}

async function getLastUpdatedAt(sourceId: string): Promise<string | null> {
  const [batch] = await db
    .select({ finishedAt: collectionBatches.finishedAt })
    .from(collectionBatches)
    .where(
      and(
        eq(collectionBatches.sourceId, sourceId),
        eq(collectionBatches.status, "completed")
      )
    )
    .orderBy(desc(collectionBatches.finishedAt))
    .limit(1);
  return batch?.finishedAt?.toISOString() ?? null;
}

/**
 * Query items from collection_memberships JOIN processed_items,
 * filtered by promotion_type. Only approved (in triage) and active items.
 */
async function getItemsByPromotionType(
  sourceId: string,
  promotionType: "lightning" | "deal_of_day" | "general",
  limit: number,
  offset = 0
): Promise<{ items: DealItem[]; total: number }> {
  // Approval continuity: a product is "approved" if ANY processed_items row
  // sharing the same external_id has an approved triage entry. This survives
  // price changes (which create new content_hash + processed_items rows).
  const AUTO_PUBLISH_ALL = process.env.AUTO_PUBLISH_ALL !== "false";
  const approvalFilter = AUTO_PUBLISH_ALL
    ? ""
    : `AND (
        EXISTS (
          SELECT 1 FROM triage_queue tq
          WHERE tq.processed_item_id = pi.id AND tq.status = 'approved'
        )
        OR (pi.external_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM triage_queue tq2
          JOIN processed_items pi2 ON pi2.id = tq2.processed_item_id
          WHERE pi2.external_id = pi.external_id AND tq2.status = 'approved'
        ))
      )`;
  // Dedup key: lowercase normalized first 60 chars of title — collapses ML
  // duplicates (mesmo modelo aparecendo várias vezes em variantes diferentes).
  const dedupKey = `LOWER(SUBSTRING(REGEXP_REPLACE(COALESCE(pi.normalized_title, cm.raw_title, ''), '\\s+', ' ', 'g'), 1, 60))`;

  const { rows: countRows } = await pool.query<{ total: string }>(
    `
    SELECT COUNT(DISTINCT ${dedupKey})::text AS total
    FROM collection_memberships cm
    JOIN processed_items pi ON pi.content_hash = cm.content_hash
    WHERE cm.collection_source_id = $1
      AND cm.is_active = true
      AND pi.promotion_type = $2
      ${approvalFilter}
    `,
    [sourceId, promotionType]
  );
  const total = parseInt(countRows[0]?.total || "0", 10);

  const { rows } = await pool.query<{
    membership_id: string;
    is_active: boolean;
    last_seen_at: Date;
    normalized_title: string | null;
    price: string | null;
    original_price: string | null;
    discount_percent: number | null;
    image_url: string | null;
    affiliate_url: string | null;
    source_url: string | null;
    raw_url: string | null;
    raw_title: string | null;
    free_shipping: boolean | null;
  }>(
    `
    SELECT *
    FROM (
      SELECT DISTINCT ON (${dedupKey})
        cm.id              AS membership_id,
        cm.is_active,
        cm.last_seen_at,
        pi.normalized_title,
        pi.price,
        pi.original_price,
        pi.discount_percent,
        pi.image_url,
        pi.affiliate_url,
        pi.source_url,
        cm.raw_url,
        cm.raw_title,
        pi.free_shipping
      FROM collection_memberships cm
      JOIN processed_items pi ON pi.content_hash = cm.content_hash
      WHERE cm.collection_source_id = $1
        AND cm.is_active = true
        AND pi.promotion_type = $2
        ${approvalFilter}
      ORDER BY ${dedupKey}, pi.discount_percent DESC NULLS LAST, cm.last_seen_at DESC, cm.id
    ) AS sub
    ORDER BY sub.discount_percent DESC NULLS LAST, sub.last_seen_at DESC, sub.membership_id
    LIMIT $3 OFFSET $4
    `,
    [sourceId, promotionType, limit, offset]
  );

  const items: DealItem[] = rows.map((row) => ({
    id: row.membership_id,
    title: row.normalized_title || row.raw_title || "Produto",
    imageUrl: row.image_url ?? null,
    itemUrl: row.affiliate_url || row.source_url || row.raw_url || "",
    currentPrice: parseFloat(row.price || "0"),
    oldPrice: row.original_price ? parseFloat(row.original_price) : null,
    discountPercent: row.discount_percent ?? null,
    soldOut: !row.is_active,
    freeShipping: row.free_shipping ?? false,
    lastSeenAt: row.last_seen_at?.toISOString() ?? new Date().toISOString(),
  })).filter((i) => i.currentPrice > 0);

  return { items, total };
}

async function getSection(
  promotionType: "lightning" | "deal_of_day" | "general",
  limit: number,
  offset = 0
): Promise<DealSectionResponse> {
  try {
    const sourceId = await getGeralSourceId();
    if (!sourceId) {
      return { lastUpdatedAt: null, items: [], total: 0 };
    }

    const [lastUpdatedAt, { items, total }] = await Promise.all([
      getLastUpdatedAt(sourceId),
      getItemsByPromotionType(sourceId, promotionType, limit, offset),
    ]);

    return { lastUpdatedAt, items, total };
  } catch (err: any) {
    console.error(`[DealSections] Error for ${promotionType}:`, err.message);
    return { lastUpdatedAt: null, items: [], total: 0 };
  }
}

// ============ Public endpoints ============

function parsePageQuery(req: any): { page: number; pageSize: number; offset: number } {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "20"), 10) || 20));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

router.get("/api/sections/oferta-relampago", async (req, res) => {
  const { page, pageSize, offset } = parsePageQuery(req);
  const data = await getSection("lightning", pageSize, offset);
  res.json({ ...data, page, pageSize });
});

router.get("/api/sections/oferta-do-dia", async (req, res) => {
  const { page, pageSize, offset } = parsePageQuery(req);
  const data = await getSection("deal_of_day", pageSize, offset);
  res.json({ ...data, page, pageSize });
});

router.get("/api/sections/ofertas-gerais", async (req, res) => {
  const { page, pageSize, offset } = parsePageQuery(req);
  const data = await getSection("general", pageSize, offset);
  res.json({ ...data, page, pageSize });
});

/**
 * Ofertas Anteriores: items now sold out (is_active=false) from the geral source.
 */
router.get("/api/sections/ofertas-anteriores", async (_req, res) => {
  try {
    const sourceId = await getGeralSourceId();
    if (!sourceId) {
      res.json({ lastUpdatedAt: null, items: [] });
      return;
    }

    const { rows } = await pool.query<{
      membership_id: string;
      last_seen_at: Date;
      normalized_title: string | null;
      price: string | null;
      original_price: string | null;
      discount_percent: number | null;
      image_url: string | null;
      affiliate_url: string | null;
      source_url: string | null;
      raw_url: string | null;
      free_shipping: boolean | null;
    }>(
      `
      SELECT DISTINCT ON (COALESCE(pi.external_id, pi.content_hash))
        cm.id AS membership_id,
        cm.last_seen_at,
        pi.normalized_title,
        pi.price,
        pi.original_price,
        pi.discount_percent,
        pi.image_url,
        pi.affiliate_url,
        pi.source_url,
        cm.raw_url,
        pi.free_shipping
      FROM collection_memberships cm
      JOIN processed_items pi ON pi.content_hash = cm.content_hash
      WHERE cm.collection_source_id = $1
        AND cm.is_active = false
        AND (
          EXISTS (
            SELECT 1 FROM triage_queue tq
            WHERE tq.processed_item_id = pi.id AND tq.status = 'approved'
          )
          OR (pi.external_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM triage_queue tq2
            JOIN processed_items pi2 ON pi2.id = tq2.processed_item_id
            WHERE pi2.external_id = pi.external_id AND tq2.status = 'approved'
          ))
        )
      ORDER BY COALESCE(pi.external_id, pi.content_hash), cm.last_seen_at DESC
      LIMIT 24
      `,
      [sourceId]
    );

    const items: DealItem[] = rows
      .map((row) => ({
        id: row.membership_id,
        title: row.normalized_title || "Produto",
        imageUrl: row.image_url ?? null,
        itemUrl: row.affiliate_url || row.source_url || row.raw_url || "",
        currentPrice: parseFloat(row.price || "0"),
        oldPrice: row.original_price ? parseFloat(row.original_price) : null,
        discountPercent: row.discount_percent ?? null,
        soldOut: true,
        freeShipping: row.free_shipping ?? false,
        lastSeenAt: row.last_seen_at?.toISOString() ?? new Date().toISOString(),
      }))
      .filter((i) => i.currentPrice > 0);

    items.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));

    res.json({
      lastUpdatedAt: items[0]?.lastSeenAt ?? null,
      items,
    });
  } catch (err: any) {
    console.error("[DealSections] ofertas-anteriores error:", err.message);
    res.json({ lastUpdatedAt: null, items: [] });
  }
});

export default router;
