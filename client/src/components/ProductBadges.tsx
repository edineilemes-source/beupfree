import { Badge } from "@/components/ui/badge";
import type { ProductBadge } from "@/lib/productBadges";
import { cn } from "@/lib/utils";

const BADGE_STYLES: Record<ProductBadge["kind"], string> = {
  "lightning-offer": "bg-red-600 text-white",
  "highly-rated": "bg-amber-500 text-black",
  "most-reviewed": "bg-blue-600 text-white",
};

interface ProductBadgesProps {
  badges: ProductBadge[];
  className?: string;
  productId?: string;
}

export default function ProductBadges({ badges, className, productId }: ProductBadgesProps) {
  if (badges.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {badges.map((badge) => (
        <Badge
          key={badge.kind}
          className={cn("border-0 text-[10px]", BADGE_STYLES[badge.kind])}
          data-testid={productId ? `badge-${badge.kind}-${productId}` : undefined}
        >
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}
