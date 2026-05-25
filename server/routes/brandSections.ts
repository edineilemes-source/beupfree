import { Router } from "express";
import { db, pool } from "../db";
import { collectionBatches, collectionSources } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

const GERAL_SOURCE_URL = "https://www.mercadolivre.com.br/ofertas?category=MLB3900";

// Marcas suportadas — slug → label legível
export const SUPPORTED_BRANDS: Record<string, string> = {
  nike: "Nike",
  adidas: "Adidas",
  puma: "Puma",
  olympikus: "Olympikus",
  asics: "Asics",
  fila: "Fila",
};

async function getGeralSourceId(): Promise<string | null> {
  const [src] = await db
    .select({ id: collectionSources.id })
    .from(collectionSources)
    .where(eq(collectionSources.url, GERAL_SOURCE_URL))
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

// Lista marcas + contagem de itens ativos (para o carrossel da home)
router.get("/api/sections/marcas", async (_req, res) => {
  try {
    const slugs = Object.keys(SUPPORTED_BRANDS);
    const { rows } = await pool.query<{ detected_brand: string; total: string }>(
      `
      SELECT pi.detected_brand, COUNT(DISTINCT LOWER(SUBSTRING(REGEXP_REPLACE(COALESCE(pi.normalized_title, cm.raw_title, ''), '\\s+', ' ', 'g'), 1, 60)))::text AS total
      FROM collection_memberships cm
      JOIN processed_items pi ON pi.content_hash = cm.content_hash
      JOIN collection_sources cs ON cs.id = cm.collection_source_id
      WHERE cs.is_active = true
        AND cm.is_active = true
        AND pi.detected_brand = ANY($1::text[])
      GROUP BY pi.detected_brand
      `,
      [slugs]
    );
    const counts: Record<string, number> = {};
    rows.forEach((r) => { counts[r.detected_brand] = parseInt(r.total, 10); });
    const brands = slugs.map((slug) => ({
      slug,
      name: SUPPORTED_BRANDS[slug],
      total: counts[slug] ?? 0,
    }));
    res.json({ brands });
  } catch (err: any) {
    console.error("[BrandSections] /marcas error:", err.message);
    res.json({ brands: [] });
  }
});

// Ofertas de uma marca específica, paginado, ordenado por desconto DESC
router.get("/api/sections/marca/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "").toLowerCase();
    if (!SUPPORTED_BRANDS[slug]) {
      res.status(404).json({ error: "Marca não suportada" });
      return;
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || "20"), 10) || 20));
    const offset = (page - 1) * pageSize;

    const dedupKey = `LOWER(SUBSTRING(REGEXP_REPLACE(COALESCE(pi.normalized_title, cm.raw_title, ''), '\\s+', ' ', 'g'), 1, 60))`;

    const { rows: countRows } = await pool.query<{ total: string }>(
      `
      SELECT COUNT(DISTINCT ${dedupKey})::text AS total
      FROM collection_memberships cm
      JOIN processed_items pi ON pi.content_hash = cm.content_hash
      JOIN collection_sources cs ON cs.id = cm.collection_source_id
      WHERE cs.is_active = true
        AND cm.is_active = true
        AND pi.detected_brand = $1
      `,
      [slug]
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
        JOIN collection_sources cs ON cs.id = cm.collection_source_id
        WHERE cs.is_active = true
          AND cm.is_active = true
          AND pi.detected_brand = $1
        ORDER BY ${dedupKey}, pi.discount_percent DESC NULLS LAST, cm.last_seen_at DESC, cm.id
      ) AS sub
      ORDER BY sub.discount_percent DESC NULLS LAST, sub.last_seen_at DESC, sub.membership_id
      LIMIT $2 OFFSET $3
      `,
      [slug, pageSize, offset]
    );

    const items = rows
      .map((row) => ({
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
      }))
      .filter((i) => i.currentPrice > 0);

    const lastUpdatedAt = await getLastUpdatedAt(sourceId);
    res.json({ brand: SUPPORTED_BRANDS[slug], slug, items, total, page, pageSize, lastUpdatedAt });
  } catch (err: any) {
    console.error("[BrandSections] /marca/:slug error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
