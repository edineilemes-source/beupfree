import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import CatalogFilterSidebar from "@/components/CatalogFilterSidebarV2";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Tag } from "lucide-react";
import { NEON } from "@/lib/brand";
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

const MARQUEE_REPEATS = 8;

function PromoMarquee() {
  return (
    <section
      className="overflow-hidden border-b border-border"
      style={{ backgroundColor: "black" }}
      aria-label="Tênis esportivos em promoção"
      data-testid="marquee-promo"
    >
      <div className="marquee-track flex w-max items-center py-3.5">
        {[0, 1].map((half) => (
          <div
            key={half}
            className="flex items-center"
            aria-hidden={half === 1}
          >
            {Array.from({ length: MARQUEE_REPEATS }).map((_, index) => (
              <span
                key={index}
                className="flex items-center whitespace-nowrap text-xl font-extrabold italic tracking-wide text-white md:text-2xl"
              >
                <span className="px-6">
                  TÊNIS <span style={{ color: NEON }}>ESPORTIVOS</span> EM
                  PROMOÇÃO
                </span>
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: NEON }}
                />
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CatalogV2() {
  const search = useSearch();
  const [filters, setFilters] = useState<CatalogFilters>(() =>
    filtersFromSearch(search),
  );
  const [page, setPage] = useState(1);
  const [sortMode, setSortMode] = useState<SortMode>("maior-desconto");

  useEffect(() => {
    setFilters(filtersFromSearch(search));
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [filters, sortMode]);

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["/api/products", "catalog-v2"],
    queryFn: async () => {
      const res = await fetch("/api/products?limit=5000");
      if (!res.ok) throw new Error("Falha ao carregar produtos");
      return (await res.json()) as ProductsResponse;
    },
  });

  const products = useMemo(() => data?.products ?? [], [data]);
  const facets = useMemo(() => computeCrossFacets(products, filters), [products, filters]);
  const filtered = useMemo(() => applyFilters(products, filters), [products, filters]);
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

      <PromoMarquee />

      <main className="flex-1">
        <div className="w-full px-4 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <h2 className="flex items-center gap-2 text-xl font-extrabold" data-testid="text-catalog-title">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Tag className="h-3.5 w-3.5" />
              </span>
              Produtos com desconto
            </h2>

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
