import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Heart } from "lucide-react";
import FavoriteItem from "@/components/FavoriteItem";
import { useFavorites } from "@/context/FavoritesContext";

interface FavoritesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FavoritesDrawer({
  open,
  onOpenChange,
}: FavoritesDrawerProps) {
  const { favorites, productsById, removeFavorite } = useFavorites();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[92vw] flex-col p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-5 pr-14 text-left">
          <SheetTitle>Favoritos</SheetTitle>
          <SheetDescription>
            {favorites.length === 1
              ? "1 produto salvo"
              : `${favorites.length} produtos salvos`}
          </SheetDescription>
        </SheetHeader>

        {favorites.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <Heart className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">Você ainda não salvou nenhum produto.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Use o coração nos cards para guardar produtos de interesse.
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {[...favorites].reverse().map((favorite) => (
              <FavoriteItem
                key={favorite.productId}
                favorite={favorite}
                product={productsById.get(favorite.productId)}
                onRemove={() => removeFavorite(favorite.productId)}
              />
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
