import connectPgSimple from "connect-pg-simple";
import session, { type SessionOptions } from "express-session";

import { pool } from "../db";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "./constants";

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "./constants";

export function sessionOptions(): SessionOptions {
  const isProduction = process.env.NODE_ENV === "production";
  const secret = process.env.SESSION_SECRET;

  if (isProduction && !secret) {
    throw new Error("SESSION_SECRET must be set in production");
  }

  const PgSession = connectPgSimple(session);
  return {
    name: SESSION_COOKIE_NAME,
    secret: secret ?? "development-only-session-secret",
    store: new PgSession({ pool, createTableIfMissing: true }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction,
      maxAge: SESSION_MAX_AGE_MS,
    },
  };
}

export function authSession() {
  return session(sessionOptions());
}
