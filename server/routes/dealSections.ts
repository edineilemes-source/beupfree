import { Router } from "express";
import { storage } from "../storage";
import { eq, desc, and } from "drizzle-orm";
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
    const sources = await storage.getCollectionSources();
    const source = sources.find((s) => s.name?.includes(sourceName));

    let lastUpdatedAt: string | null = null;

    if (source) {
      const batches = await storage.getCollectionBatches(source.id, 1);
      const latestBatch = batches?.[0];
      lastUpdatedAt = latestBatch?.finishedAt?.toISOString() || null;
    }

    const allOffers = await db
      .select({
        id: offers.id,
        currentPrice: offers.currentPrice,
        originalPrice: offers.originalPrice,
        discountPercent: offers.discountPercent,
        affiliateUrl: offers.affiliateUrl,
        originalUrl: offers.originalUrl,
        productId: offers.productId,
        lastSeenAt: offers.lastSeenAt,
      })
      .from(offers)
      .innerJoin(products, eq(offers.productId, products.id))
      .where(
        and(
          eq(offers.status, "active"),
          eq(products.catalogStatus, "published")
        )
      )
      .orderBy(desc(offers.discountPercent))
      .limit(12);

    const items: DealItem[] = [];

    for (const offer of allOffers) {
      if (!offer.productId) continue;

      const product = await db.query.products.findFirst({
        where: eq(products.id, offer.productId),
      });

      if (!product) continue;

      const prodImage = await db.query.productImages.findFirst({
        where: eq(productImages.productId, offer.productId),
      });

      items.push({
        id: offer.id,
        title: product.mainName || "Produto",
        imageUrl: product.mainImageUrl || prodImage?.imageUrl || null,
        itemUrl: offer.affiliateUrl || offer.originalUrl || "",
        currentPrice: parseFloat(offer.currentPrice) || 0,
        oldPrice: offer.originalPrice ? parseFloat(offer.originalPrice) : null,
        discountPercent: offer.discountPercent ?? null,
        lastSeenAt: offer.lastSeenAt?.toISOString() || new Date().toISOString(),
      });
    }

    return { lastUpdatedAt, items };
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
