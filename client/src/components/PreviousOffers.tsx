import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ProductCard from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";

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

interface DealSectionResponse {
  lastUpdatedAt: string | null;
  items: DealItem[];
}

const formatLastUpdate = (isoString: string | null): string => {
  if (!isoString) return "Nunca atualizado";
  const date = new Date(isoString);
  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
  } catch {
    return "Recentemente";
  }
};

export default function PreviousOffers() {
  const { data, isLoading } = useQuery<DealSectionResponse>({
    queryKey: ["/api/sections/ofertas-anteriores"],
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <section className="py-8 md:py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <History className="w-6 h-6 text-muted-foreground" />
            <h2 className="text-2xl md:text-3xl font-bold">Ofertas Anteriores</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array(8)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-lg" />
              ))}
          </div>
        </div>
      </section>
    );
  }

  if (!data || data.items.length === 0) {
    return null;
  }

  return (
    <section className="py-8 md:py-12 px-4 md:px-6 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-muted-foreground" />
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">Ofertas Anteriores</h2>
              <p className="text-sm text-muted-foreground">
                Produtos que estiveram em oferta — veja os preços históricos
              </p>
            </div>
          </div>
          {data.lastUpdatedAt && (
            <span className="text-xs text-muted-foreground">
              Última atualização {formatLastUpdate(data.lastUpdatedAt)}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.items.map((item) => (
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
              soldOut={true}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
