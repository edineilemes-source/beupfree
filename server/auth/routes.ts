import { Router } from "express";
import * as argon2 from "argon2";
import { z } from "zod";

import type { User } from "@shared/schema";
import { SESSION_COOKIE_NAME } from "./constants";
import type { UserRepository } from "./userRepository";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

const registrationSchema = credentialsSchema.extend({
  name: z.string().trim().min(1),
});

export type PublicUser = Pick<User, "id" | "name" | "email" | "isActive" | "createdAt" | "updatedAt">;

export function toPublicUser(user: User): PublicUser {
  const { id, name, email, isActive, createdAt, updatedAt } = user;
  return { id, name, email, isActive, createdAt, updatedAt };
}

function regenerateSession(req: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });
}

function saveSession(req: Express.Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });
}

export function createAuthRouter(repository: UserRepository) {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados de cadastro inválidos" });
    }

    try {
      const user = await repository.create({
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await argon2.hash(parsed.data.password, { type: argon2.argon2id }),
      });
      await regenerateSession(req);
      req.session.userId = user.id;
      await saveSession(req);
      return res.status(201).json({ user: toPublicUser(user) });
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({ message: "Não foi possível concluir o cadastro" });
      }
      return next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    const parsed = credentialsSchema.safeParse(req.body);
    const invalid = () => res.status(401).json({ message: "E-mail ou senha inválidos" });
    if (!parsed.success) return invalid();

    try {
      const user = await repository.findByEmail(parsed.data.email);
      if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, parsed.data.password))) {
        return invalid();
      }
      await regenerateSession(req);
      req.session.userId = user.id;
      await saveSession(req);
      return res.json({ user: toPublicUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/logout", (req, res, next) => {
    if (!req.session) {
      res.clearCookie(SESSION_COOKIE_NAME);
      return res.status(204).end();
    }
    return req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie(SESSION_COOKIE_NAME);
      return res.status(204).end();
    });
  });

  router.get("/me", async (req, res, next) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    try {
      const user = await repository.findActiveById(req.session.userId);
      if (!user) return res.status(401).json({ message: "Não autenticado" });
      return res.json({ user: toPublicUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
