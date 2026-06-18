import type { Express } from "express";
import { storage } from "../storage";
import { runCollectionsJob } from "../jobs/collectCollections";
import { pool } from "../db";

function errorDetails(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;

  try {
    const serialized = JSON.stringify(
      error,
      Object.getOwnPropertyNames(error as object),
    );
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // Ignore serialization failures and use the fallback below.
  }

  return "Erro desconhecido na coleta. Verifique o terminal do servidor.";
}

export function registerAdminCollectionsRoutes(app: Express): void {

  // Limpa todo o catálogo coletado/publicado para um novo teste de busca.
  // Preserva: brands, categories, marketplaces, admin_users, system_settings,
  // collection_sources (mantém configuração das fontes).
  app.post("/api/admin/reset-catalog", async (_req, res) => {
    try {
      console.log("[AdminCollections] Reset catálogo solicitado");
      await pool.query(`
        TRUNCATE TABLE
          triage_queue,
          processed_items,
          raw_collected_items,
          collection_memberships,
          collection_batches,
          curation_actions,
          affiliate_clicks,
          offers,
          product_images,
          products
        RESTART IDENTITY CASCADE
      `);
      console.log("[AdminCollections] Catálogo limpo.");
      res.json({ success: true });
    } catch (error: unknown) {
      const message = errorDetails(error);
      console.error("[AdminCollections] Erro no reset:", error);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/admin/collections/run", async (req, res) => {
    try {
      const { sourceId } = req.body;
      console.log(`[AdminCollections] Iniciando coleta manual${sourceId ? ` da fonte ${sourceId}` : " de todas as fontes"}`);
      const result = await runCollectionsJob(sourceId);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      const message = errorDetails(error);
      console.error("[AdminCollections] Erro na coleta:", error);
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/admin/collections/status", async (req, res) => {
    try {
      const sources = await storage.getCollectionSources();

      const sourcesWithStats = await Promise.all(
        sources.map(async (source) => {
          const batches = await storage.getCollectionBatches(source.id, 5);
          const lastBatch = batches[0] || null;
          const memberships = await storage.getMembershipStats(source.id);

          return {
            id: source.id,
            name: source.name,
            sourceType: source.sourceType,
            url: source.url,
            isActive: source.isActive,
            collectFrequencyMinutes: source.collectFrequencyMinutes,
            lastRunAt: source.lastRunAt,
            lastBatch: lastBatch
              ? {
                  id: lastBatch.id,
                  status: lastBatch.status,
                  totalCollected: lastBatch.totalCollected,
                  totalErrors: lastBatch.totalErrors,
                  startedAt: lastBatch.startedAt,
                  finishedAt: lastBatch.finishedAt,
                }
              : null,
            memberships: {
              total: memberships.total,
              active: memberships.active,
              inactive: memberships.inactive,
            },
          };
        })
      );

      res.json({ sources: sourcesWithStats });
    } catch (error: unknown) {
      const message = errorDetails(error);
      console.error("[AdminCollections] Erro ao buscar status:", error);
      res.status(500).json({ error: message });
    }
  });

  app.patch("/api/admin/collections/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive, collectFrequencyMinutes, name, url } = req.body;

      const updated = await storage.updateCollectionSource(id, {
        ...(isActive !== undefined && { isActive }),
        ...(collectFrequencyMinutes !== undefined && { collectFrequencyMinutes }),
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
      });

      if (!updated) return res.status(404).json({ error: "Fonte não encontrada" });
      res.json(updated);
    } catch (error: unknown) {
      res.status(500).json({ error: errorDetails(error) });
    }
  });
}
