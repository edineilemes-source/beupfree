import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import CatalogFilterSidebar from "@/components/CatalogFilterSidebarV2";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Search, Tag, Truck, X } from "lucide-react";
import { NEON, DARK, GREEN_GLOW, alpha } from "@/lib/brand";
import heroBgUrl from "@assets/fundo_rascunho_be_up_1783981500992.png";
import {
  CatalogProduct,
  CatalogFilters,
  MultiFilterKey,
  EMPTY_FILTERS,
  applyFilters,
  computeCrossFacets,
  brandNameOf,
  categoryNameOf,
  discountOf,
  priceOf,
} from "@/lib/catalogFilters";

interface ProductsResponse {
  total: number;
  products: CatalogProduct[];
}

type SortMode = "maior-desconto" | "relevantes" | "menor-preco" | "recentes";

// 21 cards por página no desktop: 7 linhas × 3 colunas.
const PAGE_SIZE = 21;
const URL_FILTER_KEYS: MultiFilterKey[] = [
  "marca",
  "desconto",
  "frete",
  "tamanho",
  "genero",
  "idade",
  "modalidade",
  "tipo",
  "avaliacao",
];

function filtersFromSearch(search: string): CatalogFilters {
  const params = new URLSearchParams(search);
  const next: CatalogFilters = {
    marca: [],
    desconto: [],
    frete: [],
    tamanho: [],
    genero: [],
    idade: [],
    modalidade: [],
    tipo: [],
    avaliacao: [],
    price: null,
  };

  for (const key of URL_FILTER_KEYS) {
    const raw = params.get(key);
    if (raw) {
      next[key] = raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }

  return next;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Busca por texto: todos os termos digitados precisam aparecer no nome ou na
// marca do produto (sem diferenciar acentos/maiúsculas).
function matchesQuery(product: CatalogProduct, tokens: string[]): boolean {
  const haystack = normalizeText(`${product.mainName} ${brandNameOf(product)}`);
  return tokens.every((token) => haystack.includes(token));
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const HERO_PRIMARY_BRANDS = ["Nike", "Adidas", "Olympikus"];

function normalizeBrand(value: string): string {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  // Grafia alternativa vista nos dados coletados.
  return normalized === "olimpikus" ? "olympikus" : normalized;
}

// Rótulos de "marca não identificada" que não devem aparecer no banner.
const GENERIC_BRANDS = new Set(["outra", "outras"]);

function selectHeroProducts(products: CatalogProduct[]): CatalogProduct[] {
  const available = products
    .filter((product) => product.mainImageUrl && product.bestOffer && discountOf(product) > 0)
    .sort((a, b) => discountOf(b) - discountOf(a));

  const selected: CatalogProduct[] = [];
  const usedIds = new Set<string>();

  const pickByBrand = (brand: string) => {
    const normalized = normalizeBrand(brand);
    const product = available.find(
      (item) =>
        !usedIds.has(item.id) &&
        normalizeBrand(brandNameOf(item)).includes(normalized),
    );

    if (product) {
      selected.push(product);
      usedIds.add(product.id);
    }
  };

  // Um card para a melhor promoção de cada marca-âncora (Nike, Adidas,
  // Olympikus). Se alguma delas não tiver produto no catálogo no momento,
  // o espaço é completado abaixo com a melhor oferta de outra marca.
  HERO_PRIMARY_BRANDS.forEach(pickByBrand);

  // Preenche os espaços restantes com a melhor oferta de outra marca,
  // pulando produtos sem marca identificada ("Outra") para o banner
  // sempre exibir marcas reconhecíveis.
  for (const product of available) {
    if (selected.length >= 3) break;
    if (!usedIds.has(product.id) && !GENERIC_BRANDS.has(normalizeBrand(brandNameOf(product)))) {
      selected.push(product);
      usedIds.add(product.id);
    }
  }

  for (const product of available) {
    if (selected.length >= 3) break;
    if (!usedIds.has(product.id)) {
      selected.push(product);
      usedIds.add(product.id);
    }
  }

  return selected.slice(0, 3);
}

function PromoTile({ product }: { product: CatalogProduct }) {
  const price = priceOf(product);
  const oldPrice = product.bestOffer?.originalPrice
    ? parseFloat(product.bestOffer.originalPrice)
    : null;
  const discount = discountOf(product);

  return (
    <a
      href={product.bestOffer?.affiliateUrl || "#"}
      target="_blank"
      rel="noreferrer"
      className="group relative flex min-h-[300px] flex-col rounded-md border-2 border-black bg-white p-5 transition-transform hover:-translate-y-0.5"
      data-testid={`hero-promo-${product.id}`}
    >
      {discount > 0 && (
        <span className="absolute left-5 top-[54%] z-10 rounded-sm bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground shadow-sm">
          -{discount}%
        </span>
      )}

      <div className="flex h-44 items-center justify-center bg-white">
        {product.mainImageUrl && (
          <img
            src={product.mainImageUrl}
            alt={product.mainName}
            className="h-40 w-full object-contain transition-transform group-hover:scale-105"
          />
        )}
      </div>

      <div className="mt-7">
        <p className="text-sm font-extrabold uppercase text-foreground">
          {brandNameOf(product)}
        </p>
        <p className="mt-2 line-clamp-2 min-h-[36px] text-xs font-semibold uppercase leading-snug text-foreground">
          {product.mainName}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <span className="text-lg font-extrabold text-primary">
            {formatBRL(price)}
          </span>
          {oldPrice && oldPrice > price && (
            <span className="text-[11px] text-muted-foreground line-through">
              {formatBRL(oldPrice)}
            </span>
          )}
        </div>
        {product.bestOffer?.freeShipping && (
          <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary px-2.5 py-1 text-[11px] font-bold uppercase text-primary">
            <Truck className="h-3.5 w-3.5" />
            Frete grátis
          </span>
        )}
      </div>
    </a>
  );
}

function Hero({ products }: { products: CatalogProduct[] }) {
  const featured = useMemo(() => selectHeroProducts(products), [products]);

  return (
    <section
      className="border-b border-border px-0 py-0"
      style={{
        backgroundImage: `url(${heroBgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="grid w-full grid-cols-1 gap-4 p-4 md:grid-cols-[330px_1fr] md:gap-5 md:p-6">
        <div
          className="relative flex min-h-[300px] items-center overflow-hidden px-9 py-8"
          style={{ backgroundColor: "black" }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(90% 70% at 90% 35%, ${alpha(GREEN_GLOW, 0.18)}, transparent 64%)`,
            }}
          />
          <h1
            className="relative text-[40px] font-extrabold italic leading-[0.95] tracking-normal text-white"
            data-testid="text-hero-title"
          >
            TÊNIS
            <br />
            <span style={{ color: NEON }}>ESPORTIVOS</span>
            <br />
            EM PROMOÇÃO
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-5">
          {featured.map((product) => (
            <PromoTile key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function CatalogV2() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<CatalogFilters>(() =>
    filtersFromSearch(search),
  );
  const [page, setPage] = useState(1);
  const [sortMode, setSortMode] = useState<SortMode>("maior-desconto");

  useEffect(() => {
    setFilters(filtersFromSearch(search));
  }, [search]);

  const query = useMemo(
    () => (new URLSearchParams(search).get("q") ?? "").trim(),
    [search],
  );
  const queryTokens = useMemo(
    () => normalizeText(query).split(/\s+/).filter(Boolean),
    [query],
  );

  const clearQuery = () => {
    const params = new URLSearchParams(search);
    params.delete("q");
    const qs = params.toString();
    setLocation(qs ? `/catalogo?${qs}` : "/catalogo");
  };

  useEffect(() => {
    setPage(1);
  }, [filters, sortMode, query]);

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["/api/products", "catalog-v2"],
    queryFn: async () => {
      const res = await fetch("/api/products?limit=5000");
      if (!res.ok) throw new Error("Falha ao carregar produtos");
      return (await res.json()) as ProductsResponse;
    },
  });

  const products = useMemo(() => data?.products ?? [], [data]);
  // A busca por texto restringe o universo de produtos; filtros e contadores
  // da barra lateral passam a refletir apenas os resultados da busca.
  const searched = useMemo(
    () =>
      queryTokens.length === 0
        ? products
        : products.filter((product) => matchesQuery(product, queryTokens)),
    [products, queryTokens],
  );
  const facets = useMemo(() => computeCrossFacets(searched, filters), [searched, filters]);
  const filtered = useMemo(() => applyFilters(searched, filters), [searched, filters]);
  const sorted = useMemo(() => {
    const next = [...filtered];

    if (sortMode === "maior-desconto") {
      return next.sort((a, b) => discountOf(b) - discountOf(a));
    }

    if (sortMode === "menor-preco") {
      return next.sort((a, b) => priceOf(a) - priceOf(b));
    }

    if (sortMode === "recentes") {
      return next.sort((a, b) => {
        const aTime = new Date(a.bestOffer?.lastSeenAt || 0).getTime();
        const bTime = new Date(b.bestOffer?.lastSeenAt || 0).getTime();
        return bTime - aTime;
      });
    }

    return next;
  }, [filtered, sortMode]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, sorted],
  );

  const toggle = (key: MultiFilterKey, value: string) => {
    setFilters((prev) => {
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(value)
          ? list.filter((item) => item !== value)
          : [...list, value],
      };
    });
  };

  const setPrice = (price: [number, number] | null) =>
    setFilters((prev) => ({ ...prev, price }));

  const clearAll = () => setFilters(EMPTY_FILTERS);

  return (
    <div className="flex min-h-screen flex-col bg-muted/35">
      <Header />

      <Hero products={products} />

      <main className="flex-1">
        <div className="w-full px-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="flex items-center gap-2 text-xl font-extrabold" data-testid="text-catalog-title">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Tag className="h-3.5 w-3.5" />
                </span>
                {query ? `Resultados para "${query}"` : "Produtos com desconto"}
              </h2>
              {query && (
                <button
                  type="button"
                  onClick={clearQuery}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover-elevate active-elevate-2"
                  data-testid="button-clear-search"
                >
                  <Search className="h-3 w-3 text-muted-foreground" />
                  {query}
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <p className="text-xs text-muted-foreground" data-testid="text-catalog-count">
                Mais de {filtered.length} ofertas
              </p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Ordenar por:
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none"
                  data-testid="select-sort"
                >
                  <option value="maior-desconto">Maior desconto</option>
                  <option value="relevantes">Mais relevantes</option>
                  <option value="menor-preco">Menor preço</option>
                  <option value="recentes">Mais recentes</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-5 px-4 pb-8 md:flex-row">
          {!isLoading && products.length > 0 && (
            <CatalogFilterSidebar
              facets={facets}
              filters={filters}
              onToggle={toggle}
              onPriceChange={setPrice}
              onClearAll={clearAll}
            />
          )}

          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h2 className="mb-2 text-lg font-medium" data-testid="text-empty-catalog">
                  Nenhum produto disponível ainda
                </h2>
                <p className="text-muted-foreground">
                  Nosso catálogo está sendo atualizado. Volte em breve para conferir as melhores ofertas!
                </p>
              </Card>
            ) : filtered.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h2 className="mb-2 text-lg font-medium" data-testid="text-no-results">
                  Nenhuma oferta para os filtros selecionados
                </h2>
                <p className="text-muted-foreground">
                  Tente remover alguns filtros para ver mais resultados.
                </p>
              </Card>
            ) : (
              <>
                <div
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  data-testid="grid-catalog-products"
                >
                  {visible.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={product.id}
                      name={product.mainName}
                      brand={brandNameOf(product)}
                      price={priceOf(product)}
                      oldPrice={
                        product.bestOffer?.originalPrice
                          ? parseFloat(product.bestOffer.originalPrice)
                          : undefined
                      }
                      discount={product.bestOffer?.discountPercent || undefined}
                      image={product.mainImageUrl || ""}
                      category={categoryNameOf(product)}
                      affiliateUrl={product.bestOffer?.affiliateUrl || "#"}
                      freeShipping={product.bestOffer?.freeShipping || false}
                      lastSeenAt={product.bestOffer?.lastSeenAt}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      data-testid="button-page-prev"
                    >
                      Anterior
                    </Button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((pageNumber) => (
                      <Button
                        key={pageNumber}
                        variant={page === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNumber)}
                        data-testid={`button-page-${pageNumber}`}
                      >
                        {pageNumber}
                      </Button>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      data-testid="button-page-next"
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
