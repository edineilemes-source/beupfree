import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import express from "express";
import type { CurationSource, InsertCurationSource, UpdateCurationSource } from "@shared/schema";
import { createCurationSourcesRouter } from "./routes";
import type { CurationSourceFilters, CurationSourcesRepository } from "./repository";

const marketplaceId = "11111111-1111-4111-8111-111111111111";
const otherMarketplaceId = "22222222-2222-4222-8222-222222222222";

class MemoryRepository implements CurationSourcesRepository {
  sources = new Map<string, CurationSource>();
  marketplaces = [{ id: marketplaceId, name: "Marketplace A", isActive: true }];
  async listMarketplaces() { return this.marketplaces; }
  async marketplaceExists(id: string) { return this.marketplaces.some((item) => item.id === id); }
  async findById(id: string) { return this.sources.get(id); }
  async create(input: InsertCurationSource) {
    const now = new Date();
    const source = { id: crypto.randomUUID(), ...input, status: input.status ?? "active", priority: input.priority ?? 0, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, notes: input.notes ?? null, createdAt: now, updatedAt: now } as CurationSource;
    this.sources.set(source.id, source); return source;
  }
  async update(id: string, input: UpdateCurationSource) {
    const current = this.sources.get(id); if (!current) return undefined;
    const source = { ...current, ...input, updatedAt: new Date() } as CurationSource;
    this.sources.set(id, source); return source;
  }
  async list(filters: CurationSourceFilters = {}) {
    return [...this.sources.values()]
      .filter((item) => !filters.status || item.status === filters.status)
      .filter((item) => !filters.marketplaceId || item.marketplaceId === filters.marketplaceId)
      .filter((item) => !filters.sourceType || item.sourceType === filters.sourceType)
      .sort((a, b) => b.priority - a.priority)
      .map((item) => ({ ...item, marketplaceName: "Marketplace A" }));
  }
}

describe("curation sources API", () => {
  const repository = new MemoryRepository(); let server: Server; let baseUrl = "";
  before(async () => {
    const app = express(); app.use(express.json()); app.use("/api/admin/curation-sources", createCurationSourcesRouter(repository));
    server = createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("server"); baseUrl = `http://127.0.0.1:${address.port}`;
  });
  after(() => { server.closeAllConnections(); server.close(); });
  const request = (path = "", init: RequestInit = {}) => fetch(`${baseUrl}/api/admin/curation-sources${path}`, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  const valid = (overrides: Record<string, unknown> = {}) => ({ name: "Campanha esportiva", marketplaceId, url: "https://marketplace.example/ofertas", sourceType: "campaign", status: "active", priority: 10, ...overrides });

  it("creates a valid source and lists it", async () => {
    const response = await request("", { method: "POST", body: JSON.stringify(valid()) });
    assert.equal(response.status, 201); const source = await response.json() as any;
    assert.equal(source.name, "Campanha esportiva");
    const list = await (await request()).json() as any; assert.equal(list.sources.length, 1);
  });
  it("rejects invalid URL and required fields", async () => {
    assert.equal((await request("", { method: "POST", body: JSON.stringify(valid({ url: "javascript:alert(1)" })) })).status, 400);
    assert.equal((await request("", { method: "POST", body: JSON.stringify({}) })).status, 400);
  });
  it("rejects an unknown marketplace and an invalid date range", async () => {
    assert.equal((await request("", { method: "POST", body: JSON.stringify(valid({ marketplaceId: otherMarketplaceId })) })).status, 400);
    assert.equal((await request("", { method: "POST", body: JSON.stringify(valid({ startsAt: "2026-10-02", endsAt: "2026-10-01" })) })).status, 400);
  });
  it("edits and changes all lifecycle statuses", async () => {
    const created = await (await request("", { method: "POST", body: JSON.stringify(valid({ name: "Lifecycle" })) })).json() as any;
    let response = await request(`/${created.id}`, { method: "PATCH", body: JSON.stringify({ name: "Editada" }) }); assert.equal(response.status, 200); assert.equal((await response.json() as any).name, "Editada");
    for (const status of ["inactive", "active", "ended"]) { response = await request(`/${created.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); assert.equal(response.status, 200); assert.equal((await response.json() as any).status, status); }
  });
  it("filters by status, marketplace and type and orders by priority", async () => {
    await request("", { method: "POST", body: JSON.stringify(valid({ name: "Alta", priority: 99, sourceType: "brand" })) });
    const status = await (await request("?status=active")).json() as any; assert.ok(status.sources.every((item: any) => item.status === "active")); assert.equal(status.sources[0].name, "Alta");
    assert.ok(((await (await request(`?marketplace=${marketplaceId}`)).json() as any).sources.length > 0));
    assert.ok((await (await request("?source_type=brand")).json() as any).sources.every((item: any) => item.sourceType === "brand"));
  });
});
