import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Truck } from "lucide-react";

interface ProductCardProps {
  id: string;
  name: string;
  brand: string;
  price: number;
  oldPrice?: number;
  discount?: number;
  image: string;
  category: string;
  affiliateUrl: string;
  freeShipping?: boolean;
  lastSeenAt?: Date | string;
}

export default function ProductCard({
  id,
  name,
  brand,
  price,
  oldPrice,
  discount,
  image,
  category,
  affiliateUrl,
  freeShipping,
  lastSeenAt,
}: ProductCardProps) {
  const computedDiscount = discount || (oldPrice ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0);

  const getTimeAgoText = (date: Date | string | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const minAgo = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (minAgo < 1) return "agora";
    if (minAgo < 60) return `${minAgo}min atrás`;
    const hoursAgo = Math.floor(minAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h atrás`;
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

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
          
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <Badge variant="secondary" className="font-semibold" data-testid={`badge-brand-${id}`}>
              {brand}
            </Badge>
            {freeShipping && (
              <Badge variant="default" className="bg-green-600" data-testid={`badge-shipping-${id}`}>
                <Truck className="w-3 h-3 mr-1" />
                Frete Grátis
              </Badge>
            )}
          </div>
          
          {computedDiscount > 0 && (
            <div className="absolute top-2 right-2">
              <Badge variant="destructive" data-testid={`badge-discount-${id}`}>
                -{computedDiscount}%
              </Badge>
            </div>
          )}
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
            {oldPrice && oldPrice > price && (
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
            onClick={() => window.open(affiliateUrl, '_blank')}
            data-testid={`button-buy-${id}`}
          >
            <ExternalLink className="h-4 w-4" />
            Ver no Mercado Livre
          </Button>

          <p className="text-xs text-center text-muted-foreground" data-testid={`text-updated-${id}`}>
            Atualizado {getTimeAgoText(lastSeenAt)}
          </p>
          
          <p className="text-xs text-center text-muted-foreground" data-testid={`text-ml-badge-${id}`}>
            Parceiro Oficial Mercado Livre
          </p>
        </div>
      </CardContent>
    </Card>
  );
}