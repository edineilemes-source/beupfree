import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";

import * as argon2 from "argon2";
import express from "express";
import session from "express-session";

import type { User } from "@shared/schema";
import { createAuthRouter } from "./routes";
import type { NewUser, UserRepository } from "./userRepository";

class MemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  async create(input: NewUser): Promise<User> {
    if ([...this.users.values()].some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
      throw Object.assign(new Error("duplicate"), { code: "23505" });
    }
    const now = new Date();
    const user: User = {
      id: crypto.randomUUID(),
      ...input,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async findByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  async findActiveById(id: string) {
    const user = this.users.get(id);
    return user?.isActive ? user : undefined;
  }
}

describe("customer authentication API", () => {
  const repository = new MemoryUserRepository();
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use(session({ name: "uppulse.sid", secret: "test-secret", resave: false, saveUninitialized: false }));
    app.use("/api/auth", createAuthRouter(repository));
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("test server did not start");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function request(path: string, init: RequestInit = {}) {
    return fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
  }

  async function register(email = `user-${crypto.randomUUID()}@example.com`) {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Cliente Teste", email, password: "senha-segura-123" }),
    });
  }

  it("registers a valid user and never returns password_hash", async () => {
    const response = await register();
    assert.equal(response.status, 201);
    const body = await response.json() as any;
    assert.equal(body.user.name, "Cliente Teste");
    assert.equal("passwordHash" in body.user, false);
    assert.equal("password_hash" in body.user, false);
  });

  it("rejects duplicate registration", async () => {
    const email = `duplicate-${crypto.randomUUID()}@example.com`;
    assert.equal((await register(email)).status, 201);
    assert.equal((await register(email.toUpperCase())).status, 409);
  });

  it("trims and normalizes email and name", async () => {
    const email = `NORMALIZED-${crypto.randomUUID()}@EXAMPLE.COM`;
    const response = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "  Nome  ", email: `  ${email}  `, password: "senha-segura-123" }),
    });
    const body = await response.json() as any;
    assert.equal(body.user.name, "Nome");
    assert.equal(body.user.email, email.toLowerCase());
  });

  it("rejects invalid passwords", async () => {
    const short = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Nome", email: "short@example.com", password: "short" }),
    });
    const long = await request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Nome", email: "long@example.com", password: "x".repeat(129) }),
    });
    assert.equal(short.status, 400);
    assert.equal(long.status, 400);
  });

  it("logs in with valid credentials and returns public data", async () => {
    const email = `login-${crypto.randomUUID()}@example.com`;
    await register(email);
    const response = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.toUpperCase(), password: "senha-segura-123" }),
    });
    const body = await response.json() as any;
    assert.equal(response.status, 200);
    assert.equal(body.user.email, email);
    assert.equal("passwordHash" in body.user, false);
  });

  it("uses the same generic error for unknown email and wrong password", async () => {
    const email = `invalid-${crypto.randomUUID()}@example.com`;
    await register(email);
    const responses = await Promise.all([
      request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: "senha-incorreta" }) }),
      request("/api/auth/login", { method: "POST", body: JSON.stringify({ email: "unknown@example.com", password: "senha-incorreta" }) }),
    ]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    assert.deepEqual(responses.map((response) => response.status), [401, 401]);
    assert.deepEqual(bodies[0], bodies[1]);
  });

  it("returns the authenticated user and persists the session", async () => {
    const response = await register();
    const cookie = response.headers.get("set-cookie");
    assert.ok(cookie);
    const me = await request("/api/auth/me", { headers: { cookie } });
    assert.equal(me.status, 200);
    const body = await me.json() as any;
    assert.equal(body.user.name, "Cliente Teste");
    assert.equal("passwordHash" in body.user, false);
  });

  it("returns 401 for anonymous /me", async () => {
    assert.equal((await request("/api/auth/me")).status, 401);
  });

  it("logs out, invalidates the session, and is idempotent", async () => {
    const registered = await register();
    const cookie = registered.headers.get("set-cookie")!;
    const logout = await request("/api/auth/logout", { method: "POST", headers: { cookie } });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get("set-cookie") ?? "", /uppulse\.sid=;/);
    assert.equal((await request("/api/auth/me", { headers: { cookie } })).status, 401);
    assert.equal((await request("/api/auth/logout", { method: "POST" })).status, 204);
  });

  it("stores an Argon2id hash instead of plaintext", async () => {
    const email = `hash-${crypto.randomUUID()}@example.com`;
    await register(email);
    const user = await repository.findByEmail(email);
    assert.ok(user);
    assert.match(user.passwordHash, /^\$argon2id\$/);
    assert.notEqual(user.passwordHash, "senha-segura-123");
    assert.equal(await argon2.verify(user.passwordHash, "senha-segura-123"), true);
  });
});
