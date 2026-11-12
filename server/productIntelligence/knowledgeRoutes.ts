import { Router } from "express";
import pg from "pg";
import { PgCatalogSearchProjectionRepository } from "../catalogSearchProjection/repository";
import { createSuperCatalogCard } from "./superCatalog";
import { createPostgresResearchCache } from "./postgresCache";
import { resolvePublicCatalogSource } from "../publicCatalog/policy";

/** Read-only, operational-catalog-only endpoint. Never invokes external AI APIs. */
export function createProductKnowledgeRouter() {
  const router = Router();
  let db: pg.Pool | undefined;
  router.get("/:productId", async (req, res) => {
    const id = req.params.productId;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return res.status(400).json({ code: "INVALID_PRODUCT_ID" });
    if (resolvePublicCatalogSource(process.env) !== "operational") return res.status(404).json({ code: "OPERATIONAL_CATALOG_REQUIRED" });
    if (!process.env.AWIN_CURATOR_DATABASE_URL) return res.status(503).json({ code: "CATALOG_DATABASE_NOT_CONFIGURED" });
    try {
      db ??= new pg.Pool({ connectionString: process.env.AWIN_CURATOR_DATABASE_URL, max: 3, statement_timeout: 5000 });
      const rows = await new PgCatalogSearchProjectionRepository(db).getProduct(id);
      if (!rows.length) return res.status(404).json({ code: "PRODUCT_NOT_ELIGIBLE" });
      const product = rows[0] as Record<string, unknown>;
      const masterId = String(product.product_id);
      const brand = String(product.brand_raw ?? "").trim();
      const model = String(product.product_name ?? "").trim();
      if (!brand || !model) return res.status(422).json({ code: "IDENTITY_INCOMPLETE" });
      const base = createSuperCatalogCard({ masterId, brand, model });
      const cache = createPostgresResearchCache({
        query: (sql, params) => db!.query(sql, [...params]),
      });
      const result = await cache.get(base.superHash);
      const card = result?.card ?? base;
      return res.json({
        status: result ? "CACHED_ENRICHED" : "IDENTITY_ONLY",
        catalogSource: "operational",
        brand, model, card,
        researchPaidEnabled: false,
        notice: "Pesquisa externa não foi executada. Evidências só aparecem quando verificadas e armazenadas.",
      });
    } catch (error) {
      console.error("Product knowledge read failed", error instanceof Error ? error.message : "unknown");
      return res.status(503).json({ code: "PRODUCT_KNOWLEDGE_UNAVAILABLE" });
    }
  });
  return router;
}
