import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { anonymousFavoritesKey, readFavorites, userFavoritesKey, writeFavorites } from "@/lib/favoritesStorage";
import type { FavoriteProduct, FavoriteReference } from "@/types/favorites";
import { useAuth } from "@/context/AuthContext";
import FavoritesImportDialog from "@/components/FavoritesImportDialog";
import { decideFavoritesImport, favoritesImportDecisionKey, pendingFavoritesImport, type PendingFavoritesImport } from "@/lib/favoritesImport";

type FavoriteApiItem = FavoriteReference & { product: FavoriteProduct };
type OwnedState = { ownerId: string | null; favorites: FavoriteReference[]; products: Map<string, FavoriteProduct> };

interface FavoritesContextValue {
  favorites: FavoriteReference[];
  productsById: ReadonlyMap<string, FavoriteProduct>;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => void;
  removeFavorite: (productId: string) => void;
  registerProducts: (products: FavoriteProduct[]) => void;
  syncError: string | null;
  isSyncing: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function validApiItems(value: unknown): FavoriteApiItem[] | null {
  if (!value || typeof value !== "object" || !Array.isArray((value as any).favorites)) return null;
  const items = (value as any).favorites as unknown[];
  if (!items.every((item: any) => item && typeof item.productId === "string" &&
    typeof item.savedAt === "string" && !Number.isNaN(Date.parse(item.savedAt)) &&
    item.product && item.product.id === item.productId && typeof item.product.name === "string")) return null;
  return items as FavoriteApiItem[];
}

function stateFromItems(ownerId: string, items: FavoriteApiItem[]): OwnedState {
  return {
    ownerId,
    favorites: items.map(({ productId, savedAt }) => ({ productId, savedAt })),
    products: new Map(items.map(({ productId, product }) => [productId, product])),
  };
}

async function favoritesRequest(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, credentials: "include" });
  if (!response.ok) throw new Error("Não foi possível sincronizar seus Favoritos.");
  const parsed = validApiItems(await response.json());
  if (!parsed) throw new Error("O servidor retornou Favoritos inválidos.");
  return parsed;
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [state, setState] = useState<OwnedState>(() => ({ ownerId: null, favorites: readFavorites(), products: new Map() }));
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingFavoritesImport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const transitionRef = useRef(0);
  const anonymousProductsRef = useRef<Map<string, FavoriteProduct>>(new Map());
  const activeUserRef = useRef<string | null>(null);

  const expectedOwner = user?.id ?? null;
  const visible = !authLoading && state.ownerId === expectedOwner
    ? state
    : { ownerId: expectedOwner, favorites: [], products: new Map<string, FavoriteProduct>() };

  useEffect(() => {
    if (authLoading) return;
    const transition = ++transitionRef.current;
    setSyncError(null);
    setPendingImport(null);
    setImportError(null);
    setIsImporting(false);

    if (!user) {
      if (activeUserRef.current) window.sessionStorage.removeItem(favoritesImportDecisionKey(activeUserRef.current));
      activeUserRef.current = null;
      setIsSyncing(false);
      setState({ ownerId: null, favorites: readFavorites(), products: new Map(anonymousProductsRef.current) });
      return;
    }

    const cacheKey = userFavoritesKey(user.id);
    activeUserRef.current = user.id;
    setState({ ownerId: user.id, favorites: readFavorites(cacheKey), products: new Map() });
    setIsSyncing(true);
    const anonymous = readFavorites();
    void favoritesRequest("/api/favorites").then((items) => {
      if (transitionRef.current !== transition) return;
      const next = stateFromItems(user.id, items);
      writeFavorites(next.favorites, cacheKey);
      setState(next);
      const decidedThisSession = window.sessionStorage.getItem(favoritesImportDecisionKey(user.id)) === "decided";
      setPendingImport(decidedThisSession ? null : pendingFavoritesImport(user.id, anonymous));
    }).catch((error) => {
      if (transitionRef.current === transition) setSyncError(error instanceof Error ? error.message : "Erro de sincronização.");
    }).finally(() => {
      if (transitionRef.current === transition) setIsSyncing(false);
    });
  }, [user?.id, authLoading]);

  const declineImport = useCallback(() => {
    if (pendingImport) window.sessionStorage.setItem(favoritesImportDecisionKey(pendingImport.userId), "decided");
    setPendingImport(null);
    setImportError(null);
  }, [pendingImport]);

  const confirmImport = useCallback(async () => {
    if (!pendingImport || pendingImport.userId !== expectedOwner || isImporting) return;
    const transition = transitionRef.current;
    const accountBefore = state;
    setIsImporting(true);
    setImportError(null);
    try {
      const items = await decideFavoritesImport("confirm", pendingImport, (productIds) =>
        favoritesRequest("/api/favorites/merge", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds }),
        }),
      );
      if (!items) return;
      if (transitionRef.current !== transition || expectedOwner !== pendingImport.userId) return;
      const next = stateFromItems(pendingImport.userId, items);
      writeFavorites(next.favorites, userFavoritesKey(pendingImport.userId));
      window.sessionStorage.setItem(favoritesImportDecisionKey(pendingImport.userId), "decided");
      setState(next);
      setPendingImport(null);
    } catch (error) {
      if (transitionRef.current === transition && expectedOwner === pendingImport.userId) {
        setState(accountBefore);
        setImportError(error instanceof Error ? error.message : "Não foi possível adicionar os Favoritos.");
      }
    } finally {
      if (transitionRef.current === transition) setIsImporting(false);
    }
  }, [pendingImport, expectedOwner, isImporting, state]);

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (!user && event.key === anonymousFavoritesKey) {
        setState((current) => ({ ...current, ownerId: null, favorites: readFavorites() }));
      }
    };
    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, [user]);

  const registerProducts = useCallback((products: FavoriteProduct[]) => {
    if (!products.length) return;
    setState((current) => {
      if (current.ownerId !== expectedOwner) return current;
      const next = new Map(current.products);
      products.forEach((product) => next.set(product.id, product));
      if (current.ownerId === null) anonymousProductsRef.current = new Map(next);
      return { ...current, products: next };
    });
  }, [expectedOwner]);

  const mutateAuthenticated = useCallback(async (productId: string, method: "POST" | "DELETE", before: OwnedState) => {
    const operationTransition = transitionRef.current;
    try {
      const items = await favoritesRequest(`/api/favorites/${encodeURIComponent(productId)}`, { method });
      if (transitionRef.current !== operationTransition || expectedOwner !== before.ownerId) return;
      const next = stateFromItems(before.ownerId!, items);
      writeFavorites(next.favorites, userFavoritesKey(before.ownerId!));
      setState(next);
      setSyncError(null);
    } catch (error) {
      if (transitionRef.current === operationTransition && expectedOwner === before.ownerId) {
        setState(before);
        setSyncError(error instanceof Error ? error.message : "Erro de sincronização.");
      }
    }
  }, [expectedOwner]);

  const toggleFavorite = useCallback((productId: string) => {
    setState((current) => {
      if (current.ownerId !== expectedOwner || authLoading) return current;
      const exists = current.favorites.some((item) => item.productId === productId);
      const nextFavorites = exists ? current.favorites.filter((item) => item.productId !== productId)
        : [{ productId, savedAt: new Date().toISOString() }, ...current.favorites];
      const next = { ...current, favorites: nextFavorites };
      if (!user) writeFavorites(nextFavorites);
      else void mutateAuthenticated(productId, exists ? "DELETE" : "POST", current);
      return next;
    });
  }, [expectedOwner, authLoading, user, mutateAuthenticated]);

  const removeFavorite = useCallback((productId: string) => {
    if (visible.favorites.some((item) => item.productId === productId)) toggleFavorite(productId);
  }, [visible.favorites, toggleFavorite]);

  const favoriteIds = useMemo(() => new Set(visible.favorites.map((item) => item.productId)), [visible.favorites]);
  const isFavorite = useCallback((productId: string) => favoriteIds.has(productId), [favoriteIds]);
  const value = useMemo(() => ({ favorites: visible.favorites, productsById: visible.products, isFavorite,
    toggleFavorite, removeFavorite, registerProducts, syncError, isSyncing }),
  [visible.favorites, visible.products, isFavorite, toggleFavorite, removeFavorite, registerProducts, syncError, isSyncing]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
      {pendingImport?.userId === expectedOwner && (
        <FavoritesImportDialog
          count={pendingImport.favorites.length}
          error={importError}
          isSubmitting={isImporting}
          onConfirm={() => void confirmImport()}
          onDecline={declineImport}
        />
      )}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites deve ser usado dentro de FavoritesProvider");
  return context;
}
