import { ExternalLink, Heart, PackageX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FavoriteProduct, FavoriteReference } from "@/types/favorites";
import ProductBadges from "@/components/ProductBadges";
import { getProductBadges } from "@/lib/productBadges";
import { requestDemoProductNotice } from "@/components/DemoProductDialog";
import {
  DEMO_PRODUCT_LABEL,
  PUBLIC_DEMO_MODE,
  publicOfferSource,
} from "@/lib/publicDemo";

interface FavoriteItemProps {
  favorite: FavoriteReference;
  product?: FavoriteProduct;
  onRemove: () => void;
}

function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function FavoriteItem({
  favorite,
  product,
  onRemove,
}: FavoriteItemProps) {
  if (!product) {
    return (
      <article className="rounded-lg border border-border p-4" data-testid={`favorite-missing-${favorite.productId}`}>
        <div className="flex items-start gap-3">
          <PackageX className="mt-0.5 h-5 w-5 flex-none text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Produto indisponível</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Este produto não está disponível no catálogo carregado.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remover produto indisponível dos Favoritos"
            onClick={onRemove}
            data-testid={`button-remove-favorite-${favorite.productId}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </article>
    );
  }

  const badges = getProductBadges(product);
  const offerSource = publicOfferSource(product.marketplaceName, product.sellerName);
  const ratingText = product.averageRating != null && product.averageRating > 0
    ? `⭐ ${product.averageRating.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${product.totalReviews ? ` (${product.totalReviews.toLocaleString("pt-BR")})` : ""}`
    : "";

  return (
    <article className="relative rounded-lg border border-border p-3" data-testid={`favorite-item-${product.id}`}>
      {PUBLIC_DEMO_MODE && (
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-primary">
          {DEMO_PRODUCT_LABEL}
        </p>
      )}
      {product.discount > 0 && (
        <span className="absolute left-3 top-3 z-10 text-xs font-extrabold text-red-600">
          -{product.discount}%
        </span>
      )}
      <Heart className="absolute right-3 top-3 z-10 h-4 w-4 fill-current text-red-600" aria-hidden="true" />
      <div className="flex gap-3">
        <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-md bg-white">
          {product.image ? (
            <img src={product.image} alt="" className="h-full w-full object-contain" />
          ) : (
            <PackageX className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1 pr-5">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {product.brand}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
            {product.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-bold">{formatPrice(product.price)}</span>
            {product.oldPrice && product.oldPrice > product.price && (
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(product.oldPrice)}
              </span>
            )}
          </div>
          {product.freeShipping && (
            <p className="mt-2 text-xs font-semibold text-emerald-700">🚚 Frete grátis</p>
          )}
          {offerSource && (
            <p className="mt-1 truncate text-xs text-muted-foreground" title={offerSource}>
              {offerSource}
            </p>
          )}
          {ratingText && <p className="mt-1 text-xs font-medium">{ratingText}</p>}
          <ProductBadges badges={badges} productId={product.id} className="mt-2" />
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1 gap-2"
          disabled={!PUBLIC_DEMO_MODE && (product.soldOut || !product.affiliateUrl || product.affiliateUrl === "#")}
          onClick={() => {
            if (PUBLIC_DEMO_MODE) requestDemoProductNotice(product.referenceUrl);
            else window.open(product.affiliateUrl, "_blank", "noopener,noreferrer");
          }}
          data-testid={`button-favorite-offer-${product.id}`}
        >
          <ExternalLink className="h-4 w-4" />
          {PUBLIC_DEMO_MODE ? "Ver referência" : "Ver oferta"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={`Remover ${product.name} dos Favoritos`}
          onClick={onRemove}
          data-testid={`button-remove-favorite-${product.id}`}
        >
          <Trash2 className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Remover</span>
        </Button>
      </div>
    </article>
  );
}
