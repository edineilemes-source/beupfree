import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import express from "express";
import session from "express-session";
import { createFavoritesRouter } from "./routes";
import type { FavoriteItem, FavoritesRepository } from "./repository";

class MemoryFavorites implements FavoritesRepository {
  byUser = new Map<string, Map<string, FavoriteItem>>();
  valid = new Set(["A", "B", "C", "D"]);
  counter = 0;
  private items(userId: string) { let value = this.byUser.get(userId); if (!value) { value = new Map(); this.byUser.set(userId, value); } return value; }
  async list(userId: string) { return Array.from(this.items(userId).values()).sort((a, b) => b.savedAt.localeCompare(a.savedAt)); }
  async add(userId: string, productId: string) {
    if (!this.valid.has(productId)) return "missing" as const;
    const items = this.items(userId); if (items.has(productId)) return "exists" as const;
    items.set(productId, this.make(productId)); return "added" as const;
  }
  async remove(userId: string, productId: string) { this.items(userId).delete(productId); }
  async merge(userId: string, ids: string[]) { for (const id of new Set(ids)) await this.add(userId, id); return this.list(userId); }
  private make(id: string): FavoriteItem { return { productId: id, savedAt: new Date(Date.now() + this.counter++).toISOString(), product: { id, name: id, brand: "", price: 1, discount: 0, image: "", category: "", affiliateUrl: "#" } }; }
}

describe("favorites API", () => {
  const repository = new MemoryFavorites(); let server: Server; let baseUrl: string;
  before(async () => {
    const app = express(); app.use(express.json());
    app.use(session({ secret: "favorites-test", resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => { const id = req.header("x-user-id"); if (id) req.session.userId = id; next(); });
    app.use("/api/favorites", createFavoritesRouter(repository));
    server = createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("server");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });
  after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const request = (user: string | null, path = "", init: RequestInit = {}) => fetch(`${baseUrl}/api/favorites${path}`, { ...init, headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}), ...init.headers } });

  it("requires authentication", async () => assert.equal((await request(null)).status, 401));
  it("merges A,B with B,C idempotently, rejects bad shapes and ignores invalid IDs", async () => {
    const merge = (ids: unknown) => request("merge-user", "/merge", { method: "POST", body: JSON.stringify({ productIds: ids }) });
    assert.deepEqual((await (await merge(["A", "B"])).json() as any).favorites.map((x: any) => x.productId).sort(), ["A", "B"]);
    assert.deepEqual((await (await merge(["B", "C", "C", null, { bad: true }])).json() as any).favorites.map((x: any) => x.productId).sort(), ["A", "B", "C"]);
    assert.equal((await merge("A")).status, 400);
    assert.equal((await (await merge(["A", "B", "C"])).json() as any).favorites.length, 3);
  });
  it("isolates accounts, orders newest first, avoids duplicates and removes idempotently", async () => {
    assert.equal((await request("user-a", "/A", { method: "POST" })).status, 200);
    assert.equal((await request("user-a", "/A", { method: "POST" })).status, 200);
    await request("user-a", "/B", { method: "POST" });
    const a = (await (await request("user-a")).json() as any).favorites;
    assert.deepEqual(a.map((x: any) => x.productId), ["B", "A"]);
    assert.deepEqual((await (await request("user-b")).json() as any).favorites, []);
    assert.equal((await request("user-b", "/missing", { method: "POST" })).status, 404);
    assert.equal((await request("user-a", "/A", { method: "DELETE" })).status, 200);
    assert.equal((await request("user-a", "/A", { method: "DELETE" })).status, 200);
  });
});
