import { Router } from "express";
import { storage } from "../storage";
import { eq, desc, sql, and } from "drizzle-orm";
import { db } from "../db";
import { offers, products, productImages } from "@shared/schema";

const router = Router();

interface DealItem {
  id: string;
  title: string;
  imageUrl: string | null;
  itemUrl: string;
  currentPrice: number;
  oldPrice: number | null;
  discountPercent: number | null;
  lastSeenAt: string;
}

interface DealSectionResponse {
  lastUpdatedAt: string | null;
  items: DealItem[];
}

const getSection = async (sourceName: string) => {
  try {
    // Get the collection source
    const sources = await storage.getCollectionSources();
    const source = sources.find((s) => s.name?.includes(sourceName));

    if (!source) {
      return { lastUpdatedAt: null, items: [] };
    }

    // Get latest batch for this source
    const batches = await storage.getCollectionBatches(source.id, 1);
    const latestBatch = batches?.[0];

    // Get published offers - all active published offers
    const allOffers = await db
      .select({
        id: offers.id,
        currentPrice: offers.currentPrice,
        oldPrice: offers.oldPrice,
        discountPercent: offers.discountPercent,
        itemUrl: offers.itemUrl,
        productId: offers.productId,
        createdAt: offers.createdAt,
      })
      .from(offers)
      .where(
        and(
          eq(offers.isPublished, true),
          eq(offers.offerStatus, "active")
        )
      )
      .orderBy(desc(sql`CAST(${offers.discountPercent} AS INTEGER)`))
      .limit(12);

    const items: DealItem[] = [];

    for (const offer of allOffers) {
      if (!offer.productId) continue;

      const product = await db.query.products.findFirst({
        where: eq(products.id, offer.productId),
      });

      if (!product) continue;

      const prodImages = await db.query.productImages.findFirst({
        where: eq(productImages.productId, offer.productId),
      });

      items.push({
        id: offer.id,
        title: product.name || "Produto",
        imageUrl: prodImages?.imageUrl || null,
        itemUrl: offer.itemUrl || "",
        currentPrice: parseFloat(offer.currentPrice) || 0,
        oldPrice: offer.oldPrice ? parseFloat(offer.oldPrice) : null,
        discountPercent: offer.discountPercent ? parseInt(offer.discountPercent) : null,
        lastSeenAt: offer.createdAt?.toISOString() || new Date().toISOString(),
      });
    }

    return {
      lastUpdatedAt: latestBatch?.finishedAt?.toISOString() || null,
      items,
    };
  } catch (err: any) {
    console.error(`[DealSections] Error for ${sourceName}:`, err.message);
    return { lastUpdatedAt: null, items: [] };
  }
};

router.get("/api/sections/oferta-do-dia", async (req, res) => {
  const data = await getSection("Oferta do Dia");
  res.json(data as DealSectionResponse);
});

router.get("/api/sections/oferta-relampago", async (req, res) => {
  const data = await getSection("Oferta Relâmpago");
  res.json(data as DealSectionResponse);
});

export default router;
