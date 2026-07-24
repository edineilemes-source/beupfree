import type { FavoriteReference } from "@/types/favorites";

export const FAVORITES_STORAGE_KEY = "beupfree:favorites:v1";

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

export function readFavorites(): FavoriteReference[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
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

export function writeFavorites(favorites: FavoriteReference[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // A sessão continua funcional quando o navegador bloqueia o armazenamento.
  }
}
