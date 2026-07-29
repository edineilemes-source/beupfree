import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, PackageX } from "lucide-react";
import FavoriteButton from "@/components/FavoriteButton";
import CompareButton from "@/components/CompareButton";
import ProductBadges from "@/components/ProductBadges";
import { getProductBadges } from "@/lib/productBadges";
import { toFavoriteProduct } from "@/lib/favoriteProductAdapter";
import { toComparableProduct } from "@/lib/comparisonProductAdapter";

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
  marketplaceName?: string;
  sellerName?: string;
  freeShipping?: boolean;
  averageRating?: number | null;
  totalReviews?: number;
  promotionType?: string;
  lastSeenAt?: Date | string;
  soldOut?: boolean;
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
  marketplaceName,
  sellerName,
  freeShipping,
  averageRating,
  totalReviews,
  promotionType,
  lastSeenAt,
  soldOut = false,
}: ProductCardProps) {
  const favoriteProduct = toFavoriteProduct({
    id,
    name,
    brand,
    price,
    oldPrice,
    discount,
    image,
    category,
    affiliateUrl,
    marketplaceName,
    sellerName,
    freeShipping,
    averageRating,
    totalReviews,
    promotionType,
    soldOut,
  });
  const comparableProduct = toComparableProduct({
    id,
    name,
    image,
    brand,
    category,
    price,
    oldPrice,
    discount,
    affiliateUrl,
    marketplaceName,
    sellerName,
    freeShipping,
    averageRating,
    totalReviews,
    soldOut,
  });
  const safePrice = favoriteProduct.price;
  const safeOldPrice = favoriteProduct.oldPrice;
  const computedDiscount = favoriteProduct.discount;
  const badges = getProductBadges({
    discount: computedDiscount,
    freeShipping,
    averageRating,
    totalReviews,
    promotionType,
  });

  const getTimeAgoText = (date: Date | string | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const minAgo = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (minAgo < 1) return "agora";
    if (minAgo < 60) return `${minAgo}min atrás`;
    const hoursAgo = Math.floor(minAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h atrás`;
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const timeAgo = getTimeAgoText(lastSeenAt);
  const offerSource = [marketplaceName?.trim(), sellerName?.trim()].filter(Boolean).join(" · ");
  const ratingText = averageRating != null && averageRating > 0
    ? `⭐ ${averageRating.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${totalReviews ? ` (${totalReviews.toLocaleString("pt-BR")})` : ""}`
    : "";

  return (
    <Card
      className="flex flex-col overflow-hidden bg-white transition-shadow hover:shadow-sm dark:bg-card"
      data-testid={`card-product-${id}`}
    >
      {/* Image area */}
      <div className={`relative bg-white p-5 dark:bg-card ${soldOut ? "opacity-60" : ""}`}>
        {soldOut && (
          <div className="absolute left-3 top-3 z-10">
            <Badge
              variant="outline"
              className="bg-background/80 text-muted-foreground backdrop-blur-sm"
              data-testid={`badge-soldout-${id}`}
            >
              <PackageX className="mr-1 h-3 w-3" />
              Esgotado
            </Badge>
          </div>
        )}

        {!soldOut && computedDiscount > 0 && (
          <span
            className="absolute left-3 top-3 z-10 text-sm font-extrabold text-red-600"
            data-testid={`text-discount-${id}`}
          >
            -{computedDiscount}%
          </span>
        )}

        <FavoriteButton
          product={favoriteProduct}
          className="absolute right-3 top-3 z-20"
        />
        <CompareButton
          product={comparableProduct}
          className="absolute right-3 top-14 z-20"
        />

        <img
          src={image}
          alt={name}
          className={`mx-auto h-44 w-full object-contain ${soldOut ? "grayscale" : ""}`}
          data-testid={`img-product-${id}`}
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          data-testid={`text-brand-${id}`}
        >
          {brand}
        </span>
        <h3
          className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug"
          data-testid={`text-product-name-${id}`}
        >
          {name}
        </h3>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <p className="text-lg font-bold" data-testid={`text-price-${id}`}>
            R$ {safePrice.toFixed(2)}
          </p>
          {safeOldPrice && safeOldPrice > safePrice && (
            <p className="text-xs text-muted-foreground line-through" data-testid={`text-old-price-${id}`}>
              R$ {safeOldPrice.toFixed(2)}
            </p>
          )}
        </div>

        {freeShipping && (
          <p className="mt-2 text-xs font-semibold text-emerald-700">🚚 Frete grátis</p>
        )}
        {offerSource && (
          <p
            className="mt-1 truncate text-xs text-muted-foreground"
            data-testid={`text-offer-source-${id}`}
            title={offerSource}
          >
            {offerSource}
          </p>
        )}
        {ratingText && (
          <p className="mt-1 text-xs font-medium" data-testid={`text-rating-${id}`}>
            {ratingText}
          </p>
        )}

        <ProductBadges badges={badges} productId={id} className="mt-2" />

        <Button
          className="mt-3 w-full gap-2"
          variant={soldOut ? "outline" : "default"}
          disabled={soldOut}
          onClick={soldOut ? undefined : () => window.open(affiliateUrl, "_blank")}
          data-testid={`button-buy-${id}`}
        >
          {soldOut ? (
            <>
              <PackageX className="h-4 w-4" />
              Oferta Encerrada
            </>
          ) : (
            <>
              <ExternalLink className="h-4 w-4" />
              Ver oferta
            </>
          )}
        </Button>

        <p className="mt-2 text-center text-[10px] text-muted-foreground" data-testid={`text-updated-${id}`}>
          {timeAgo ? `Atualizado ${timeAgo}` : ""}
        </p>
      </div>
    </Card>
  );
}
