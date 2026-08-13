import "dotenv/config";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import express from "express";
import session from "express-session";
import pg from "pg";
import { createFavoritesRouter } from "./routes";
import { favoritesRepository } from "./repository";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const runId = `favorites-${Date.now()}-${crypto.randomUUID()}`;
const passwordHash = "$argon2id$v=19$m=65536,t=3,p=4$integration$unchanged";
let server: Server; let baseUrl = ""; const userIds: string[] = []; const productIds: string[] = [];

async function cleanup() {
  if (userIds.length) { await pool.query("DELETE FROM session WHERE sess->>'userId' = ANY($1::text[])", [userIds]); await pool.query("DELETE FROM users WHERE id = ANY($1::varchar[])", [userIds]); }
  if (productIds.length) await pool.query("DELETE FROM products WHERE id = ANY($1::varchar[])", [productIds]);
}
async function createUser(label: string) {
  const result = await pool.query<{ id: string }>("INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id", [label, `${runId}-${label}@example.test`, passwordHash]);
  userIds.push(result.rows[0].id); return result.rows[0].id;
}
async function createProduct(label: string) {
  const result = await pool.query<{ id: string }>("INSERT INTO products (main_name,slug,catalog_status) VALUES ($1,$2,'published') RETURNING id", [label, `${runId}-${label}`]);
  productIds.push(result.rows[0].id); return result.rows[0].id;
}
const request = (userId: string, path = "", init: RequestInit = {}) => fetch(`${baseUrl}/api/favorites${path}`, { ...init, headers: { "content-type": "application/json", "x-user-id": userId, ...init.headers } });

describe("favorites integration with real PostgreSQL", { concurrency: false }, () => {
  before(async () => {
    const schema = await pool.query("SELECT to_regclass('public.user_favorites')::text AS table_name");
    assert.equal(schema.rows[0]?.table_name, "user_favorites", "apply migrations/0003_user_favorites.sql");
    const app = express(); app.use(express.json()); app.use(session({ secret: "favorites-integration", resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => { req.session.userId = req.header("x-user-id") ?? undefined; next(); });
    app.use("/api/favorites", createFavoritesRouter(favoritesRepository));
    server = createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("server"); baseUrl = `http://127.0.0.1:${address.port}`;
  });
  after(async () => { await cleanup(); await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())); await pool.end(); });

  it("adds, deduplicates, sorts, removes idempotently, merges repeatedly and isolates users", async () => {
    const userA = await createUser("a"), userB = await createUser("b");
    const a = await createProduct("a"), b = await createProduct("b"), c = await createProduct("c");
    assert.equal((await request(userA, `/${a}`, { method: "POST" })).status, 200);
    assert.equal((await request(userA, `/${a}`, { method: "POST" })).status, 200);
    await pool.query("UPDATE user_favorites SET created_at = now() - interval '1 day' WHERE user_id=$1 AND product_id=$2", [userA, a]);
    await request(userA, `/${b}`, { method: "POST" });
    let body = await (await request(userA)).json() as any;
    assert.deepEqual(body.favorites.map((x: any) => x.productId), [b, a]);
    assert.equal(body.favorites[0].product.id, b);
    const merge = () => request(userA, "/merge", { method: "POST", body: JSON.stringify({ productIds: [a, b, c, c, "missing"] }) });
    assert.equal((await merge()).status, 200); assert.equal(((await (await merge()).json() as any).favorites).length, 3);
    assert.deepEqual((await (await request(userB)).json() as any).favorites, []);
    assert.equal((await request(userA, `/${a}`, { method: "DELETE" })).status, 200);
    assert.equal((await request(userA, `/${a}`, { method: "DELETE" })).status, 200);
  });

  it("enforces both FKs, cascades user deletion, and leaves password/session data untouched", async () => {
    const user = await createUser("constraints"), product = await createProduct("constraints");
    await pool.query("INSERT INTO user_favorites(user_id,product_id) VALUES($1,$2)", [user, product]);
    await assert.rejects(pool.query("INSERT INTO user_favorites(user_id,product_id) VALUES($1,$2)", [crypto.randomUUID(), product]), (e: any) => e.code === "23503");
    await assert.rejects(pool.query("INSERT INTO user_favorites(user_id,product_id) VALUES($1,$2)", [user, crypto.randomUUID()]), (e: any) => e.code === "23503");
    const before = await pool.query("SELECT password_hash FROM users WHERE id=$1", [user]);
    await pool.query("INSERT INTO session(sid,sess,expire) VALUES($1,$2,now()+interval '1 hour')", [`${runId}-sid`, JSON.stringify({ userId: user })]);
    await request(user);
    assert.equal((await pool.query("SELECT password_hash FROM users WHERE id=$1", [user])).rows[0].password_hash, before.rows[0].password_hash);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM session WHERE sid=$1", [`${runId}-sid`])).rows[0].count, 1);
    await pool.query("DELETE FROM users WHERE id=$1", [user]);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM user_favorites WHERE user_id=$1", [user])).rows[0].count, 0);
  });
});
