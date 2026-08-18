import assert from "node:assert/strict";
import test from "node:test";
import {
  createPublicDemoGuard,
  isBlockedDemoApiPath,
  isPublicDemoMode,
  sanitizeDemoOffer,
  shouldStartExternalScheduler,
} from "./publicDemo";
import express from "express";

test("PUBLIC_DEMO_MODE só ativa com valor true explícito", () => {
  assert.equal(isPublicDemoMode({ PUBLIC_DEMO_MODE: "true" }), true);
  assert.equal(isPublicDemoMode({ PUBLIC_DEMO_MODE: " TRUE " }), true);
  assert.equal(isPublicDemoMode({ PUBLIC_DEMO_MODE: "false" }), false);
  assert.equal(isPublicDemoMode({}), false);
});

test("bloqueia superfícies administrativas e externas somente pela classificação de rota", () => {
  for (const path of [
    "/api/admin/triage",
    "/api/admin/reset-catalog",
    "/api/ml/scrape-ofertas",
    "/api/init",
    "/api/ai/ask",
    "/api/click/offer-1",
  ]) assert.equal(isBlockedDemoApiPath(path), true, path);

  for (const path of ["/api/products", "/api/auth/session", "/api/favorites", "/api/health"])
    assert.equal(isBlockedDemoApiPath(path), false, path);
});

test("scheduler externo permanece normal fora da demo e para na demo", () => {
  assert.equal(shouldStartExternalScheduler({ PUBLIC_DEMO_MODE: "true" }), false);
  assert.equal(shouldStartExternalScheduler({ PUBLIC_DEMO_MODE: "false" }), true);
});

test("sanitiza origem, links e recência sem apagar os dados comerciais do snapshot", () => {
  const result = sanitizeDemoOffer({
    id: "offer-1",
    currentPrice: "199.90",
    discountPercent: 20,
    affiliateUrl: "https://www.mercadolivre.com.br/item",
    marketplaceName: "Mercado Livre",
    sellerName: "Seller",
    lastSeenAt: "2026-08-18T00:00:00Z",
  });
  assert.equal(result.currentPrice, "199.90");
  assert.equal(result.discountPercent, 20);
  assert.equal(result.affiliateUrl, null);
  assert.equal(result.marketplaceName, null);
  assert.equal(result.sellerName, null);
  assert.equal(result.lastSeenAt, null);
  assert.equal(result.storeLabel, "Loja demonstrativa");
  assert.equal(result.demonstrative, true);
});

test("guard HTTP bloqueia admin na demo e preserva o comportamento normal", async () => {
  const demoApp = express();
  demoApp.use(createPublicDemoGuard({ PUBLIC_DEMO_MODE: "true" }));
  demoApp.get("/api/admin/probe", (_req, res) => res.json({ exposed: true }));
  demoApp.get("/api/products", (_req, res) => res.json({ public: true }));

  const demoServer = demoApp.listen(0);
  const address = demoServer.address();
  assert(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const blocked = await fetch(`${baseUrl}/api/admin/probe`);
    assert.equal(blocked.status, 404);
    assert.deepEqual(await blocked.json(), { error: "Recurso não disponível" });
    assert.equal((await fetch(`${baseUrl}/api/products`)).status, 200);
  } finally {
    demoServer.close();
  }

  const normalApp = express();
  normalApp.use(createPublicDemoGuard({ PUBLIC_DEMO_MODE: "false" }));
  normalApp.get("/api/admin/probe", (_req, res) => res.json({ exposed: true }));
  const normalServer = normalApp.listen(0);
  const normalAddress = normalServer.address();
  assert(normalAddress && typeof normalAddress === "object");
  try {
    const response = await fetch(`http://127.0.0.1:${normalAddress.port}/api/admin/probe`);
    assert.equal(response.status, 200);
  } finally {
    normalServer.close();
  }
});
