import type { NormalizedAwinItem } from "./types";

export type ReconcileStatus = "created" | "updated" | "unchanged";
export type ReconcileResult = { product: ReconcileStatus; variant: ReconcileStatus; offer: ReconcileStatus; imagesCreated: number };

export interface AwinIdentitySnapshot {
  products: Map<string, string>;
  variants: Map<string, string>;
  offers: Map<string, string>;
  images: Set<string>;
}

const digestable = (value: unknown) => JSON.stringify(value);

/** Pure reconciliation used by dry-runs/tests and by a future transactional repository. */
export function reconcileAwinItem(snapshot: AwinIdentitySnapshot, item: NormalizedAwinItem): ReconcileResult {
  const reconcile = (map: Map<string, string>, key: string, next: string): ReconcileStatus => {
    const previous = map.get(key);
    if (previous === undefined) { map.set(key, next); return "created"; }
    if (previous === next) return "unchanged";
    map.set(key, next);
    return "updated";
  };
  const product = reconcile(snapshot.products, item.productKey, digestable(item.product));
  const variant = reconcile(snapshot.variants, item.variantKey, digestable(item.variant));
  const offer = reconcile(snapshot.offers, item.offerKey, digestable(item.offer));
  let imagesCreated = 0;
  for (const url of item.images) {
    const key = `${item.productKey}:${url}`;
    if (!snapshot.images.has(key)) { snapshot.images.add(key); imagesCreated++; }
  }
  return { product, variant, offer, imagesCreated };
}

export function createAwinIdentitySnapshot(): AwinIdentitySnapshot {
  return { products: new Map(), variants: new Map(), offers: new Map(), images: new Set() };
}

