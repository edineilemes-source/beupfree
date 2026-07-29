import { Heart } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useFavorites } from "@/context/FavoritesContext";
import type { FavoriteProduct } from "@/types/favorites";

interface FavoriteButtonProps {
  product: FavoriteProduct;
  className?: string;
}

export default function FavoriteButton({ product, className }: FavoriteButtonProps) {
  const { isFavorite, registerProducts, toggleFavorite } = useFavorites();
  const active = isFavorite(product.id);
  const label = active ? "Remover dos Favoritos" : "Adicionar aos Favoritos";
  const productSignature = JSON.stringify(product);

  useEffect(() => {
    registerProducts([product]);
  }, [productSignature, registerProducts]);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleFavorite(product.id);
      }}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-sm transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active && "text-red-600",
        className,
      )}
      data-testid={`button-favorite-${product.id}`}
    >
      <Heart className="h-5 w-5" fill={active ? "currentColor" : "none"} />
    </button>
  );
}
