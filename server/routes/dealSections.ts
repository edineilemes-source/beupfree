import { Router } from "express";
import { storage } from "../storage";
import { db, pool } from "../db";
import { collectionMemberships, processedItems, collectionBatches, collectionSources, products, offers } from "@shared/schema";
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
}

/**
 * Resolve the last_updated_at from the most recent successful batch for a source.
 */
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
 * Main query: get items from collection_memberships joined with processed_items,
 * filtered to ONLY items that have been approved in triage_queue.
 *
 * Approval check uses both content_hash AND external_id so price changes
 * don't cause previously-approved items to disappear.
 *
 * onlySoldOut=true  → only is_active=false  (for "Ofertas Anteriores")
 * onlyActive=true   → only is_active=true   (for live sections)
 */
async function getMembershipItems(
  sourceId: string,
  limit = 20,
  onlySoldOut = false,
  onlyActive = false
): Promise<DealItem[]> {
  const activeFilter = onlyActive
    ? "AND cm.is_active = true"
    : onlySoldOut
    ? "AND cm.is_active = false"
    : "";

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
      SELECT DISTINCT ON (pi.external_id, pi.price)
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
        ${activeFilter}
        AND (
          EXISTS (
            SELECT 1 FROM triage_queue tq
            WHERE tq.processed_item_id = pi.id
              AND tq.status = 'approved'
          )
          OR
          (pi.external_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM triage_queue tq2
            JOIN processed_items pi2 ON pi2.id = tq2.processed_item_id
            WHERE pi2.external_id = pi.external_id
              AND tq2.status = 'approved'
          ))
        )
      ORDER BY pi.external_id, pi.price, pi.discount_percent DESC NULLS LAST
    ) AS sub
    ORDER BY sub.discount_percent DESC NULLS LAST
    LIMIT $2
    `,
    [sourceId, limit * 3]
  );

  const items: DealItem[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const dedupeKey = `${row.normalized_title}::${row.price}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const currentPrice = parseFloat(row.price || "0");
    if (currentPrice <= 0) continue;

    items.push({
      id: row.membership_id,
      title: row.normalized_title || row.raw_title || "Produto",
      imageUrl: row.image_url ?? null,
      itemUrl: row.affiliate_url || row.source_url || row.raw_url || "",
      currentPrice,
      oldPrice: row.original_price ? parseFloat(row.original_price) : null,
      discountPercent: row.discount_percent ?? null,
      soldOut: !row.is_active,
      freeShipping: row.free_shipping ?? false,
      lastSeenAt: row.last_seen_at?.toISOString() ?? new Date().toISOString(),
    });
  }

  // Sort by discount DESC NULLS LAST
  items.sort((a, b) => {
    if (a.discountPercent === null && b.discountPercent === null) return 0;
    if (a.discountPercent === null) return 1;
    if (b.discountPercent === null) return -1;
    return b.discountPercent - a.discountPercent;
  });

  return items;
}

/**
 * Fetch approved products tagged with a specific section ('dia' or 'relampago').
 * Only includes products whose ML external_id is STILL active in the given source.
 * This ensures stale approved products don't linger in live sections.
 */
async function getApprovedProductsForSection(section: string, sourceId: string | null): Promise<DealItem[]> {
  if (!sourceId) return [];

  // Only return approved products whose externalId is STILL active in the ML source
  const rows = await db
    .select({
      productId: products.id,
      title: products.mainName,
      imageUrl: products.mainImageUrl,
      currentPrice: offers.currentPrice,
      originalPrice: offers.originalPrice,
      discountPercent: offers.discountPercent,
      affiliateUrl: offers.affiliateUrl,
      originalUrl: offers.originalUrl,
      freeShipping: offers.freeShipping,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .innerJoin(offers, and(
      eq(offers.productId, products.id),
      eq(offers.status, "active")
    ))
    .innerJoin(collectionMemberships, and(
      eq(collectionMemberships.externalItemId, offers.externalId),
      eq(collectionMemberships.collectionSourceId, sourceId),
      eq(collectionMemberships.isActive, true)
    ))
    .where(and(
      eq(products.section, section),
      eq(products.catalogStatus, "published")
    ))
    .orderBy(desc(offers.discountPercent));

  const seen = new Set<string>();
  const items: DealItem[] = [];

  for (const row of rows) {
    const dedupeKey = `${row.title}::${row.currentPrice}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const currentPrice = parseFloat(row.currentPrice || "0");
    if (currentPrice <= 0) continue;

    items.push({
      id: row.productId,
      title: row.title,
      imageUrl: row.imageUrl ?? null,
      itemUrl: row.affiliateUrl || row.originalUrl || "",
      currentPrice,
      oldPrice: row.originalPrice ? parseFloat(row.originalPrice) : null,
      discountPercent: row.discountPercent ?? null,
      soldOut: false,
      freeShipping: row.freeShipping ?? false,
      lastSeenAt: row.updatedAt?.toISOString() ?? new Date().toISOString(),
    });
  }

  return items;
}

async function getSection(
  sourceName: string,
  sectionKey: string,
  limit = 20
): Promise<DealSectionResponse> {
  try {
    const sources = await storage.getCollectionSources();
    const source = sources.find((s) => s.name?.includes(sourceName));

    const [lastUpdatedAt, membershipItems, approvedItems] = await Promise.all([
      source ? getLastUpdatedAt(source.id) : Promise.resolve(null),
      source ? getMembershipItems(source.id, limit, false, true) : Promise.resolve([]),
      getApprovedProductsForSection(sectionKey, source?.id ?? null),
    ]);

    // Merge: approved items first (curated), then live ML items
    const seen = new Set<string>();
    const merged: DealItem[] = [];

    for (const item of [...approvedItems, ...membershipItems]) {
      const key = `${item.title}::${item.currentPrice}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
      if (merged.length >= limit) break;
    }

    // Sort by discount DESC NULLS LAST
    merged.sort((a, b) => {
      if (a.discountPercent === null && b.discountPercent === null) return 0;
      if (a.discountPercent === null) return 1;
      if (b.discountPercent === null) return -1;
      return b.discountPercent - a.discountPercent;
    });

    return { lastUpdatedAt, items: merged };
  } catch (err: any) {
    console.error(`[DealSections] Error for ${sourceName}:`, err.message);
    return { lastUpdatedAt: null, items: [] };
  }
}

// ============ Public endpoints ============

router.get("/api/sections/oferta-do-dia", async (req, res) => {
  const data = await getSection("Oferta do Dia", "dia", 20);
  res.json(data);
});

router.get("/api/sections/oferta-relampago", async (req, res) => {
  const data = await getSection("Oferta Relâmpago", "relampago", 20);
  res.json(data);
});

/**
 * Ofertas Anteriores: items that are now sold_out (is_active=false)
 * from the two main sources, as a historical section.
 */
router.get("/api/sections/ofertas-anteriores", async (req, res) => {
  try {
    const sources = await storage.getCollectionSources();

    const targetSourceNames = ["Oferta do Dia", "Oferta Relâmpago", "Tênis Esportivos", "ML Ofertas"];
    const targetSources = sources.filter((s) =>
      targetSourceNames.some((n) => s.name?.includes(n))
    );

    const allItems: DealItem[] = [];
    const seenTitles = new Set<string>();

    for (const source of targetSources.slice(0, 4)) {
      const items = await getMembershipItems(source.id, 30, true, false);
      for (const item of items) {
        if (!seenTitles.has(item.title)) {
          seenTitles.add(item.title);
          allItems.push(item);
        }
      }
    }

    // Sort sold-out items by discount DESC
    allItems.sort((a, b) => {
      if (a.discountPercent === null && b.discountPercent === null) return 0;
      if (a.discountPercent === null) return 1;
      if (b.discountPercent === null) return -1;
      return b.discountPercent - a.discountPercent;
    });

    const lastUpdatedAt = allItems[0]?.lastSeenAt ?? null;

    res.json({
      lastUpdatedAt,
      items: allItems.slice(0, 24),
    });
  } catch (err: any) {
    console.error("[DealSections] ofertas-anteriores error:", err.message);
    res.json({ lastUpdatedAt: null, items: [] });
  }
});

export default router;
