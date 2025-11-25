import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ExternalLink } from "lucide-react";
import { useState } from "react";

interface ProductCardProps {
  id: number;
  name: string;
  brand: string;
  price: number;
  oldPrice?: number;
  image: string;
  category: string;
  mercadoLivreUrl?: string;
}

export default function ProductCard({
  id,
  name,
  brand,
  price,
  oldPrice,
  image,
  category,
  mercadoLivreUrl = "#"
}: ProductCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const discount = oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

  return (
    <Card 
      className="hover-elevate overflow-hidden group"
      data-testid={`card-product-${id}`}
    >
      <CardContent className="p-0">
        <div className="relative aspect-square overflow-hidden bg-card">
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            data-testid={`img-product-${id}`}
          />
          
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="font-semibold" data-testid={`badge-brand-${id}`}>
              {brand}
            </Badge>
          </div>
          
          {discount > 0 && (
            <div className="absolute top-2 right-2">
              <Badge variant="destructive" data-testid={`badge-discount-${id}`}>
                -{discount}%
              </Badge>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className={`absolute bottom-2 right-2 bg-white/90 hover:bg-white ${
              isFavorite ? "text-destructive" : ""
            }`}
            onClick={() => setIsFavorite(!isFavorite)}
            data-testid={`button-favorite-${id}`}
          >
            <Heart className={`h-5 w-5 ${isFavorite ? "fill-current" : ""}`} />
          </Button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <Badge variant="outline" className="mb-2 text-xs" data-testid={`badge-category-${id}`}>
              {category}
            </Badge>
            <h3 className="font-semibold text-base line-clamp-2 min-h-[3rem]" data-testid={`text-product-name-${id}`}>
              {name}
            </h3>
          </div>

          <div className="space-y-1">
            {oldPrice && (
              <p className="text-sm text-muted-foreground line-through" data-testid={`text-old-price-${id}`}>
                R$ {oldPrice.toFixed(2)}
              </p>
            )}
            <p className="text-2xl font-bold" data-testid={`text-price-${id}`}>
              R$ {price.toFixed(2)}
            </p>
          </div>

          <Button 
            className="w-full gap-2" 
            variant="default"
            onClick={() => window.open(mercadoLivreUrl, '_blank')}
            data-testid={`button-buy-${id}`}
          >
            <ExternalLink className="h-4 w-4" />
            Ver no Mercado Livre
          </Button>
          
          <p className="text-xs text-center text-muted-foreground" data-testid={`text-ml-badge-${id}`}>
            Parceiro Oficial Mercado Livre
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
