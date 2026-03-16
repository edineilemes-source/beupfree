import { useQuery } from "@tanstack/react-query";
import ProductCard from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

interface BestOffer {
  id: string;
  currentPrice: string;
  originalPrice: string | null;
  discountPercent: number | null;
  affiliateUrl: string;
  freeShipping: boolean;
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

export default function ProductGrid() {
  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ['/api/products'],
  });

  const products = data?.products || [];

  if (isLoading) {
    return (
      <section className="py-12 md:py-16 bg-card/30" data-testid="section-products">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-products-title">
              Produtos em Destaque
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
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
    <section className="py-12 md:py-16 bg-card/30" data-testid="section-products">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-products-title">
            Produtos em Destaque
          </h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {products.slice(0, 8).map((product) => (
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
            />
          ))}
        </div>
      </div>
    </section>
  );
}