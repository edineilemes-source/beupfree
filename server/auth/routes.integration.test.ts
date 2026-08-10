import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, afterEach, before, describe, it } from "node:test";

import * as argon2 from "argon2";
import express, { type Express } from "express";
import pg from "pg";

import { createAuthRouter } from "./routes";
import { authSession, SESSION_MAX_AGE_MS } from "./session";
import { userRepository } from "./userRepository";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Auth integration tests require DATABASE_URL");
}

const parsedDatabaseUrl = new URL(databaseUrl);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (!loopbackHosts.has(parsedDatabaseUrl.hostname) && process.env.AUTH_INTEGRATION_ALLOW_REMOTE !== "true") {
  throw new Error(
    `Refusing auth integration tests against non-local PostgreSQL host ${parsedDatabaseUrl.hostname}. ` +
    "Set AUTH_INTEGRATION_ALLOW_REMOTE=true only for an isolated test database.",
  );
}

const pool = new Pool({ connectionString: databaseUrl });
const runId = `${Date.now()}-${crypto.randomUUID()}`;
const emailPrefix = `integration-auth-${runId}`;
const testPassword = "integration-password-123";
const trackedSessionIds = new Set<string>();

type Json = Record<string, any>;
type TestServer = { server: Server; baseUrl: string };

function uniqueEmail(label: string) {
  return `${emailPrefix}-${label}-${crypto.randomUUID()}@example.test`;
}

function cookiePair(response: Response): string | undefined {
  return response.headers.get("set-cookie")?.split(";", 1)[0];
}

function sessionIdFromCookie(cookie: string): string {
  const value = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
  assert.match(value, /^s:/, "session cookie must be signed");
  const sid = value.slice(2).split(".", 1)[0];
  trackedSessionIds.add(sid);
  return sid;
}

function assertPublicUser(body: Json) {
  assert.ok(body.user?.id);
  assert.equal("passwordHash" in body.user, false);
  assert.equal("password_hash" in body.user, false);
}

function buildTestApp(): Express {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use(authSession());
  app.get("/test/anonymous-session", (req, res) => {
    (req.session as any).integrationMarker = runId;
    res.status(204).end();
  });
  app.use("/api/auth", createAuthRouter(userRepository));
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.status ?? 500).json({ message: error?.message ?? "Internal Server Error" });
  });
  return app;
}

async function startTestServer(): Promise<TestServer> {
  const server = createServer(buildTestApp());
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Integration test HTTP server did not start");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopTestServer(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function request(target: TestServer, path: string, init: RequestInit = {}) {
  return fetch(`${target.baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

async function register(target: TestServer, email: string, overrides: Json = {}) {
  return request(target, "/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: `Integration Auth ${runId}`, email, password: testPassword, ...overrides }),
  });
}

async function sessionRow(sid: string) {
  const result = await pool.query<{ sid: string; sess: Json; expire: Date }>(
    "SELECT sid, sess, expire FROM session WHERE sid = $1",
    [sid],
  );
  return result.rows[0];
}

async function cleanupRunData() {
  const users = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email LIKE $1",
    [`${emailPrefix}-%`],
  );
  const userIds = users.rows.map(({ id }) => id);
  if (userIds.length > 0) {
    await pool.query("DELETE FROM session WHERE sess->>'userId' = ANY($1::text[])", [userIds]);
  }
  if (trackedSessionIds.size > 0) {
    await pool.query("DELETE FROM session WHERE sid = ANY($1::text[])", [[...trackedSessionIds]]);
    trackedSessionIds.clear();
  }
  await pool.query("DELETE FROM users WHERE email LIKE $1", [`${emailPrefix}-%`]);
}

async function assertNotNullConstraint(column: "name" | "email" | "password_hash") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const values: Record<typeof column, string | null> = {
      name: `Integration Constraint ${runId}`,
      email: uniqueEmail(`constraint-${column}`),
      password_hash: "$argon2id$integration-placeholder",
    };
    values[column] = null;
    await assert.rejects(
      client.query(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)",
        [values.name, values.email, values.password_hash],
      ),
      (error: any) => error?.code === "23502" && error?.column === column,
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

describe("auth integration with real PostgreSQL", { concurrency: false }, () => {
  let http: TestServer;

  before(async () => {
    const schema = await pool.query<{
      users_table: string | null;
      email_index: string | null;
    }>(
      "SELECT to_regclass('public.users')::text AS users_table, " +
      "to_regclass('public.uq_users_email_lower')::text AS email_index",
    );
    assert.equal(
      schema.rows[0]?.users_table,
      "users",
      "users table is missing; apply migrations/0002_users.sql explicitly to the local test database",
    );
    assert.equal(schema.rows[0]?.email_index, "uq_users_email_lower", "case-insensitive users email index is missing");
    http = await startTestServer();

    // Forces connect-pg-simple to initialize its configured PostgreSQL table.
    await request(http, "/api/auth/me");
    const sessionTable = await pool.query<{ table_name: string | null }>(
      "SELECT to_regclass('public.session')::text AS table_name",
    );
    assert.equal(sessionTable.rows[0]?.table_name, "session");
  });

  afterEach(cleanupRunData);

  after(async () => {
    if (http?.server) await stopTestServer(http.server);
    await cleanupRunData();
    await pool.end();
  });

  it("registers and persists a normalized public active user", async () => {
    const email = uniqueEmail("REGISTER").toUpperCase();
    const response = await register(http, `  ${email}  `, { name: "  Integration User  " });
    assert.equal(response.status, 201);
    const body = await response.json() as Json;
    assertPublicUser(body);
    assert.equal(body.user.name, "Integration User");
    assert.equal(body.user.email, email.toLowerCase());
    assert.equal(body.user.isActive, true);

    const persisted = await pool.query("SELECT * FROM users WHERE id = $1", [body.user.id]);
    assert.equal(persisted.rowCount, 1);
    assert.equal(persisted.rows[0].email, email.toLowerCase());
    assert.equal(persisted.rows[0].is_active, true);
  });

  it("persists only an Argon2id password hash that verifies with the real library", async () => {
    const email = uniqueEmail("hash");
    const response = await register(http, email);
    const body = await response.json() as Json;
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [body.user.id]);
    const row = result.rows[0];
    assert.ok(row.password_hash);
    assert.notEqual(row.password_hash, testPassword);
    assert.match(row.password_hash, /^\$argon2id\$/);
    assert.equal(await argon2.verify(row.password_hash, testPassword), true);
    assert.equal(Object.values(row).includes(testPassword), false);
  });

  it("enforces case-insensitive email uniqueness in PostgreSQL", async () => {
    const localPart = `${emailPrefix}-Case-${crypto.randomUUID()}`;
    assert.equal((await register(http, `${localPart}@example.test`)).status, 201);
    assert.equal((await register(http, `${localPart.toLowerCase()}@EXAMPLE.TEST`)).status, 409);
    const count = await pool.query<{ count: string }>(
      "SELECT count(*) FROM users WHERE lower(email) = lower($1)",
      [`${localPart}@example.test`],
    );
    assert.equal(Number(count.rows[0].count), 1);
  });

  it("logs in, sets the secure attributes, and stores the authenticated session in PostgreSQL", async () => {
    const email = uniqueEmail("login");
    const registration = await register(http, email);
    const registeredBody = await registration.json() as Json;
    const response = await request(http, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.toUpperCase(), password: testPassword }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as Json;
    assertPublicUser(body);
    assert.equal(body.user.id, registeredBody.user.id);

    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, /^uppulse\.sid=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\//i);
    assert.doesNotMatch(setCookie, /;\s*Secure/i, "NODE_ENV=test must not emit Secure");
    const sid = sessionIdFromCookie(cookiePair(response)!);
    const stored = await sessionRow(sid);
    assert.ok(stored, "session must exist in PostgreSQL");
    assert.equal(stored.sess.userId, body.user.id);
    const remaining = stored.expire.getTime() - Date.now();
    assert.ok(remaining > SESSION_MAX_AGE_MS - 60_000 && remaining <= SESSION_MAX_AGE_MS + 60_000);
  });

  it("returns equivalent generic errors and creates no session for invalid logins", async () => {
    const email = uniqueEmail("invalid-login");
    await register(http, email);
    const beforeCount = await pool.query<{ count: string }>("SELECT count(*) FROM session");
    const wrongPassword = await request(http, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "incorrect-password-123" }),
    });
    const unknownEmail = await request(http, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: uniqueEmail("unknown"), password: "incorrect-password-123" }),
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.deepEqual(await wrongPassword.json(), await unknownEmail.json());
    assert.equal(wrongPassword.headers.get("set-cookie"), null);
    assert.equal(unknownEmail.headers.get("set-cookie"), null);
    const afterCount = await pool.query<{ count: string }>("SELECT count(*) FROM session");
    assert.equal(afterCount.rows[0].count, beforeCount.rows[0].count);
  });

  it("serves /me with a valid persistent cookie and rejects absent or invalid cookies", async () => {
    const response = await register(http, uniqueEmail("me"));
    const body = await response.json() as Json;
    const cookie = cookiePair(response)!;
    sessionIdFromCookie(cookie);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const me = await request(http, "/api/auth/me", { headers: { cookie } });
      assert.equal(me.status, 200);
      assert.equal((await me.json() as Json).user.id, body.user.id);
    }
    assert.equal((await request(http, "/api/auth/me")).status, 401);
    assert.equal((await request(http, "/api/auth/me", { headers: { cookie: "uppulse.sid=s%3Ainvalid.signature" } })).status, 401);
  });

  it("persists the session across a new Express/HTTP instance", async () => {
    const response = await register(http, uniqueEmail("restart"));
    const body = await response.json() as Json;
    const cookie = cookiePair(response)!;
    sessionIdFromCookie(cookie);
    const secondHttp = await startTestServer();
    try {
      const me = await request(secondHttp, "/api/auth/me", { headers: { cookie } });
      assert.equal(me.status, 200);
      assert.equal((await me.json() as Json).user.id, body.user.id);
    } finally {
      await stopTestServer(secondHttp.server);
    }
  });

  it("removes the PostgreSQL session on logout and remains idempotent", async () => {
    const registered = await register(http, uniqueEmail("logout"));
    const cookie = cookiePair(registered)!;
    const sid = sessionIdFromCookie(cookie);
    assert.ok(await sessionRow(sid));
    const logout = await request(http, "/api/auth/logout", { method: "POST", headers: { cookie } });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get("set-cookie") ?? "", /^uppulse\.sid=;/);
    assert.equal(await sessionRow(sid), undefined);
    assert.equal((await request(http, "/api/auth/me", { headers: { cookie } })).status, 401);
    assert.equal((await request(http, "/api/auth/logout", { method: "POST" })).status, 204);
  });

  it("rejects inactive users without creating another authenticated session", async () => {
    const email = uniqueEmail("inactive");
    const registration = await register(http, email);
    const body = await registration.json() as Json;
    await pool.query("UPDATE users SET is_active = false WHERE id = $1", [body.user.id]);
    const beforeCount = await pool.query<{ count: string }>("SELECT count(*) FROM session");
    const login = await request(http, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: testPassword }),
    });
    assert.equal(login.status, 401);
    assert.equal(login.headers.get("set-cookie"), null);
    const afterCount = await pool.query<{ count: string }>("SELECT count(*) FROM session");
    assert.equal(afterCount.rows[0].count, beforeCount.rows[0].count);
  });

  it("enforces required columns with real PostgreSQL constraints", async () => {
    await assertNotNullConstraint("name");
    await assertNotNullConstraint("email");
    await assertNotNullConstraint("password_hash");
  });

  it("regenerates an anonymous session ID during login", async () => {
    const email = uniqueEmail("fixation");
    await register(http, email);
    const anonymous = await request(http, "/test/anonymous-session");
    const oldCookie = cookiePair(anonymous)!;
    const oldSid = sessionIdFromCookie(oldCookie);
    assert.ok(await sessionRow(oldSid));
    const login = await request(http, "/api/auth/login", {
      method: "POST",
      headers: { cookie: oldCookie },
      body: JSON.stringify({ email, password: testPassword }),
    });
    const newSid = sessionIdFromCookie(cookiePair(login)!);
    assert.notEqual(newSid, oldSid);
    assert.equal(await sessionRow(oldSid), undefined);
    assert.ok(await sessionRow(newSid));
  });

  it("rejects malformed registration payloads without returning 500", async () => {
    const cases: Array<{ body?: string; contentType?: string }> = [
      { body: JSON.stringify({ name: " ", email: uniqueEmail("empty-name"), password: testPassword }) },
      { body: JSON.stringify({ name: "Name", email: "invalid", password: testPassword }) },
      { body: JSON.stringify({ name: "Name", email: uniqueEmail("short"), password: "short" }) },
      { body: JSON.stringify({ name: "Name", email: uniqueEmail("long"), password: "x".repeat(129) }) },
      {},
      { body: JSON.stringify({ unexpected: { nested: true } }) },
      { body: "{invalid-json", contentType: "application/json" },
    ];
    for (const testCase of cases) {
      const response = await request(http, "/api/auth/register", {
        method: "POST",
        body: testCase.body,
        headers: testCase.contentType ? { "content-type": testCase.contentType } : undefined,
      });
      assert.notEqual(response.status, 500);
      assert.ok(response.status >= 400 && response.status < 500);
    }
  });
});
