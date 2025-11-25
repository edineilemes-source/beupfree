import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SortDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]" data-testid="select-sort">
        <SelectValue placeholder="Ordenar por" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="relevancia" data-testid="sort-relevancia">Relevância</SelectItem>
        <SelectItem value="menor-preco" data-testid="sort-menor-preco">Menor Preço</SelectItem>
        <SelectItem value="maior-preco" data-testid="sort-maior-preco">Maior Preço</SelectItem>
        <SelectItem value="maior-desconto" data-testid="sort-maior-desconto">Maior Desconto</SelectItem>
        <SelectItem value="mais-vendidos" data-testid="sort-mais-vendidos">Mais Vendidos</SelectItem>
        <SelectItem value="melhor-avaliados" data-testid="sort-melhor-avaliados">Melhor Avaliados</SelectItem>
        <SelectItem value="lancamentos" data-testid="sort-lancamentos">Lançamentos</SelectItem>
      </SelectContent>
    </Select>
  );
}
