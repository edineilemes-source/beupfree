import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import PaginatedDealSection from "./PaginatedDealSection";

export default function LightningDeals() {
  return (
    <PaginatedDealSection
      endpoint="/api/sections/oferta-relampago"
      title="Oferta Relâmpago"
      icon={<Zap className="w-6 h-6 text-red-600" />}
      badge={<Badge variant="destructive">⚡ Urgente</Badge>}
      sectionClassName="bg-red-50 dark:bg-red-950/20"
      emptyMessage="Nenhuma oferta relâmpago disponível no momento."
      testIdPrefix="lightning"
    />
  );
}
