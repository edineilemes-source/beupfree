import { Router } from "express";
import { z } from "zod";
import {
  insertCurationSourceSchema,
  updateCurationSourceSchema,
} from "@shared/schema";
import type { CurationSourcesRepository } from "./repository";

const filtersSchema = z.object({
  status: z.enum(["active", "inactive", "ended"]).optional(),
  marketplace: z.string().uuid().optional(),
  source_type: z.enum(["promotion", "brand", "category", "outlet", "campaign", "other"]).optional(),
});

function validationError(error: z.ZodError) {
  return { error: "Dados inválidos", issues: error.flatten().fieldErrors };
}

export function createCurationSourcesRouter(repository: CurationSourcesRepository) {
  const router = Router();

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
      res.json({ sources, activeCount: sources.filter((source) => source.status === "active").length });
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

  return router;
}
