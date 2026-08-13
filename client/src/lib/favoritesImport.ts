import type { FavoriteReference } from "@/types/favorites";

export type PendingFavoritesImport = {
  userId: string;
  favorites: FavoriteReference[];
};

export const favoritesImportDecisionKey = (userId: string) =>
  `beupfree:favorites:import-decision:${userId}:v1`;

export function pendingFavoritesImport(
  userId: string,
  anonymousFavorites: FavoriteReference[],
): PendingFavoritesImport | null {
  return anonymousFavorites.length > 0
    ? { userId, favorites: [...anonymousFavorites] }
    : null;
}

export function pendingProductIds(pending: PendingFavoritesImport): string[] {
  return Array.from(new Set(pending.favorites.map(({ productId }) => productId)));
}

export async function decideFavoritesImport<T>(
  decision: "confirm" | "decline",
  pending: PendingFavoritesImport,
  merge: (productIds: string[]) => Promise<T>,
): Promise<T | null> {
  if (decision === "decline") return null;
  return merge(pendingProductIds(pending));
}
