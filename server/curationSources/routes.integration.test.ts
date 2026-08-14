import "dotenv/config";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import express from "express";
import pg from "pg";
import { createCurationSourcesRouter } from "./routes";
import { curationSourcesRepository } from "./repository";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const runId = `cura001-${Date.now()}-${crypto.randomUUID()}`;
let marketplaceId = ""; let server: Server; let baseUrl = "";
const sourceIds: string[] = [];

const request = (path = "", init: RequestInit = {}) => fetch(`${baseUrl}/api/admin/curation-sources${path}`, { ...init, headers: { "content-type": "application/json", ...init.headers } });
const valid = (overrides: Record<string, unknown> = {}) => ({ name: `${runId}-fonte`, marketplaceId, url: "https://example.test/promocoes", sourceType: "promotion", status: "active", priority: 20, ...overrides });

describe("curation sources integration with real PostgreSQL", { concurrency: false }, () => {
  before(async () => {
    const schema = await pool.query("SELECT to_regclass('public.curation_sources')::text AS table_name");
    assert.equal(schema.rows[0]?.table_name, "curation_sources", "aplique migrations/0004_curation_sources.sql");
    const marketplace = await pool.query<{ id: string }>("INSERT INTO marketplaces(name, slug, base_url) VALUES($1,$2,$3) RETURNING id", [`${runId}-marketplace`, runId, "https://example.test"]);
    marketplaceId = marketplace.rows[0].id;
    const app = express(); app.use(express.json()); app.use("/api/admin/curation-sources", createCurationSourcesRouter(curationSourcesRepository));
    server = createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("server"); baseUrl = `http://127.0.0.1:${address.port}`;
  });
  after(async () => {
    if (marketplaceId) await pool.query("DELETE FROM curation_sources WHERE marketplace_id=$1", [marketplaceId]);
    if (marketplaceId) await pool.query("DELETE FROM marketplaces WHERE id=$1", [marketplaceId]);
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  });

  it("inserts, updates and filters without touching catalog data", async () => {
    const catalogBefore = Number((await pool.query("SELECT count(*) AS count FROM products")).rows[0].count);
    for (const input of [valid({ name: `${runId}-low`, priority: 1 }), valid({ name: `${runId}-high`, priority: 90, sourceType: "brand" })]) {
      const response = await request("", { method: "POST", body: JSON.stringify(input) }); assert.equal(response.status, 201);
      sourceIds.push((await response.json() as any).id);
    }
    const filtered = await (await request(`?marketplace=${marketplaceId}&source_type=brand&status=active`)).json() as any;
    assert.equal(filtered.sources.length, 1); assert.equal(filtered.sources[0].priority, 90);
    const updated = await request(`/${sourceIds[0]}`, { method: "PATCH", body: JSON.stringify({ status: "inactive", priority: 40 }) });
    assert.equal(updated.status, 200); assert.equal((await updated.json() as any).status, "inactive");
    assert.equal(Number((await pool.query("SELECT count(*) AS count FROM products")).rows[0].count), catalogBefore);
  });

  it("enforces FK, URL, priority and date constraints in PostgreSQL", async () => {
    const sql = "INSERT INTO curation_sources(name,marketplace_id,url,source_type,priority,starts_at,ends_at) VALUES($1,$2,$3,'other',$4,$5,$6)";
    await assert.rejects(pool.query(sql, [runId, crypto.randomUUID(), "https://example.test", 0, null, null]), (error: any) => error.code === "23503");
    await assert.rejects(pool.query(sql, [runId, marketplaceId, "not-a-url", 0, null, null]), (error: any) => error.code === "23514");
    await assert.rejects(pool.query(sql, [runId, marketplaceId, "https://example.test", -1, null, null]), (error: any) => error.code === "23514");
    await assert.rejects(pool.query(sql, [runId, marketplaceId, "https://example.test", 0, "2026-08-15", "2026-08-14"]), (error: any) => error.code === "23514");
  });
});
