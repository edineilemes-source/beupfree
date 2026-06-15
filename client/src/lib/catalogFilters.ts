export interface CatalogBestOffer {
  currentPrice: string;
  originalPrice: string | null;
  discountPercent: number | null;
  affiliateUrl: string;
  freeShipping: boolean;
  lastSeenAt?: string;
}

export interface CatalogProduct {
  id: string;
  mainName: string;
  mainImageUrl: string | null;
  brand: { name: string; slug?: string } | null;
  category: { name: string; slug?: string } | null;
  bestOffer: CatalogBestOffer | null;
}

export interface CatalogFilters {
  marca: string[];
  desconto: string[];
  frete: string[];
  price: [number, number] | null;
}

export const EMPTY_FILTERS: CatalogFilters = {
  marca: [],
  desconto: [],
  frete: [],
  price: null,
};

export const DESCONTO_BUCKETS: { label: string; test: (d: number) => boolean }[] = [
  { label: "50% ou mais", test: (d) => d >= 50 },
  { label: "40% - 49%", test: (d) => d >= 40 && d < 50 },
  { label: "30% - 39%", test: (d) => d >= 30 && d < 40 },
  { label: "20% - 29%", test: (d) => d >= 20 && d < 30 },
  { label: "Até 19%", test: (d) => d > 0 && d < 20 },
];

export const FRETE_OPTIONS = ["Sim", "Não"] as const;

// Products published by the pipeline often have brand_id / category_id unset,
// so we derive a display brand/category from the product title (which always
// contains the brand for ML shoe listings). Multi-word names come first so they
// win over single-word matches.
const KNOWN_BRANDS = [
  "On Running",
  "New Balance",
  "Under Armour",
  "Olympikus",
  "Mizuno",
  "Asics",
  "Adidas",
  "Reebok",
  "Skechers",
  "Converse",
  "Nike",
  "Puma",
  "Fila",
  "Vans",
  "Oakley",
  "Penalty",
  "Umbro",
  "Diadora",
  "Kappa",
  "Lynd",
  "And1",
];

export function detectBrand(name: string): string | null {
  const lower = name.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (lower.includes(brand.toLowerCase())) return brand;
  }
  return null;
}

export function brandNameOf(p: CatalogProduct): string {
  return p.brand?.name || detectBrand(p.mainName) || "Outras";
}

export function categoryNameOf(p: CatalogProduct): string {
  if (p.category?.name) return p.category.name;
  const lower = p.mainName.toLowerCase();
  if (lower.includes("meia")) return "Meias";
  if (lower.includes("chuteira")) return "Chuteira";
  if (lower.includes("sandália") || lower.includes("sandalia") || lower.includes("chinelo"))
    return "Sandálias";
  if (lower.includes("tênis") || lower.includes("tenis")) return "Tênis";
  return "Calçados";
}

export function priceOf(p: CatalogProduct): number {
  const raw = p.bestOffer?.currentPrice;
  const n = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function discountOf(p: CatalogProduct): number {
  return p.bestOffer?.discountPercent ?? 0;
}

function matchesDesconto(p: CatalogProduct, labels: string[]): boolean {
  if (labels.length === 0) return true;
  const d = discountOf(p);
  return labels.some((label) => {
    const bucket = DESCONTO_BUCKETS.find((b) => b.label === label);
    return bucket ? bucket.test(d) : false;
  });
}

function matchesFrete(p: CatalogProduct, labels: string[]): boolean {
  if (labels.length === 0) return true;
  const free = p.bestOffer?.freeShipping ?? false;
  return labels.some((l) => (l === "Sim" ? free : !free));
}

export function applyFilters(products: CatalogProduct[], f: CatalogFilters): CatalogProduct[] {
  return products.filter((p) => {
    if (f.marca.length > 0) {
      if (!f.marca.includes(brandNameOf(p))) return false;
    }
    if (!matchesDesconto(p, f.desconto)) return false;
    if (!matchesFrete(p, f.frete)) return false;
    if (f.price) {
      const price = priceOf(p);
      if (price < f.price[0] || price > f.price[1]) return false;
    }
    return true;
  });
}

export interface CatalogFacets {
  brands: { label: string; count: number }[];
  desconto: Record<string, number>;
  frete: { Sim: number; Não: number };
  priceMin: number;
  priceMax: number;
}

export function computeFacets(products: CatalogProduct[]): CatalogFacets {
  const brandCounts = new Map<string, number>();
  const desconto: Record<string, number> = {};
  DESCONTO_BUCKETS.forEach((b) => (desconto[b.label] = 0));
  const frete = { Sim: 0, Não: 0 };
  let priceMin = Infinity;
  let priceMax = 0;

  for (const p of products) {
    const brand = brandNameOf(p);
    brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);

    const d = discountOf(p);
    for (const bucket of DESCONTO_BUCKETS) {
      if (bucket.test(d)) desconto[bucket.label]++;
    }

    if (p.bestOffer?.freeShipping) frete.Sim++;
    else frete.Não++;

    const price = priceOf(p);
    if (price > 0) {
      priceMin = Math.min(priceMin, price);
      priceMax = Math.max(priceMax, price);
    }
  }

  const brands = Array.from(brandCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    brands,
    desconto,
    frete,
    priceMin: Number.isFinite(priceMin) ? Math.floor(priceMin) : 0,
    priceMax: priceMax > 0 ? Math.ceil(priceMax) : 0,
  };
}

export function countActiveFilters(f: CatalogFilters): number {
  return f.marca.length + f.desconto.length + f.frete.length + (f.price ? 1 : 0);
}
