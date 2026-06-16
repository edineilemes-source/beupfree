import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import CatalogFilterSidebar from "@/components/CatalogFilterSidebarV2";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Package, Tag, ChevronLeft, ChevronRight } from "lucide-react";
import { NEON, DARK, GREEN_GLOW, alpha } from "@/lib/brand";
import {
  CatalogProduct,
  CatalogFilters,
  MultiFilterKey,
  EMPTY_FILTERS,
  applyFilters,
  computeFacets,
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

const PAGE_SIZE = 60;

function Hero({ images }: { images: string[] }) {
  // Agrupa as imagens dos produtos em "slides" de 3 tênis cada, para o carrossel.
  const pages = useMemo(() => {
    const groups: string[][] = [];
    for (let i = 0; i < images.length; i += 3) {
      groups.push(images.slice(i, i + 3));
    }
    return groups.slice(0, 5);
  }, [images]);

  const count = Math.max(pages.length, 1);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (page >= count) setPage(0);
  }, [count, page]);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setPage((p) => (p + 1) % count), 5000);
    return () => clearInterval(t);
  }, [count]);

  const shoes = pages[page] ?? [];
  const goPrev = () => setPage((p) => (p - 1 + count) % count);
  const goNext = () => setPage((p) => (p + 1) % count);

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

        {shoes.length > 0 && (
          <div
            className="relative hidden flex-1 items-end justify-center sm:flex"
            style={{ minHeight: 240 }}
          >
            {/* stage glow */}
            <div
              className="absolute bottom-8 left-1/2 h-12 w-[88%] -translate-x-1/2 rounded-[50%]"
              style={{
                background: `radial-gradient(ellipse at center, ${NEON} 0%, ${alpha(NEON, 0)} 70%)`,
                filter: "blur(14px)",
                opacity: 0.55,
              }}
            />
            {/* stage rim light */}
            <div
              className="absolute bottom-10 left-1/2 h-[3px] w-[66%] -translate-x-1/2 rounded-full"
              style={{
                background: NEON,
                boxShadow: `0 0 16px 2px ${NEON}`,
                opacity: 0.9,
              }}
            />
            <div className="relative flex items-end justify-center gap-2 pb-10">
              {shoes.map((src, i) => (
                <img
                  key={`${page}-${i}`}
                  src={src}
                  alt=""
                  className={`object-contain drop-shadow-2xl ${
                    i === 1 ? "h-36 w-44 sm:h-44 sm:w-56" : "h-28 w-36 sm:h-32 sm:w-44"
                  } ${i === 0 ? "-rotate-6" : i === 2 ? "rotate-6" : ""}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* prev / next arrows */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Anterior"
            data-testid="button-hero-prev"
            className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:flex"
            style={{ border: `2px solid ${NEON}`, color: NEON, backgroundColor: alpha(DARK, 0.8) }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Próximo"
            data-testid="button-hero-next"
            className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:flex"
            style={{ border: `2px solid ${NEON}`, color: NEON, backgroundColor: alpha(DARK, 0.8) }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* dots */}
      {count > 1 && (
        <div className="absolute bottom-3 left-1/2 z-10 hidden -translate-x-1/2 gap-2 sm:flex">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              aria-label={`Ir para slide ${i + 1}`}
              data-testid={`dot-hero-${i}`}
              className="h-2.5 w-2.5 rounded-full transition-all"
              style={{ backgroundColor: i === page ? NEON : "rgba(255,255,255,0.4)" }}
            />
          ))}
        </div>
      )}
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
  const facets = useMemo(() => computeFacets(products), [products]);
  const filtered = useMemo(() => applyFilters(products, filters), [products, filters]);
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const heroImages = useMemo(
    () => products.map((p) => p.mainImageUrl).filter((x): x is string => !!x).slice(0, 15),
    [products],
  );

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

      <Hero images={heroImages} />

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
