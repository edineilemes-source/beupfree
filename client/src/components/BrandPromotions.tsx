import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ProductCard from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

interface BrandPromotionItem {
  id: string;
  title: string;
  imageUrl: string | null;
  itemUrl: string;
  currentPrice: number;
  oldPrice: number | null;
  discountPercent: number | null;
  soldOut: boolean;
  lastSeenAt: string;
  firstSeenAt: string;
}

interface BrandSectionResponse {
  lastUpdatedAt: string | null;
  nike: {
    lastUpdatedAt: string | null;
    items: BrandPromotionItem[];
  };
  adidas: {
    lastUpdatedAt: string | null;
    items: BrandPromotionItem[];
  };
}

const formatLastUpdate = (isoString: string | null): string => {
  if (!isoString) return "Nunca atualizado";
  const date = new Date(isoString);
  return formatDistanceToNow(date, { addSuffix: false, locale: ptBR });
};

function BrandSubsection({
  brand,
  items,
  lastUpdatedAt,
}: {
  brand: string;
  items: BrandPromotionItem[];
  lastUpdatedAt: string | null;
}) {
  if (items.length === 0) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-2">{brand}</h3>
        <p className="text-muted-foreground">Nenhum produto disponível</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">{brand}</h3>
        {lastUpdatedAt && (
          <span className="text-xs text-muted-foreground">
            Atualizado: {formatLastUpdate(lastUpdatedAt)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <ProductCard
            key={item.id}
            id={item.id}
            mainName={item.title}
            mainBrand={brand}
            mainImageUrl={item.imageUrl}
            bestOffer={{
              id: item.id,
              currentPrice: String(item.currentPrice),
              oldPrice: item.oldPrice ? String(item.oldPrice) : null,
              discountPercent: item.discountPercent ? String(item.discountPercent) : null,
              itemUrl: item.itemUrl,
              lastSeenAt: new Date(item.lastSeenAt).toISOString(),
            }}
            isSoldOut={item.soldOut}
          />
        ))}
      </div>
    </div>
  );
}

export default function BrandPromotions() {
  const { data, isLoading, error } = useQuery<BrandSectionResponse>({
    queryKey: ["/api/sections/grandes-marcas-hoje"],
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <section className="py-8 md:py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-8">
            Promoções das Grandes Marcas de Hoje
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <Skeleton className="h-6 w-24 mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton key={i} className="h-64 w-full rounded-lg" />
                  ))}
              </div>
            </div>
            <div>
              <Skeleton className="h-6 w-24 mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton key={i} className="h-64 w-full rounded-lg" />
                  ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="py-8 md:py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Promoções das Grandes Marcas de Hoje
          </h2>
          <p className="text-muted-foreground">
            Não foi possível carregar as promoções das marcas. Tente novamente mais tarde.
          </p>
        </div>
      </section>
    );
  }

  const hasAnyItems = (data.nike.items?.length || 0) + (data.adidas.items?.length || 0) > 0;

  if (!hasAnyItems) {
    return (
      <section className="py-8 md:py-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Promoções das Grandes Marcas de Hoje
          </h2>
          <p className="text-muted-foreground">
            Nenhuma promoção com desconto de 40%+ encontrada neste momento.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 md:py-12 px-4 md:px-6 bg-background">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold mb-8">
          Promoções das Grandes Marcas de Hoje
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <BrandSubsection
            brand="Nike"
            items={data.nike.items || []}
            lastUpdatedAt={data.nike.lastUpdatedAt}
          />
          <BrandSubsection
            brand="Adidas"
            items={data.adidas.items || []}
            lastUpdatedAt={data.adidas.lastUpdatedAt}
          />
        </div>
      </div>
    </section>
  );
}
