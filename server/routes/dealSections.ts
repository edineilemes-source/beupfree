import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { collectionMemberships, processedItems, collectionBatches, collectionSources } from "@shared/schema";
import { eq, desc, asc, and, isNull, isNotNull, sql } from "drizzle-orm";

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

async function getSection(
  sourceName: string,
  limit = 20
): Promise<DealSectionResponse> {
  try {
    const sources = await storage.getCollectionSources();
    const source = sources.find((s) => s.name?.includes(sourceName));

    if (!source) {
      return { lastUpdatedAt: null, items: [] };
    }

    const [lastUpdatedAt, items] = await Promise.all([
      getLastUpdatedAt(source.id),
      getMembershipItems(source.id, limit),
    ]);

    return { lastUpdatedAt, items };
  } catch (err: any) {
    console.error(`[DealSections] Error for ${sourceName}:`, err.message);
    return { lastUpdatedAt: null, items: [] };
  }
}

// ============ Public endpoints ============

router.get("/api/sections/oferta-do-dia", async (req, res) => {
  const data = await getSection("Oferta do Dia", 20);
  res.json(data);
});

router.get("/api/sections/oferta-relampago", async (req, res) => {
  const data = await getSection("Oferta Relâmpago", 20);
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
      const items = await getMembershipItems(source.id, 30, false, false);
      for (const item of items) {
        if (item.soldOut && !seenTitles.has(item.title)) {
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
