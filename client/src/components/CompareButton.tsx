import { GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";
import { useComparison } from "@/context/ComparisonContext";
import type { ComparableProduct } from "@/types/comparison";

interface CompareButtonProps {
  product: ComparableProduct;
  className?: string;
}

export default function CompareButton({ product, className }: CompareButtonProps) {
  const { addToComparison, isCompared, removeFromComparison } = useComparison();
  const productId = product.product.id;
  const active = isCompared(productId);
  const label = active ? "Remover da comparação" : "Comparar";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();

        if (active) {
          removeFromComparison(productId);
          return;
        }

        const result = addToComparison(product);
        if (result.status === "limit_reached") {
          // Ponto de integração futuro: exibir toast informando o limite.
        }
      }}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/95 text-foreground shadow-sm transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active && "border-primary bg-primary text-primary-foreground hover:bg-primary",
        className,
      )}
      data-testid={`button-compare-${productId}`}
    >
      <GitCompareArrows className="h-5 w-5" />
    </button>
  );
}
