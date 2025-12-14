import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Flame } from "lucide-react";
import { Link } from "wouter";

interface ProductImage {
  id: string;
  url: string;
  alt: string | null;
  isPrimary: boolean;
}

interface Brand {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  compareAtPrice: string | null;
  images: ProductImage[];
  brand: Brand | null;
  category: Category | null;
  discount: number;
  formattedPrice: string;
  formattedOriginalPrice: string | null;
}

interface ProductsResponse {
  total: number;
  products: Product[];
}

function PromotionCard({ product }: { product: Product }) {
  const price = parseFloat(product.price);
  const originalPrice = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
  const imageUrl = product.images[0]?.url || "https://via.placeholder.com/300x200?text=Sem+Imagem";

  return (
    <Card className="flex-shrink-0 w-[200px] md:w-[240px] overflow-hidden hover-elevate" data-testid={`promo-card-${product.id}`}>
      <div className="relative">
        <img src={imageUrl} alt={product.name} className="w-full h-32 object-cover" />
        {product.discount > 0 && (
          <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground">
            -{product.discount}%
          </Badge>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-muted-foreground">{product.brand?.name || "Marca"}</p>
        <h4 className="font-medium text-sm line-clamp-2 mb-2">{product.name}</h4>
        <div className="flex items-center gap-2 mb-2">
          {originalPrice && (
            <span className="text-xs text-muted-foreground line-through">
              R$ {originalPrice.toFixed(2).replace('.', ',')}
            </span>
          )}
          <span className="text-primary font-bold">
            R$ {price.toFixed(2).replace('.', ',')}
          </span>
        </div>
        <div className="flex items-center justify-end">
          <Link href={`/catalogo?produto=${product.id}`}>
            <Button size="sm" variant="secondary" data-testid={`button-view-${product.id}`}>Ver</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function TodayPromotions() {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ['/api/products'],
  });

  const products = data?.products?.filter(p => p.discount > 0) || [];

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 260;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const today = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  if (isLoading) {
    return (
      <section className="py-8 bg-muted/30" data-testid="today-promotions">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Flame className="h-6 w-6 text-destructive" />
                Promoções de Hoje
              </h3>
              <p className="text-sm text-muted-foreground capitalize">{today}</p>
            </div>
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-shrink-0 w-[240px]">
                <Skeleton className="h-32 w-full rounded-t-lg" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-6 w-20" />
                </div>
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
    <section className="py-8 bg-muted/30" data-testid="today-promotions">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Flame className="h-6 w-6 text-destructive" />
              Promoções de Hoje
            </h3>
            <p className="text-sm text-muted-foreground capitalize">{today}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid="button-expand-today"
          >
            {isExpanded ? (
              <>Recolher <ChevronUp className="ml-1 h-4 w-4" /></>
            ) : (
              <>Ver Todas <ChevronDown className="ml-1 h-4 w-4" /></>
            )}
          </Button>
        </div>

        {isExpanded ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden hover-elevate">
                <div className="relative">
                  <img 
                    src={product.images[0]?.url || "https://via.placeholder.com/300x200"} 
                    alt={product.name} 
                    className="w-full h-32 object-cover" 
                  />
                  {product.discount > 0 && (
                    <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground">
                      -{product.discount}%
                    </Badge>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs text-muted-foreground">{product.brand?.name}</p>
                  <h4 className="font-medium text-sm line-clamp-2 mb-2">{product.name}</h4>
                  <div className="flex flex-col gap-1 mb-2">
                    {product.formattedOriginalPrice && (
                      <span className="text-xs text-muted-foreground line-through">
                        {product.formattedOriginalPrice}
                      </span>
                    )}
                    <span className="text-primary font-bold">
                      {product.formattedPrice}
                    </span>
                  </div>
                  <div className="flex items-center justify-end">
                    <Link href={`/catalogo?produto=${product.id}`}>
                      <Button size="sm" variant="secondary">Ver</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background border shadow-md flex items-center justify-center hover-elevate"
              data-testid="today-scroll-left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide px-8"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {products.map((product) => (
                <PromotionCard key={product.id} product={product} />
              ))}
            </div>

            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background border shadow-md flex items-center justify-center hover-elevate"
              data-testid="today-scroll-right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
