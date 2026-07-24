import { ExternalLink, PackageX, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FavoriteProduct, FavoriteReference } from "@/types/favorites";

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

  return (
    <article className="rounded-lg border border-border p-3" data-testid={`favorite-item-${product.id}`}>
      <div className="flex gap-3">
        <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-md bg-white">
          {product.image ? (
            <img src={product.image} alt="" className="h-full w-full object-contain" />
          ) : (
            <PackageX className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {product.brand}
          </p>
          <h3 className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
            {product.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-bold">{formatPrice(product.price)}</span>
            {product.discount > 0 && (
              <span className="rounded-sm bg-destructive px-1.5 py-0.5 text-xs font-bold text-destructive-foreground">
                -{product.discount}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1 gap-2"
          disabled={product.soldOut || !product.affiliateUrl || product.affiliateUrl === "#"}
          onClick={() => window.open(product.affiliateUrl, "_blank", "noopener,noreferrer")}
          data-testid={`button-favorite-offer-${product.id}`}
        >
          <ExternalLink className="h-4 w-4" />
          Ver oferta
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
