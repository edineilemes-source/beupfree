import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import ProductCard from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tag, Loader2 } from "lucide-react";

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

interface GeneralOffersResponse {
  lastUpdatedAt: string | null;
  items: DealItem[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 50;

export default function GeneralOffers() {
  const [accumulated, setAccumulated] = useState<DealItem[]>([]);
  const [page, setPage] = useState(1);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching } = useQuery<GeneralOffersResponse>({
    queryKey: ["/api/sections/ofertas-gerais", { page, pageSize: PAGE_SIZE }],
    queryFn: async () => {
      const res = await fetch(`/api/sections/ofertas-gerais?page=${page}&pageSize=${PAGE_SIZE}`);
      if (!res.ok) throw new Error("Falha ao carregar ofertas gerais");
      const json: GeneralOffersResponse = await res.json();

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
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const hasMore = accumulated.length < total;

  if (isLoading && accumulated.length === 0) {
    return (
      <section className="py-8 md:py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ofertas Gerais</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array(10).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (accumulated.length === 0) {
    return (
      <section className="py-8 md:py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ofertas Gerais</h2>
          <p className="text-muted-foreground">Nenhuma oferta geral disponível no momento.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 md:py-12 px-4 md:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Tag className="w-6 h-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold">Ofertas Gerais</h2>
          </div>
          <span className="text-sm text-muted-foreground" data-testid="text-general-count">
            {accumulated.length} de {total} ofertas
          </span>
        </div>

        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          data-testid="grid-general-offers"
        >
          {accumulated.map((item) => (
            <ProductCard
              key={item.id}
              id={item.id}
              name={item.title}
              brand="Tênis"
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
              data-testid="button-load-more-general"
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Carregando...
                </>
              ) : (
                <>Carregar mais 50 ofertas</>
              )}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
