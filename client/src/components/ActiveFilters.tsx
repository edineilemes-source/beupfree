import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface ActiveFilter {
  category: string;
  value: string;
  label: string;
}

interface ActiveFiltersProps {
  filters: ActiveFilter[];
  onRemove: (category: string, value: string) => void;
  onClearAll: () => void;
}

export default function ActiveFilters({ filters, onRemove, onClearAll }: ActiveFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap py-4" data-testid="active-filters">
      <span className="text-sm font-medium text-muted-foreground">Filtros ativos:</span>
      {filters.map((filter, index) => (
        <Badge
          key={`${filter.category}-${filter.value}-${index}`}
          variant="secondary"
          className="gap-1 pr-1"
          data-testid={`active-filter-${filter.category}-${filter.value}`}
        >
          {filter.label}
          <button
            className="ml-1 rounded-full p-0.5 hover:bg-foreground/10"
            onClick={() => onRemove(filter.category, filter.value)}
            data-testid={`remove-filter-${filter.category}-${filter.value}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <button
        className="text-sm text-primary hover:underline"
        onClick={onClearAll}
        data-testid="button-clear-all-filters"
      >
        Limpar tudo
      </button>
    </div>
  );
}
