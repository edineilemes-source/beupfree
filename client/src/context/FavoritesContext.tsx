import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  FAVORITES_STORAGE_KEY,
  readFavorites,
  writeFavorites,
} from "@/lib/favoritesStorage";
import type { FavoriteProduct, FavoriteReference } from "@/types/favorites";

interface FavoritesContextValue {
  favorites: FavoriteReference[];
  productsById: ReadonlyMap<string, FavoriteProduct>;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
  removeFavorite: (productId: string) => void;
  registerProducts: (products: FavoriteProduct[]) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteReference[]>(readFavorites);
  const [productsById, setProductsById] = useState<Map<string, FavoriteProduct>>(
    () => new Map(),
  );

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key === FAVORITES_STORAGE_KEY) {
        setFavorites(readFavorites());
      }
    };

    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, []);

  const registerProducts = useCallback((products: FavoriteProduct[]) => {
    if (products.length === 0) return;

    setProductsById((current) => {
      const next = new Map(current);
      let changed = false;

      for (const product of products) {
        const previous = next.get(product.id);
        if (!previous || JSON.stringify(previous) !== JSON.stringify(product)) {
          next.set(product.id, product);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, []);

  const removeFavorite = useCallback((productId: string) => {
    setFavorites((current) => {
      const next = current.filter((favorite) => favorite.productId !== productId);
      if (next.length === current.length) return current;
      writeFavorites(next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((current) => {
      const exists = current.some((favorite) => favorite.productId === productId);
      const next = exists
        ? current.filter((favorite) => favorite.productId !== productId)
        : [...current, { productId, savedAt: new Date().toISOString() }];
      writeFavorites(next);
      return next;
    });
  }, []);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.productId)),
    [favorites],
  );
  const isFavorite = useCallback(
    (productId: string) => favoriteIds.has(productId),
    [favoriteIds],
  );

  const value = useMemo(
    () => ({
      favorites,
      productsById,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      registerProducts,
    }),
    [
      favorites,
      productsById,
      isFavorite,
      toggleFavorite,
      removeFavorite,
      registerProducts,
    ],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites deve ser usado dentro de FavoritesProvider");
  }
  return context;
}
