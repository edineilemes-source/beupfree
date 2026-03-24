import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
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
 * Main query: get items from collection_memberships (joined with processed_items)
 * for a given source. Includes sold_out (is_active=false).
 * Ordered by discount DESC NULLS LAST.
 */
async function getMembershipItems(
  sourceId: string,
  limit = 20,
  onlySoldOut = false,
  onlyActive = false
): Promise<DealItem[]> {
  // Get memberships for this source
  const conditions = [eq(collectionMemberships.collectionSourceId, sourceId)];
  if (onlySoldOut) conditions.push(eq(collectionMemberships.isActive, false));
  if (onlyActive) conditions.push(eq(collectionMemberships.isActive, true));

  const memberships = await db
    .select()
    .from(collectionMemberships)
    .where(and(...conditions))
    .orderBy(desc(collectionMemberships.lastSeenAt))
    .limit(limit * 3); // fetch more to account for missing processed items

  const items: DealItem[] = [];
  const seen = new Set<string>();

  for (const m of memberships) {
    if (items.length >= limit) break;
    if (!m.contentHash && !m.externalItemId) continue;

    // Find processed item by content_hash
    const [pi] = m.contentHash
      ? await db
          .select()
          .from(processedItems)
          .where(eq(processedItems.contentHash, m.contentHash))
          .orderBy(desc(processedItems.processedAt))
          .limit(1)
      : [];

    if (!pi) continue;

    // Dedupe by title+price combo
    const dedupeKey = `${pi.normalizedTitle}::${pi.price}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const currentPrice = parseFloat(pi.price || "0");
    if (currentPrice <= 0) continue;

    items.push({
      id: m.id,
      title: pi.normalizedTitle || m.rawTitle || "Produto",
      imageUrl: pi.imageUrl ?? null,
      itemUrl: pi.affiliateUrl || pi.sourceUrl || m.rawUrl || "",
      currentPrice,
      oldPrice: pi.originalPrice ? parseFloat(pi.originalPrice) : null,
      discountPercent: pi.discountPercent ?? null,
      soldOut: !m.isActive,
      freeShipping: pi.freeShipping ?? false,
      lastSeenAt: m.lastSeenAt?.toISOString() ?? new Date().toISOString(),
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
