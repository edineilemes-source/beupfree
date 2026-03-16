import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Grid2X2, Grid3X3, Loader2, Package } from "lucide-react";
import { Card } from "@/components/ui/card";

interface BestOffer {
  id: string;
  currentPrice: string;
  originalPrice: string | null;
  discountPercent: number | null;
  affiliateUrl: string;
  freeShipping: boolean;
  formattedPrice: string;
  formattedOriginalPrice: string | null;
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

export default function Catalog() {
  const [gridSize, setGridSize] = useState<"small" | "large">("large");

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["/api/products"],
  });

  const products = data?.products || [];
  const total = data?.total || 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-catalog-title">
              Ofertas Selecionadas
            </h1>
            <p className="text-muted-foreground" data-testid="text-catalog-count">
              {total} {total === 1 ? "produto encontrado" : "produtos encontrados"}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={gridSize === "large" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setGridSize("large")}
                data-testid="button-grid-large"
              >
                <Grid2X2 className="h-4 w-4" />
              </Button>
              <Button
                variant={gridSize === "small" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setGridSize("small")}
                data-testid="button-grid-small"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <Card className="overflow-visible p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2" data-testid="text-empty-catalog">
              Nenhum produto disponível ainda
            </h2>
            <p className="text-muted-foreground">
              Nosso catálogo está sendo atualizado. Volte em breve para conferir as melhores ofertas!
            </p>
          </Card>
        ) : (
          <div
            className={`grid gap-6 ${
              gridSize === "large"
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
            }`}
          >
            {products.map((product) => (
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
        )}
      </main>

      <Footer />
    </div>
  );
}