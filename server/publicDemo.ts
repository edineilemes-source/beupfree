export function isPublicDemoMode(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PUBLIC_DEMO_MODE?.trim().toLowerCase() === "true";
}

export function isBlockedDemoApiPath(path: string): boolean {
  return (
    path === "/api/admin" ||
    path.startsWith("/api/admin/") ||
    path === "/api/ml" ||
    path.startsWith("/api/ml/") ||
    path === "/api/init" ||
    path.startsWith("/api/init/") ||
    path === "/api/ai" ||
    path.startsWith("/api/ai/") ||
    path === "/api/click" ||
    path.startsWith("/api/click/")
  );
}

export function shouldStartExternalScheduler(env: NodeJS.ProcessEnv = process.env): boolean {
  return !isPublicDemoMode(env);
}

export function createPublicDemoGuard(
  env: NodeJS.ProcessEnv = process.env,
): RequestHandler {
  return (req, res, next) => {
    if (isPublicDemoMode(env) && isBlockedDemoApiPath(req.path)) {
      return res.status(404).json({ error: "Recurso não disponível" });
    }
    next();
  };
}

export function sanitizeDemoOffer<T extends Record<string, unknown>>(offer: T): T {
  return {
    ...offer,
    affiliateUrl: null,
    affiliate_url: null,
    originalUrl: null,
    original_url: null,
    itemUrl: null,
    sourceUrl: null,
    source_url: null,
    rawUrl: null,
    raw_url: null,
    marketplaceName: null,
    marketplace_name: null,
    sellerName: null,
    seller_name: null,
    lastSeenAt: null,
    last_seen_at: null,
    referenceUrl: null,
    storeLabel: "Loja demonstrativa",
    demonstrative: true,
  } as T;
}
import type { RequestHandler } from "express";
