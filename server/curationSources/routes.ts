import { Router } from "express";
import { z } from "zod";
import {
  insertCurationSourceSchema,
  updateCurationSourceSchema,
} from "@shared/schema";
import type { CurationSourcesRepository } from "./repository";
import { createSourceExecutor, SourceExecutionError } from "./executeSource";
import { providerIsSupported } from "./collectorResolver";

const filtersSchema = z.object({
  status: z.enum(["active", "inactive", "ended"]).optional(),
  marketplace: z.string().uuid().optional(),
  source_type: z.enum(["promotion", "brand", "category", "outlet", "campaign", "other"]).optional(),
});

function validationError(error: z.ZodError) {
  return { error: "Dados inválidos", issues: error.flatten().fieldErrors };
}

type ExecuteSource = ReturnType<typeof createSourceExecutor>;

export function createCurationSourcesRouter(repository: CurationSourcesRepository, providedExecutor?: ExecuteSource) {
  const router = Router();
  const executeSource = providedExecutor ?? createSourceExecutor(repository);

  router.get("/marketplaces", async (_req, res, next) => {
    try {
      res.json({ marketplaces: await repository.listMarketplaces() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const parsed = filtersSchema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json(validationError(parsed.error));
      const sources = await repository.list({
        status: parsed.data.status,
        marketplaceId: parsed.data.marketplace,
        sourceType: parsed.data.source_type,
      });
      const runs = await repository.latestRuns(sources.map((source) => source.id));
      const operational = await Promise.all(sources.map((source) => repository.findOperationalById(source.id)));
      res.json({
        sources: sources.map((source, index) => ({
          ...source,
          collectorSupported: operational[index] ? providerIsSupported(operational[index]!.marketplaceSlug) : false,
          lastRun: runs.get(source.id) ?? null,
        })),
        activeCount: sources.filter((source) => source.status === "active").length,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const parsed = insertCurationSourceSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json(validationError(parsed.error));
      if (!await repository.marketplaceExists(parsed.data.marketplaceId)) {
        return res.status(400).json({ error: "Marketplace inválido" });
      }
      const source = await repository.create(parsed.data);
      res.status(201).json(source);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const current = await repository.findById(req.params.id);
      if (!current) return res.status(404).json({ error: "Lista de curadoria não encontrada" });

      const parsed = updateCurationSourceSchema.safeParse(req.body);
      if (!parsed.success || Object.keys(parsed.success ? parsed.data : {}).length === 0) {
        return res.status(400).json(parsed.success ? { error: "Nenhuma alteração informada" } : validationError(parsed.error));
      }
      const merged = insertCurationSourceSchema.safeParse({ ...current, ...parsed.data });
      if (!merged.success) return res.status(400).json(validationError(merged.error));
      if (parsed.data.marketplaceId && !await repository.marketplaceExists(parsed.data.marketplaceId)) {
        return res.status(400).json({ error: "Marketplace inválido" });
      }
      const source = await repository.update(req.params.id, parsed.data);
      res.json(source);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/collect", async (req, res, next) => {
    try {
      res.json(await executeSource(req.params.id, "manual"));
    } catch (error) {
      if (!(error instanceof SourceExecutionError)) return next(error);
      const status = error.code === "not_found" ? 404
        : error.code === "already_running" ? 409
        : error.code === "collection_failed" ? 502 : 422;
      res.status(status).json({ error: error.message, code: error.code });
    }
  });

  return router;
}
