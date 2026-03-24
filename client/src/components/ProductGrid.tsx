import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import ProductCard from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface BestOffer {
  id: string;
  currentPrice: string;
  originalPrice: string | null;
  discountPercent: number | null;
  affiliateUrl: string;
  freeShipping: boolean;
  lastSeenAt?: Date | string;
}

interface ProductFromAPI {
  id: string;
  mainName: string;
  mainImageUrl: string | null;
  brand: { name: string } | null;
  category: { name: string } | null;
  bestOffer: BestOffer | null;
  offersCount: number;
}

interface ProductsResponse {
  total: number;
  products: ProductFromAPI[];
}

const SHOW_COUNT = 16;

export default function ProductGrid() {
  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ['/api/products'],
  });

  const products = data?.products || [];
  const total = data?.total ?? 0;

  if (isLoading) {
    return (
      <section className="py-10 md:py-14" data-testid="section-products">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-products-title">
              Melhores Ofertas
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: SHOW_COUNT }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-48 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  return (
    <section className="py-10 md:py-14" data-testid="section-products">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold" data-testid="text-products-title">
              Melhores Ofertas
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {total} produtos selecionados com os maiores descontos
            </p>
          </div>
          <Link href="/catalogo">
            <Button variant="outline" size="sm" data-testid="link-ver-todos">
              Ver todos <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.slice(0, SHOW_COUNT).map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.mainName}
              brand={product.brand?.name || ""}
              price={product.bestOffer ? parseFloat(product.bestOffer.currentPrice) : 0}
              oldPrice={product.bestOffer?.originalPrice ? parseFloat(product.bestOffer.originalPrice) : undefined}
              discount={product.bestOffer?.discountPercent || undefined}
              image={product.mainImageUrl || ""}
              category={product.category?.name || ""}
              affiliateUrl={product.bestOffer?.affiliateUrl || "#"}
              freeShipping={product.bestOffer?.freeShipping || false}
              lastSeenAt={product.bestOffer?.lastSeenAt}
            />
          ))}
        </div>

        {total > SHOW_COUNT && (
          <div className="text-center mt-8">
            <Link href="/catalogo">
              <Button variant="outline" data-testid="button-ver-mais-produtos">
                Ver mais {total - SHOW_COUNT} ofertas <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
