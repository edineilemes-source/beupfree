import { Router } from "express";
import { z } from "zod";
import type { FavoritesRepository } from "./repository";

const productIdSchema = z.string().trim().min(1).max(36);
const mergeSchema = z.object({ productIds: z.array(z.unknown()).max(1000) });

export function createFavoritesRouter(repository: FavoritesRepository) {
  const router = Router();
  router.use((req, res, next) => req.session.userId ? next() : res.status(401).json({ message: "Não autenticado" }));

  router.get("/", async (req, res, next) => {
    try { return res.json({ favorites: await repository.list(req.session.userId!) }); }
    catch (error) { return next(error); }
  });
  router.post("/merge", async (req, res, next) => {
    const parsed = mergeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Favoritos inválidos" });
    const ids = Array.from(new Set(parsed.data.productIds.flatMap((value) => {
      const result = productIdSchema.safeParse(value);
      return result.success ? [result.data] : [];
    })));
    try { return res.json({ favorites: await repository.merge(req.session.userId!, ids) }); }
    catch (error) { return next(error); }
  });
  router.post("/:productId", async (req, res, next) => {
    const parsed = productIdSchema.safeParse(req.params.productId);
    if (!parsed.success) return res.status(400).json({ message: "Produto inválido" });
    try {
      const result = await repository.add(req.session.userId!, parsed.data);
      if (result === "missing") return res.status(404).json({ message: "Produto não encontrado" });
      return res.json({ favorites: await repository.list(req.session.userId!) });
    } catch (error) { return next(error); }
  });
  router.delete("/:productId", async (req, res, next) => {
    const parsed = productIdSchema.safeParse(req.params.productId);
    if (!parsed.success) return res.status(400).json({ message: "Produto inválido" });
    try {
      await repository.remove(req.session.userId!, parsed.data);
      return res.json({ favorites: await repository.list(req.session.userId!) });
    } catch (error) { return next(error); }
  });
  return router;
}
