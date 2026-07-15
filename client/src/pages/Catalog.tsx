import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import CatalogFilterSidebar from "@/components/CatalogFilterSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Tag } from "lucide-react";
import { NEON, DARK, GREEN_GLOW, alpha } from "@/lib/brand";
import {
  CatalogProduct,
  CatalogFilters,
  MultiFilterKey,
  EMPTY_FILTERS,
  applyFilters,
  computeCrossFacets,
  brandNameOf,
  categoryNameOf,
} from "@/lib/catalogFilters";

interface ProductsResponse {
  total: number;
  products: CatalogProduct[];
}

// Os itens do menu (Masculino, Feminino, Infantil, Acessórios) levam para o
// catálogo já filtrado, passando o filtro pela query string da URL
// (ex.: /catalogo?genero=Masculino, /catalogo?tipo=Acessórios). Aqui lemos
// esses parâmetros e montamos o estado inicial dos filtros.
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
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return next;
}

// 21 cards por página no desktop: 7 linhas × 3 colunas.
const PAGE_SIZE = 21;

// Marcas-âncora dos 3 cards principais do banner, nesta ordem.
const ANCHOR_HERO_BRANDS = ["Nike", "Adidas", "Olympikus"];

function Hero({ products }: { products: CatalogProduct[] }) {
  return (
    <section className="relative overflow-hidden" style={{ backgroundColor: DARK }}>
      {/* green wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 72% 35%, ${alpha(NEON, 0.12)}, transparent 60%), radial-gradient(80% 70% at 95% 100%, ${alpha(GREEN_GLOW, 0.2)}, transparent 70%)`,
        }}
      />
      {/* diagonal streaks */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: `linear-gradient(115deg, transparent 46%, ${alpha(NEON, 0.12)} 51%, transparent 55%), linear-gradient(115deg, transparent 60%, ${alpha(NEON, 0.09)} 65%, transparent 69%), linear-gradient(115deg, transparent 76%, ${alpha(NEON, 0.07)} 80%, transparent 84%)`,
        }}
      />

      <div className="container relative mx-auto flex min-h-[300px] items-center gap-4 px-4 py-10 sm:min-h-[340px]">
        <div className="z-10 flex-shrink-0">
          <h1
            className="text-[40px] font-extrabold italic leading-[0.95] tracking-tight text-white sm:text-[52px]"
            data-testid="text-hero-title"
          >
            TÊNIS
            <br />
            <span style={{ color: NEON }}>ESPORTIVOS</span>
            <br />
            EM PROMOÇÃO
          </h1>
        </div>

        {products.length > 0 && (
          <div className="hidden flex-1 items-center justify-center gap-4 sm:flex">
            {products.map((p, i) => (
              <a
                key={p.id}
                href={p.bestOffer?.affiliateUrl || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className={`relative flex flex-col items-center rounded-md border-2 border-black bg-white p-3 shadow-lg ${
                  i === 1 ? "w-48 lg:w-56" : "w-40 lg:w-44"
                }`}
                data-testid={`card-hero-${p.id}`}
              >
                {p.bestOffer?.discountPercent ? (
                  <span
                    className="absolute right-2 top-2 rounded bg-black px-1.5 py-0.5 text-[11px] font-bold text-white"
                    data-testid={`text-hero-discount-${p.id}`}
                  >
                    -{p.bestOffer.discountPercent}%
                  </span>
                ) : null}
                <img
                  src={p.mainImageUrl || ""}
                  alt={p.mainName}
                  className={`w-full object-contain ${i === 1 ? "h-32 lg:h-36" : "h-24 lg:h-28"}`}
                />
                <span
                  className="mt-2 max-w-full truncate text-xs font-bold uppercase tracking-wide text-black"
                  data-testid={`text-hero-brand-${p.id}`}
                >
                  {brandNameOf(p)}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Catalog() {
  const search = useSearch();
  const [filters, setFilters] = useState<CatalogFilters>(() =>
    filtersFromSearch(search),
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reaplica os filtros sempre que a URL muda (ex.: o usuário clica em outro
  // item do menu já estando no catálogo, ou clica em "% Desconto" que volta
  // para o catálogo sem filtros). Ajustes manuais na barra lateral não mexem
  // na URL, então não são sobrescritos.
  useEffect(() => {
    setFilters(filtersFromSearch(search));
  }, [search]);

  // Volta para a primeira "página" sempre que os filtros mudam.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters]);

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["/api/products", "catalog"],
    queryFn: async () => {
      const res = await fetch("/api/products?limit=5000");
      if (!res.ok) throw new Error("Falha ao carregar produtos");
      return (await res.json()) as ProductsResponse;
    },
  });

  const products = useMemo(() => data?.products ?? [], [data]);
  const facets = useMemo(() => computeCrossFacets(products, filters), [products, filters]);
  const filtered = useMemo(() => applyFilters(products, filters), [products, filters]);
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  // Os 3 cards principais do banner: a melhor promoção de cada marca-âncora
  // (Nike, Adidas, Olympikus). Se alguma delas não tiver produto no catálogo
  // no momento, o espaço é completado com a melhor oferta de outra marca.
  const heroProducts = useMemo(() => {
    const sorted = products
      .filter((p) => !!p.mainImageUrl)
      .sort(
        (a, b) =>
          (b.bestOffer?.discountPercent || 0) - (a.bestOffer?.discountPercent || 0),
      );
    const picked: CatalogProduct[] = [];
    for (const brand of ANCHOR_HERO_BRANDS) {
      const best = sorted.find((p) => brandNameOf(p) === brand);
      if (best) picked.push(best);
    }
    // Completa com a melhor oferta de outra marca, evitando produtos sem
    // marca identificada ("Outra"/"Outras") no banner.
    const generic = new Set(["outra", "outras"]);
    for (const p of sorted) {
      if (picked.length >= 3) break;
      if (
        !picked.some((x) => x.id === p.id) &&
        !generic.has(brandNameOf(p).toLowerCase())
      ) {
        picked.push(p);
      }
    }
    for (const p of sorted) {
      if (picked.length >= 3) break;
      if (!picked.some((x) => x.id === p.id)) picked.push(p);
    }
    return picked.slice(0, 3);
  }, [products]);

  const toggle = (key: MultiFilterKey, value: string) => {
    setFilters((prev) => {
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(value)
          ? list.filter((v) => v !== value)
          : [...list, value],
      };
    });
  };

  const setPrice = (price: [number, number] | null) =>
    setFilters((prev) => ({ ...prev, price }));

  const clearAll = () => setFilters(EMPTY_FILTERS);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <Hero products={heroProducts} />

      <main className="flex-1">
        {/* Catalog heading */}
        <div className="container mx-auto px-4 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <h2 className="flex items-center gap-2 text-xl font-extrabold" data-testid="text-catalog-title">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Tag className="h-3.5 w-3.5" />
              </span>
              Produtos com desconto
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="text-catalog-count">
              {filtered.length}{" "}
              {filtered.length === 1 ? "oferta" : "ofertas"}
              {filtered.length !== products.length && (
                <> de {products.length}</>
              )}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="container mx-auto flex flex-col gap-6 px-4 py-6 md:flex-row">
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
                    price={product.bestOffer ? parseFloat(product.bestOffer.currentPrice) : 0}
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
                {filtered.length > visible.length && (
                  <div className="mt-8 flex justify-center">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      data-testid="button-carregar-mais"
                    >
                      Carregar mais ofertas
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
