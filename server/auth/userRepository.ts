import { eq, sql } from "drizzle-orm";

import { db } from "../db";
import { users, type User } from "@shared/schema";

export type NewUser = Pick<User, "name" | "email" | "passwordHash">;

export interface UserRepository {
  create(input: NewUser): Promise<User>;
  findByEmail(email: string): Promise<User | undefined>;
  findActiveById(id: string): Promise<User | undefined>;
}

export const userRepository: UserRepository = {
  async create(input) {
    const [user] = await db.insert(users).values(input).returning();
    return user;
  },

  async findByEmail(email) {
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    return user;
  },

  async findActiveById(id) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user?.isActive ? user : undefined;
  },
};
