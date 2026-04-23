import { Badge } from "@/components/ui/badge";
import { Sun } from "lucide-react";
import PaginatedDealSection from "./PaginatedDealSection";

export default function DealOfTheDay() {
  return (
    <PaginatedDealSection
      endpoint="/api/sections/oferta-do-dia"
      title="Oferta do Dia"
      icon={<Sun className="w-6 h-6 text-amber-600" />}
      badge={<Badge className="bg-amber-500 text-white border-amber-600">Hoje</Badge>}
      sectionClassName="bg-amber-50 dark:bg-amber-950/20"
      emptyMessage="Nenhuma oferta do dia disponível no momento."
      testIdPrefix="deal-of-day"
    />
  );
}
