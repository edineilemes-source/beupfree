import type { FavoriteReference } from "@/types/favorites";

export const anonymousFavoritesKey = "beupfree:favorites:v1";
export const FAVORITES_STORAGE_KEY = anonymousFavoritesKey;
export const userFavoritesKey = (userId: string) => `beupfree:favorites:user:${userId}:v1`;

function isFavoriteReference(value: unknown): value is FavoriteReference {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<FavoriteReference>;
  return (
    typeof candidate.productId === "string" &&
    candidate.productId.length > 0 &&
    typeof candidate.savedAt === "string" &&
    !Number.isNaN(Date.parse(candidate.savedAt))
  );
}

export function readFavorites(key = anonymousFavoritesKey): FavoriteReference[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const unique = new Map<string, FavoriteReference>();
    for (const item of parsed) {
      if (isFavoriteReference(item) && !unique.has(item.productId)) {
        unique.set(item.productId, item);
      }
    }
    return Array.from(unique.values());
  } catch {
    return [];
  }
}

export function writeFavorites(favorites: FavoriteReference[], key = anonymousFavoritesKey): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(favorites));
  } catch {
    // A sessão continua funcional quando o navegador bloqueia o armazenamento.
  }
}
