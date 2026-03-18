import type { Express } from "express";
import { storage } from "../storage";
import { runCollectionsJob } from "../jobs/collectCollections";

export function registerAdminCollectionsRoutes(app: Express): void {

  app.post("/api/admin/collections/run", async (req, res) => {
    try {
      const { sourceId } = req.body;
      console.log(`[AdminCollections] Iniciando coleta manual${sourceId ? ` da fonte ${sourceId}` : " de todas as fontes"}`);
      const result = await runCollectionsJob(sourceId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("[AdminCollections] Erro na coleta:", error);
      res.status(500).json({ error: error.message });
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
    } catch (error: any) {
      console.error("[AdminCollections] Erro ao buscar status:", error);
      res.status(500).json({ error: error.message });
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
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
