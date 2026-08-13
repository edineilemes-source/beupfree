import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../db";
import { brands, categories, marketplaces, offers, products, userFavorites } from "@shared/schema";

export type FavoriteProductData = {
  id: string;
  name: string;
  brand: string;
  price: number;
  oldPrice?: number;
  discount: number;
  image: string;
  category: string;
  affiliateUrl: string;
  marketplaceName?: string;
  sellerName?: string;
  freeShipping?: boolean;
  averageRating?: number | null;
  totalReviews?: number;
};

export type FavoriteItem = { productId: string; savedAt: string; product: FavoriteProductData };

export interface FavoritesRepository {
  list(userId: string): Promise<FavoriteItem[]>;
  add(userId: string, productId: string): Promise<"added" | "exists" | "missing">;
  remove(userId: string, productId: string): Promise<void>;
  merge(userId: string, productIds: string[]): Promise<FavoriteItem[]>;
}

function numeric(value: string | null | undefined) { return value == null ? 0 : Number(value); }

async function list(userId: string): Promise<FavoriteItem[]> {
  const rows = await db
    .select({
      productId: userFavorites.productId, savedAt: userFavorites.createdAt,
      name: products.mainName, image: products.mainImageUrl, averageRating: products.averageRating,
      totalReviews: products.totalReviews, brand: brands.name, category: categories.name,
      price: offers.currentPrice, oldPrice: offers.originalPrice, discount: offers.discountPercent,
      affiliateUrl: offers.affiliateUrl, sellerName: offers.sellerName, freeShipping: offers.freeShipping,
      marketplaceName: marketplaces.name,
    })
    .from(userFavorites)
    .innerJoin(products, eq(products.id, userFavorites.productId))
    .leftJoin(brands, eq(brands.id, products.brandId))
    .leftJoin(categories, eq(categories.id, products.mainCategoryId))
    .leftJoin(offers, and(eq(offers.productId, products.id), eq(offers.status, "active"), sql`${offers.id} = (SELECT o2.id FROM offers o2 WHERE o2.product_id = ${products.id} AND o2.status = 'active' ORDER BY o2.current_price::numeric ASC, o2.created_at DESC LIMIT 1)`))
    .leftJoin(marketplaces, eq(marketplaces.id, offers.marketplaceId))
    .where(eq(userFavorites.userId, userId))
    .orderBy(desc(userFavorites.createdAt), desc(userFavorites.productId));

  return rows.map((row) => ({
    productId: row.productId,
    savedAt: row.savedAt.toISOString(),
    product: {
      id: row.productId, name: row.name, brand: row.brand ?? "", price: numeric(row.price),
      oldPrice: row.oldPrice == null ? undefined : numeric(row.oldPrice), discount: row.discount ?? 0,
      image: row.image ?? "", category: row.category ?? "", affiliateUrl: row.affiliateUrl ?? "#",
      marketplaceName: row.marketplaceName ?? undefined, sellerName: row.sellerName ?? undefined,
      freeShipping: row.freeShipping ?? false,
      averageRating: row.averageRating == null ? null : numeric(row.averageRating),
      totalReviews: row.totalReviews ?? 0,
    },
  }));
}

export const favoritesRepository: FavoritesRepository = {
  list,
  async add(userId, productId) {
    const existingProduct = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);
    if (!existingProduct[0]) return "missing";
    const inserted = await db.insert(userFavorites).values({ userId, productId }).onConflictDoNothing().returning({ productId: userFavorites.productId });
    return inserted.length ? "added" : "exists";
  },
  async remove(userId, productId) {
    await db.delete(userFavorites).where(and(eq(userFavorites.userId, userId), eq(userFavorites.productId, productId)));
  },
  async merge(userId, productIds) {
    await db.transaction(async (tx) => {
      if (!productIds.length) return;
      const valid = await tx.select({ id: products.id }).from(products).where(inArray(products.id, productIds));
      if (valid.length) await tx.insert(userFavorites).values(valid.map(({ id }) => ({ userId, productId: id }))).onConflictDoNothing();
    });
    return list(userId);
  },
};
