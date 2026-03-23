import { Router } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "../db";
import { offers, products, productImages, brands } from "@shared/schema";

const router = Router();

interface BrandSectionItem {
  id: string;
  title: string;
  imageUrl: string | null;
  itemUrl: string;
  currentPrice: number;
  oldPrice: number | null;
  discountPercent: number | null;
  lastSeenAt: string;
}

interface BrandSectionResponse {
  lastUpdatedAt: string | null;
  nike: {
    lastUpdatedAt: string | null;
    items: BrandSectionItem[];
  };
  adidas: {
    lastUpdatedAt: string | null;
    items: BrandSectionItem[];
  };
}

async function getBrandItems(brandSlug: string, limit = 8): Promise<{ items: BrandSectionItem[]; lastUpdatedAt: string | null }> {
  try {
    const brand = await db.query.brands.findFirst({
      where: eq(brands.slug, brandSlug),
    });

    if (!brand) {
      return { items: [], lastUpdatedAt: null };
    }

    const rows = await db
      .select({
        offerId: offers.id,
        currentPrice: offers.currentPrice,
        originalPrice: offers.originalPrice,
        discountPercent: offers.discountPercent,
        affiliateUrl: offers.affiliateUrl,
        originalUrl: offers.originalUrl,
        productId: offers.productId,
        updatedAt: offers.updatedAt,
      })
      .from(offers)
      .innerJoin(products, eq(offers.productId, products.id))
      .where(
        and(
          eq(offers.status, "active"),
          eq(products.catalogStatus, "published"),
          eq(products.brandId, brand.id)
        )
      )
      .orderBy(desc(offers.discountPercent))
      .limit(limit);

    const items: BrandSectionItem[] = [];
    let lastUpdatedAt: string | null = null;

    for (const row of rows) {
      if (!row.productId) continue;

      const product = await db.query.products.findFirst({
        where: eq(products.id, row.productId),
      });

      if (!product) continue;

      const prodImage = await db.query.productImages.findFirst({
        where: eq(productImages.productId, row.productId),
      });

      const updatedIso = row.updatedAt?.toISOString() || new Date().toISOString();
      if (!lastUpdatedAt || updatedIso > lastUpdatedAt) {
        lastUpdatedAt = updatedIso;
      }

      items.push({
        id: row.offerId,
        title: product.mainName || "Produto",
        imageUrl: product.mainImageUrl || prodImage?.imageUrl || null,
        itemUrl: row.affiliateUrl || row.originalUrl || "",
        currentPrice: parseFloat(row.currentPrice) || 0,
        oldPrice: row.originalPrice ? parseFloat(row.originalPrice) : null,
        discountPercent: row.discountPercent ?? null,
        lastSeenAt: updatedIso,
      });
    }

    return { items, lastUpdatedAt };
  } catch (err: any) {
    console.error(`[BrandSections] Error for ${brandSlug}:`, err.message);
    return { items: [], lastUpdatedAt: null };
  }
}

router.get("/api/sections/grandes-marcas-hoje", async (req, res) => {
  try {
    const [nikeData, adidasData] = await Promise.all([
      getBrandItems("nike"),
      getBrandItems("adidas"),
    ]);

    const lastUpdatedAt =
      nikeData.lastUpdatedAt && adidasData.lastUpdatedAt
        ? nikeData.lastUpdatedAt > adidasData.lastUpdatedAt
          ? nikeData.lastUpdatedAt
          : adidasData.lastUpdatedAt
        : nikeData.lastUpdatedAt || adidasData.lastUpdatedAt;

    const response: BrandSectionResponse = {
      lastUpdatedAt,
      nike: {
        lastUpdatedAt: nikeData.lastUpdatedAt,
        items: nikeData.items,
      },
      adidas: {
        lastUpdatedAt: adidasData.lastUpdatedAt,
        items: adidasData.items,
      },
    };

    res.json(response);
  } catch (err: any) {
    console.error("[BrandSections] Error:", err.message || String(err));
    res.status(500).json({
      error: err.message,
      lastUpdatedAt: null,
      nike: { lastUpdatedAt: null, items: [] },
      adidas: { lastUpdatedAt: null, items: [] },
    });
  }
});

export default router;
