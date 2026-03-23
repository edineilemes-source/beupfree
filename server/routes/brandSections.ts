import { Router } from "express";

const router = Router();

interface BrandSectionItem {
  id: string;
  title: string;
  imageUrl: string | null;
  itemUrl: string;
  currentPrice: number;
  oldPrice: number | null;
  discountPercent: number | null;
  soldOut: boolean;
  lastSeenAt: string;
  firstSeenAt: string;
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

router.get("/api/sections/grandes-marcas-hoje", async (req, res) => {
  try {
    // For now, return empty response - data will be populated after Nike/Adidas collections run
    const response: BrandSectionResponse = {
      lastUpdatedAt: null,
      nike: {
        lastUpdatedAt: null,
        items: [],
      },
      adidas: {
        lastUpdatedAt: null,
        items: [],
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
