import {
  type CatalogFilters,
  type MultiFilterKey,
  countActiveFilters,
  normalizeColor,
} from "./catalogFilters";

// Null endpoints are open bounds, never values inferred from a facet.
export type CatalogPrice = [number | null, number | null];
export type CatalogUrlFilters = Omit<CatalogFilters, "price"> & {
  price: CatalogPrice | null;
};
export type CatalogSortMode = "maior-desconto" | "relevantes" | "menor-preco" | "recentes";
export const URL_FILTER_KEYS: MultiFilterKey[] = [
  "marca", "cor", "desconto", "frete", "tamanho", "genero", "idade",
  "modalidade", "tipo", "avaliacao",
];

function priceFromParam(raw: string | null): number | null {
  if (raw === null || !raw.trim()) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function filtersFromSearch(search: string): CatalogUrlFilters {
  const params = new URLSearchParams(search);
  const filters: CatalogUrlFilters = {
    marca: [], cor: [], desconto: [], frete: [], tamanho: [], genero: [],
    idade: [], modalidade: [], tipo: [], avaliacao: [], price: null,
  };
  for (const key of URL_FILTER_KEYS) {
    filters[key] = (params.get(key) ?? "").split(",").map(value => value.trim()).filter(Boolean);
    if (key === "cor") {
      // Preserve the existing color vocabulary; its audit findings are outside V1.
      filters.cor = filters.cor.map(value => normalizeColor(value)?.value)
        .filter((value): value is string => Boolean(value));
    }
  }
  const min = priceFromParam(params.get("priceMin"));
  const max = priceFromParam(params.get("priceMax"));
  if (min !== null || max !== null) filters.price = [min, max];
  return filters;
}

export function queryFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  const official = params.get("busca");
  return (official?.trim() ? official : params.get("q") ?? "").trim();
}

export function toggleFilterSearch(search: string, key: MultiFilterKey, value: string): string {
  const params = new URLSearchParams(search);
  const values = filtersFromSearch(search)[key];
  const next = values.includes(value) ? values.filter(item => item !== value) : [...values, value];
  if (next.length) params.set(key, next.join(","));
  else params.delete(key);
  return params.toString();
}

export function priceSearch(search: string, price: CatalogPrice | null): string {
  const params = new URLSearchParams(search);
  for (const [index, key] of ["priceMin", "priceMax"].entries()) {
    const value = price?.[index];
    if (value != null && Number.isFinite(value) && value >= 0) params.set(key, String(value));
    else params.delete(key);
  }
  return params.toString();
}

export function clearFiltersSearch(search: string): string {
  const params = new URLSearchParams(priceSearch(search, null));
  URL_FILTER_KEYS.forEach(key => params.delete(key));
  return params.toString();
}

export function querySearch(search: string, query: string): string {
  const params = new URLSearchParams(search);
  const value = query.trim();
  if (value) params.set("busca", value);
  else params.delete("busca");
  params.delete("q");
  return params.toString();
}

export function catalogLocation(search: string): string {
  return search ? `/catalogo?${search}` : "/catalogo";
}

// Only the demo's local predicate needs numeric infinities for open endpoints.
// They are never serialized into the URL or the API request.
export function localCatalogFilters(filters: CatalogUrlFilters): CatalogFilters {
  return { ...filters, price: filters.price
    ? [filters.price[0] ?? -Infinity, filters.price[1] ?? Infinity] : null };
}

export function catalogRequestParams(
  filters: CatalogUrlFilters, query: string, sort: CatalogSortMode, page: number, pageSize: number,
): URLSearchParams {
  const sorts = {
    "maior-desconto": "discount-desc", relevantes: "recommended",
    "menor-preco": "price-asc", recentes: "recent-desc",
  } as const;
  const params = new URLSearchParams({ limit: String(pageSize), offset: String((page - 1) * pageSize), sort: sorts[sort] });
  if (query) params.set("q", query);
  for (const key of URL_FILTER_KEYS) {
    if (filters[key].length) params.set(key, filters[key].join(","));
  }
  return new URLSearchParams(priceSearch(params.toString(), filters.price));
}

export function catalogScope(filters: CatalogUrlFilters, query: string, sort: CatalogSortMode): string {
  return JSON.stringify([filters, query, sort]);
}

export type CatalogPagination = { scope: string; page: number };
export function catalogPage(pagination: CatalogPagination, scope: string): number {
  // A changed URL/sort uses page 1 in this render, before React Query can fetch.
  return pagination.scope === scope ? pagination.page : 1;
}

export type CatalogEmptyState = "base" | "filtered" | null;
export function catalogEmptyState(total: number, filters: CatalogUrlFilters, query: string): CatalogEmptyState {
  if (total > 0) return null;
  return query || countActiveFilters(localCatalogFilters(filters)) > 0 ? "filtered" : "base";
}

export function catalogPriceControls(price: CatalogPrice | null, facetMin: number, facetMax: number) {
  // Facets remain suggestions. Keep valid URL selections even outside those bounds.
  const min = Math.min(facetMin, price?.[0] ?? facetMin, price?.[1] ?? facetMin);
  const max = Math.max(facetMax || 1, price?.[0] ?? 0, price?.[1] ?? 0, min);
  return { min, max, values: [price?.[0] ?? min, price?.[1] ?? max] as [number, number] };
}

export function changeCatalogPrice(
  price: CatalogPrice | null, endpoint: 0 | 1, raw: string, bounds: { min: number; max: number },
): CatalogPrice | null {
  const next: CatalogPrice = price ? [...price] : [null, null];
  if (!raw.trim()) next[endpoint] = null;
  else {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return price;
    const clamped = Math.min(bounds.max, Math.max(bounds.min, value));
    const other = next[endpoint === 0 ? 1 : 0];
    next[endpoint] = other === null ? clamped
      : endpoint === 0 ? Math.min(clamped, other) : Math.max(clamped, other);
  }
  return next[0] === null && next[1] === null ? null : next;
}
