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
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

interface FavoritesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FavoritesDrawer({
  open,
  onOpenChange,
}: FavoritesDrawerProps) {
  const { favorites, productsById, removeFavorite, syncError, isSyncing } = useFavorites();
  const { isAuthenticated } = useAuth();

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

        {favorites.length > 0 && (
          <div className="border-b border-border px-5 py-3 text-sm" data-testid="favorites-storage-message">
            {isAuthenticated ? (
              <p className="text-muted-foreground">Favoritos salvos na sua conta.</p>
            ) : (
              <div>
                <p className="font-medium">Salvos neste dispositivo</p>
                <p className="mt-1 text-muted-foreground">Crie uma conta para acessar seus Favoritos em qualquer dispositivo.</p>
                <Button type="button" variant="ghost" className="h-auto p-0 underline underline-offset-4" onClick={() => window.dispatchEvent(new Event("beupfree:open-auth-register"))}>
                  Criar conta
                </Button>
              </div>
            )}
            {isSyncing && <p className="mt-1 text-xs text-muted-foreground">Sincronizando...</p>}
            {syncError && <p role="status" className="mt-1 text-xs text-destructive">{syncError}</p>}
          </div>
        )}

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
            {favorites.map((favorite) => (
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
