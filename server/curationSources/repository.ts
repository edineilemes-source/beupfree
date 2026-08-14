import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  curationSources,
  marketplaces,
  type CurationSource,
  type InsertCurationSource,
  type UpdateCurationSource,
} from "@shared/schema";

export type CurationSourceFilters = {
  status?: "active" | "inactive" | "ended";
  marketplaceId?: string;
  sourceType?: "promotion" | "brand" | "category" | "outlet" | "campaign" | "other";
};

export type CurationSourceListItem = CurationSource & { marketplaceName: string };

export interface CurationSourcesRepository {
  listMarketplaces(): Promise<Array<{ id: string; name: string; isActive: boolean | null }>>;
  list(filters?: CurationSourceFilters): Promise<CurationSourceListItem[]>;
  findById(id: string): Promise<CurationSource | undefined>;
  marketplaceExists(id: string): Promise<boolean>;
  create(input: InsertCurationSource): Promise<CurationSource>;
  update(id: string, input: UpdateCurationSource): Promise<CurationSource | undefined>;
}

export class DatabaseCurationSourcesRepository implements CurationSourcesRepository {
  async listMarketplaces() {
    return db.select({ id: marketplaces.id, name: marketplaces.name, isActive: marketplaces.isActive })
      .from(marketplaces).orderBy(asc(marketplaces.name));
  }

  async list(filters: CurationSourceFilters = {}) {
    const conditions = [];
    if (filters.status) conditions.push(eq(curationSources.status, filters.status));
    if (filters.marketplaceId) conditions.push(eq(curationSources.marketplaceId, filters.marketplaceId));
    if (filters.sourceType) conditions.push(eq(curationSources.sourceType, filters.sourceType));

    return db.select({
      id: curationSources.id,
      name: curationSources.name,
      marketplaceId: curationSources.marketplaceId,
      marketplaceName: marketplaces.name,
      url: curationSources.url,
      sourceType: curationSources.sourceType,
      status: curationSources.status,
      priority: curationSources.priority,
      startsAt: curationSources.startsAt,
      endsAt: curationSources.endsAt,
      notes: curationSources.notes,
      createdAt: curationSources.createdAt,
      updatedAt: curationSources.updatedAt,
    }).from(curationSources)
      .innerJoin(marketplaces, eq(curationSources.marketplaceId, marketplaces.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(curationSources.priority), asc(curationSources.startsAt), asc(curationSources.name));
  }

  async findById(id: string) {
    const [source] = await db.select().from(curationSources).where(eq(curationSources.id, id));
    return source;
  }

  async marketplaceExists(id: string) {
    const [marketplace] = await db.select({ id: marketplaces.id }).from(marketplaces).where(eq(marketplaces.id, id));
    return Boolean(marketplace);
  }

  async create(input: InsertCurationSource) {
    const [source] = await db.insert(curationSources).values(input).returning();
    return source;
  }

  async update(id: string, input: UpdateCurationSource) {
    const [source] = await db.update(curationSources)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(curationSources.id, id))
      .returning();
    return source;
  }
}

export const curationSourcesRepository = new DatabaseCurationSourcesRepository();
