import { useQuery } from "@tanstack/react-query";
import ProductCard from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";

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
  logo: string | null;
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
  isFeatured: boolean;
  affiliateUrl: string | null;
}

function generateMercadoLivreUrl(productName: string, brand?: string): string {
  const searchQuery = brand ? `${productName} ${brand}` : productName;
  const baseUrl = `https://lista.mercadolivre.com.br/${encodeURIComponent(searchQuery).replace(/%20/g, '-')}`;
  return `${baseUrl}?matt_tool=14610626&matt_word=&matt_source=google&matt_campaign_id=14610626`;
}

interface ProductsResponse {
  total: number;
  products: Product[];
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

  return (
    <section className="py-12 md:py-16 bg-card/30" data-testid="section-products">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <h2 className="text-3xl md:text-4xl font-bold" data-testid="text-products-title">
            Produtos em Destaque
          </h2>
          <a 
            href="/catalogo" 
            className="text-primary font-semibold hover:underline"
            data-testid="link-view-all"
          >
            Ver todos os produtos
          </a>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
          {products.slice(0, 8).map((product) => (
            <ProductCard 
              key={product.id}
              id={product.id}
              name={product.name}
              brand={product.brand?.name || ""}
              price={parseFloat(product.price)}
              oldPrice={product.compareAtPrice ? parseFloat(product.compareAtPrice) : undefined}
              image={product.images[0]?.url || "https://via.placeholder.com/300x300?text=Sem+Imagem"}
              category={product.category?.name || ""}
              mercadoLivreUrl={product.affiliateUrl || generateMercadoLivreUrl(product.name, product.brand?.name)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
