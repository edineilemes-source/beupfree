import { useParams, Link } from "wouter";
import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface DealItem {
  id: string;
  title: string;
  imageUrl: string | null;
  itemUrl: string;
  currentPrice: number;
  oldPrice: number | null;
  discountPercent: number | null;
  soldOut: boolean;
  freeShipping: boolean;
  lastSeenAt: string;
}

interface BrandResponse {
  brand: string;
  slug: string;
  items: DealItem[];
  total: number;
  page: number;
  pageSize: number;
  lastUpdatedAt: string | null;
}

const PAGE_SIZE = 20;

export default function Marca() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<DealItem[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  // Reset acumulado quando trocar de marca para evitar mistura de dados
  useEffect(() => {
    setPage(1);
    setAccumulated([]);
    setSeenIds(new Set());
  }, [slug]);

  const { data, isLoading, isFetching, error } = useQuery<BrandResponse>({
    queryKey: ["/api/sections/marca", slug, { page, pageSize: PAGE_SIZE }],
    queryFn: async () => {
      const res = await fetch(`/api/sections/marca/${slug}?page=${page}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) throw new Error("Marca não encontrada");
      const json: BrandResponse = await res.json();
      setAccumulated((prev) => {
        const next = [...prev];
        const newSeen = new Set(seenIds);
        for (const item of json.items) {
          if (!newSeen.has(item.id)) {
            next.push(item);
            newSeen.add(item.id);
          }
        }
        setSeenIds(newSeen);
        return next;
      });
      return json;
    },
    placeholderData: keepPreviousData,
    enabled: !!slug,
  });

  const total = data?.total ?? 0;
  const lastPageItems = data?.items?.length ?? 0;
  // Para de paginar se acumulado >= total OU se a última página retornou menos que o pageSize
  // (cobre casos onde itens com preço inválido são filtrados pós-contagem)
  const hasMore = accumulated.length < total && lastPageItems >= PAGE_SIZE;
  const brandName = data?.brand ?? slug;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="border-b bg-muted/30">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="icon" aria-label="Voltar para a home" data-testid="button-back-home">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-brand-title">
                  Ofertas {brandName}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Os melhores descontos da marca, atualizados em tempo real
                </p>
              </div>
            </div>
            <span className="text-sm text-muted-foreground" data-testid="text-brand-count">
              {accumulated.length} de {total} ofertas
            </span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          {error ? (
            <p className="text-center text-muted-foreground py-12">
              Marca não encontrada.
            </p>
          ) : isLoading && accumulated.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array(10).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-lg" />
              ))}
            </div>
          ) : accumulated.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              Nenhuma oferta disponível para {brandName} no momento.
            </p>
          ) : (
            <>
              <div
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                data-testid="grid-brand-products"
              >
                {accumulated.map((item) => (
                  <ProductCard
                    key={item.id}
                    id={item.id}
                    name={item.title}
                    brand={brandName}
                    price={item.currentPrice}
                    oldPrice={item.oldPrice ?? undefined}
                    discount={item.discountPercent ?? undefined}
                    image={item.imageUrl || ""}
                    category="Calçados"
                    affiliateUrl={item.itemUrl}
                    freeShipping={item.freeShipping}
                    lastSeenAt={item.lastSeenAt}
                    soldOut={item.soldOut}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-8">
                  <Button
                    size="lg"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={isFetching}
                    data-testid="button-load-more-brand"
                  >
                    {isFetching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Carregando...
                      </>
                    ) : (
                      <>Carregar mais {PAGE_SIZE} ofertas</>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
