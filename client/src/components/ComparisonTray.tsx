import { memo } from "react";
import { PackageX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useComparison } from "@/context/ComparisonContext";
import type { ComparableProduct } from "@/types/comparison";

interface ComparisonTrayItemProps {
  item: ComparableProduct;
  onRemove: (productId: string) => void;
}

const ComparisonTrayItem = memo(function ComparisonTrayItem({
  item,
  onRemove,
}: ComparisonTrayItemProps) {
  const { id, imageUrl, title } = item.product;

  return (
    <article
      className="flex min-w-0 flex-none items-center gap-2 rounded-md border border-border bg-background p-2 md:w-48"
      data-testid={`comparison-tray-item-${id}`}
    >
      <div className="flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded bg-white">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          <PackageX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <p className="max-w-32 flex-1 truncate text-xs font-medium" title={title}>
        {title}
      </p>
      <button
        type="button"
        aria-label={`Remover ${title} da comparação`}
        title={`Remover ${title} da comparação`}
        onClick={() => onRemove(id)}
        className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        data-testid={`button-remove-comparison-${id}`}
      >
        <X className="h-4 w-4" />
      </button>
    </article>
  );
});

export default function ComparisonTray() {
  const {
    items,
    comparisonCount,
    maxItems,
    clearComparison,
    removeFromComparison,
  } = useComparison();

  if (comparisonCount === 0) return null;

  return (
    <>
      <div className="h-40 md:h-28" aria-hidden="true" />
      <section
        aria-label="Produtos em comparação"
        className="fixed inset-x-0 bottom-0 z-40 animate-in border-t border-border bg-background/95 shadow-xl backdrop-blur-sm duration-200 slide-in-from-bottom-2"
        data-testid="comparison-tray"
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
          <p className="flex-none text-sm font-semibold" data-testid="comparison-tray-count">
            Comparando {comparisonCount} de {maxItems} produtos
          </p>

          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 md:pb-0">
            {items.map((item) => (
              <ComparisonTrayItem
                key={item.product.id}
                item={item}
                onRemove={removeFromComparison}
              />
            ))}
          </div>

          <div className="flex flex-none gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={clearComparison}
              aria-label="Limpar comparação"
              title="Limpar comparação"
              data-testid="button-clear-comparison"
            >
              Limpar
            </Button>
            <Button
              type="button"
              disabled={comparisonCount < 2}
              onClick={() => {
                // Ponto de integração futuro: navegar para a página de comparação.
              }}
              aria-label="Comparar produtos selecionados"
              title={comparisonCount < 2
                ? "Selecione pelo menos 2 produtos para comparar"
                : "Comparar produtos selecionados"}
              data-testid="button-open-comparison"
            >
              Comparar Produtos
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
