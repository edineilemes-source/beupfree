import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  COMPARISON_STORAGE_KEY,
  MAX_COMPARISON_ITEMS,
  clearComparisonStorage,
  parseComparisonDocument,
  readComparison,
  sanitizeComparableProduct,
  writeComparison,
} from "@/lib/comparisonStorage";
import type {
  ComparableProduct,
  ComparisonActionResult,
} from "@/types/comparison";

export interface ComparisonContextValue {
  items: ComparableProduct[];
  comparisonCount: number;
  maxItems: number;
  canAddMore: boolean;
  addToComparison: (item: ComparableProduct) => ComparisonActionResult;
  removeFromComparison: (productId: string) => void;
  clearComparison: () => void;
  isCompared: (productId: string) => boolean;
}

const ComparisonContext = createContext<ComparisonContextValue | null>(null);

function sameItems(left: ComparableProduct[], right: ComparableProduct[]): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ComparableProduct[]>(readComparison);
  const itemsRef = useRef(items);

  useEffect(() => {
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key !== COMPARISON_STORAGE_KEY) return;

      const next = parseComparisonDocument(event.newValue);
      if (sameItems(itemsRef.current, next)) return;
      itemsRef.current = next;
      setItems(next);
    };

    window.addEventListener("storage", syncFromStorage);
    return () => window.removeEventListener("storage", syncFromStorage);
  }, []);

  const addToComparison = useCallback((item: ComparableProduct): ComparisonActionResult => {
    const sanitized = sanitizeComparableProduct(item);
    if (!sanitized) return { status: "invalid_item" };

    const productId = sanitized.product.id;
    const current = itemsRef.current;
    if (current.some((existing) => existing.product.id === productId)) {
      return { status: "already_exists" };
    }
    if (current.length >= MAX_COMPARISON_ITEMS) {
      return { status: "limit_reached" };
    }

    const selected = { ...sanitized, selectedAt: new Date().toISOString() };
    const next = [...current, selected];
    itemsRef.current = next;
    setItems(next);
    writeComparison(next);
    return { status: "added" };
  }, []);

  const removeFromComparison = useCallback((productId: string) => {
    const current = itemsRef.current;
    const next = current.filter((item) => item.product.id !== productId);
    if (next.length === current.length) return;

    itemsRef.current = next;
    setItems(next);
    writeComparison(next);
  }, []);

  const clearComparison = useCallback(() => {
    if (itemsRef.current.length > 0) {
      itemsRef.current = [];
      setItems([]);
    }
    clearComparisonStorage();
  }, []);

  const comparedIds = useMemo(
    () => new Set(items.map((item) => item.product.id)),
    [items],
  );
  const isCompared = useCallback(
    (productId: string) => comparedIds.has(productId),
    [comparedIds],
  );

  const value = useMemo<ComparisonContextValue>(() => ({
    items,
    comparisonCount: items.length,
    maxItems: MAX_COMPARISON_ITEMS,
    canAddMore: items.length < MAX_COMPARISON_ITEMS,
    addToComparison,
    removeFromComparison,
    clearComparison,
    isCompared,
  }), [
    items,
    addToComparison,
    removeFromComparison,
    clearComparison,
    isCompared,
  ]);

  return (
    <ComparisonContext.Provider value={value}>
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison(): ComparisonContextValue {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error("useComparison deve ser usado dentro de ComparisonProvider");
  }
  return context;
}
