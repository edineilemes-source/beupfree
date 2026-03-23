import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ProductCard from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

interface DealItem {
  id: string;
  title: string;
  imageUrl: string | null;
  itemUrl: string;
  currentPrice: number;
  oldPrice: number | null;
  discountPercent: number | null;
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
    return formatDistanceToNow(date, { addSuffix: false, locale: ptBR });
  } catch {
    return "Recentemente";
  }
};

export default function LightningDeals() {
  const { data, isLoading } = useQuery<DealSectionResponse>({
    queryKey: ["/api/sections/oferta-relampago"],
    staleTime: 1 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <section className="py-8 md:py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Oferta Relâmpago</h2>
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
    return (
      <section className="py-8 md:py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Oferta Relâmpago</h2>
          <p className="text-muted-foreground">Nenhuma oferta relâmpago disponível no momento!</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 md:py-12 px-4 md:px-6 bg-red-50 dark:bg-red-950/20">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-red-600" />
            <h2 className="text-2xl md:text-3xl font-bold">Oferta Relâmpago</h2>
            <Badge variant="destructive">⚡ Urgente</Badge>
          </div>
          {data.lastUpdatedAt && (
            <span className="text-xs text-muted-foreground">
              Atualizado: {formatLastUpdate(data.lastUpdatedAt)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.items.map((item) => (
            <ProductCard
              key={item.id}
              id={item.id}
              mainName={item.title}
              mainBrand="Tênis"
              mainImageUrl={item.imageUrl}
              bestOffer={{
                id: item.id,
                currentPrice: String(item.currentPrice),
                oldPrice: item.oldPrice ? String(item.oldPrice) : null,
                discountPercent: item.discountPercent ? String(item.discountPercent) : null,
                itemUrl: item.itemUrl,
                lastSeenAt: new Date(item.lastSeenAt).toISOString(),
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
