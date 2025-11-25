import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { X, Filter, Star } from "lucide-react";

interface FilterState {
  genero: string[];
  faixaEtaria: string[];
  larguraPe: string[];
  categoria: string[];
  modalidade: string[];
  tipoUso: string[];
  terreno: string[];
  numeracao: number[];
  ajuste: string[];
  marca: string[];
  pisada: string[];
  amortecimento: string[];
  suporte: string[];
  drop: string[];
  peso: string[];
  flexibilidade: string[];
  solado: string[];
  cabedal: string[];
  ventilacao: string[];
  alturaCano: string[];
  corPrincipal: string[];
  estiloVisual: string[];
  publicoImagem: string[];
  avaliacao: number;
  popularidade: string[];
  precoMin: number;
  precoMax: number;
  desconto: string[];
  condicoes: string[];
  origem: string[];
  prazoEntrega: string[];
  tipoProdutoMeias: string[];
  compressao: string[];
  alturaMeia: string[];
  tamanhoMeia: string[];
  finalidade: string[];
  parteCorpo: string[];
  disponibilidade: string[];
}

const initialFilters: FilterState = {
  genero: [],
  faixaEtaria: [],
  larguraPe: [],
  categoria: [],
  modalidade: [],
  tipoUso: [],
  terreno: [],
  numeracao: [33, 48],
  ajuste: [],
  marca: [],
  pisada: [],
  amortecimento: [],
  suporte: [],
  drop: [],
  peso: [],
  flexibilidade: [],
  solado: [],
  cabedal: [],
  ventilacao: [],
  alturaCano: [],
  corPrincipal: [],
  estiloVisual: [],
  publicoImagem: [],
  avaliacao: 0,
  popularidade: [],
  precoMin: 0,
  precoMax: 2000,
  desconto: [],
  condicoes: [],
  origem: [],
  prazoEntrega: [],
  tipoProdutoMeias: [],
  compressao: [],
  alturaMeia: [],
  tamanhoMeia: [],
  finalidade: [],
  parteCorpo: [],
  disponibilidade: [],
};

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FilterSidebar({ isOpen, onClose }: FilterSidebarProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [priceRange, setPriceRange] = useState([0, 2000]);

  const toggleFilter = (category: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const current = prev[category] as string[];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [category]: updated };
    });
  };

  const clearAllFilters = () => {
    setFilters(initialFilters);
    setPriceRange([0, 2000]);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        if (key !== "numeracao") count += value.length;
      } else if (key === "avaliacao" && value > 0) {
        count++;
      }
    });
    if (priceRange[0] > 0 || priceRange[1] < 2000) count++;
    return count;
  };

  const FilterCheckbox = ({
    category,
    value,
    label,
  }: {
    category: keyof FilterState;
    value: string;
    label: string;
  }) => (
    <div className="flex items-center space-x-2">
      <Checkbox
        id={`${category}-${value}`}
        checked={(filters[category] as string[]).includes(value)}
        onCheckedChange={() => toggleFilter(category, value)}
        data-testid={`checkbox-${category}-${value}`}
      />
      <Label
        htmlFor={`${category}-${value}`}
        className="text-sm font-normal cursor-pointer"
      >
        {label}
      </Label>
    </div>
  );

  const ColorSwatch = ({ color, value }: { color: string; value: string }) => (
    <button
      className={`w-8 h-8 rounded-md border-2 ${
        (filters.corPrincipal as string[]).includes(value)
          ? "border-primary ring-2 ring-primary ring-offset-2"
          : "border-border"
      }`}
      style={{ backgroundColor: color }}
      onClick={() => toggleFilter("corPrincipal", value)}
      data-testid={`color-${value}`}
    />
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 h-full lg:h-auto lg:max-h-[calc(100vh-80px)] w-80 bg-background border-r lg:border lg:rounded-md z-50 lg:z-0 overflow-y-auto transition-transform ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
        data-testid="filter-sidebar"
      >
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <h2 className="font-semibold text-lg">Filtros</h2>
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="text-xs">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getActiveFiltersCount() > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                data-testid="button-clear-filters"
              >
                Limpar
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onClose}
              data-testid="button-close-filters"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-4">
          <Accordion type="multiple" defaultValue={["quem-vai-usar", "categoria", "marca", "preco"]} className="space-y-2">
            
            <AccordionItem value="quem-vai-usar" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm font-semibold py-3" data-testid="accordion-quem-vai-usar">
                Quem vai usar
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Gênero</p>
                  <div className="grid grid-cols-2 gap-2">
                    <FilterCheckbox category="genero" value="masculino" label="Masculino" />
                    <FilterCheckbox category="genero" value="feminino" label="Feminino" />
                    <FilterCheckbox category="genero" value="unissex" label="Unissex" />
                    <FilterCheckbox category="genero" value="infantil" label="Infantil" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Faixa Etária</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="faixaEtaria" value="adulto" label="Adulto" />
                    <FilterCheckbox category="faixaEtaria" value="juvenil" label="Juvenil" />
                    <FilterCheckbox category="faixaEtaria" value="infantil" label="Infantil" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Largura do Pé</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="larguraPe" value="padrao" label="Padrão" />
                    <FilterCheckbox category="larguraPe" value="larga" label="Larga" />
                    <FilterCheckbox category="larguraPe" value="extra-larga" label="Extra-larga" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="categoria" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm font-semibold py-3" data-testid="accordion-categoria">
                Uso e Modalidade
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Categoria</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="categoria" value="tenis" label="Tênis" />
                    <FilterCheckbox category="categoria" value="meias" label="Meias" />
                    <FilterCheckbox category="categoria" value="tornozeleiras" label="Tornozeleiras" />
                    <FilterCheckbox category="categoria" value="tensores" label="Tensores/Panturrilha" />
                    <FilterCheckbox category="categoria" value="acessorios" label="Outros Acessórios" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Modalidade Esportiva</p>
                  <div className="grid grid-cols-2 gap-2">
                    <FilterCheckbox category="modalidade" value="corrida" label="Corrida" />
                    <FilterCheckbox category="modalidade" value="caminhada" label="Caminhada" />
                    <FilterCheckbox category="modalidade" value="treino" label="Treino/Academia" />
                    <FilterCheckbox category="modalidade" value="casual" label="Casual" />
                    <FilterCheckbox category="modalidade" value="basquete" label="Basquete" />
                    <FilterCheckbox category="modalidade" value="futsal" label="Futsal" />
                    <FilterCheckbox category="modalidade" value="trilha" label="Trilha" />
                    <FilterCheckbox category="modalidade" value="crossfit" label="Crossfit" />
                    <FilterCheckbox category="modalidade" value="society" label="Society" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Tipo de Uso</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="tipoUso" value="treino-leve" label="Treino Leve" />
                    <FilterCheckbox category="tipoUso" value="treino-intenso" label="Treino Intenso" />
                    <FilterCheckbox category="tipoUso" value="competicao" label="Competição/Provas" />
                    <FilterCheckbox category="tipoUso" value="uso-diario" label="Uso Diário" />
                    <FilterCheckbox category="tipoUso" value="recuperacao" label="Recuperação/Saúde" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Tipo de Terreno</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="terreno" value="asfalto" label="Rua/Asfalto" />
                    <FilterCheckbox category="terreno" value="esteira" label="Esteira" />
                    <FilterCheckbox category="terreno" value="trilha" label="Trilha/Terra" />
                    <FilterCheckbox category="terreno" value="quadra-indoor" label="Quadra Indoor" />
                    <FilterCheckbox category="terreno" value="quadra-outdoor" label="Quadra Outdoor" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="numeracao" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm font-semibold py-3" data-testid="accordion-numeracao">
                Numeração e Ajuste
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Numeração (BR)</p>
                  <div className="flex flex-wrap gap-2">
                    {[33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48].map((num) => (
                      <Button
                        key={num}
                        variant={filters.numeracao.includes(num) ? "default" : "outline"}
                        size="sm"
                        className="w-10 h-8 text-xs"
                        onClick={() => {
                          setFilters((prev) => ({
                            ...prev,
                            numeracao: prev.numeracao.includes(num)
                              ? prev.numeracao.filter((n) => n !== num)
                              : [...prev.numeracao, num],
                          }));
                        }}
                        data-testid={`button-size-${num}`}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Ajuste</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="ajuste" value="cai-pequeno" label="Cai Pequeno" />
                    <FilterCheckbox category="ajuste" value="tamanho-exato" label="Tamanho Exato" />
                    <FilterCheckbox category="ajuste" value="cai-grande" label="Cai Grande" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="marca" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm font-semibold py-3" data-testid="accordion-marca">
                Marca
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pb-4">
                <div className="grid grid-cols-2 gap-2">
                  <FilterCheckbox category="marca" value="nike" label="Nike" />
                  <FilterCheckbox category="marca" value="adidas" label="Adidas" />
                  <FilterCheckbox category="marca" value="olympikus" label="Olympikus" />
                  <FilterCheckbox category="marca" value="mizuno" label="Mizuno" />
                  <FilterCheckbox category="marca" value="asics" label="Asics" />
                  <FilterCheckbox category="marca" value="puma" label="Puma" />
                  <FilterCheckbox category="marca" value="fila" label="Fila" />
                  <FilterCheckbox category="marca" value="skechers" label="Skechers" />
                  <FilterCheckbox category="marca" value="new-balance" label="New Balance" />
                  <FilterCheckbox category="marca" value="under-armour" label="Under Armour" />
                  <FilterCheckbox category="marca" value="reebok" label="Reebok" />
                  <FilterCheckbox category="marca" value="vans" label="Vans" />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tecnico" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm font-semibold py-3" data-testid="accordion-tecnico">
                Características Técnicas
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Tipo de Pisada</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="pisada" value="neutra" label="Neutra" />
                    <FilterCheckbox category="pisada" value="pronada" label="Pronada" />
                    <FilterCheckbox category="pisada" value="supinada" label="Supinada" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Amortecimento</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="amortecimento" value="maximo" label="Máximo" />
                    <FilterCheckbox category="amortecimento" value="moderado" label="Moderado" />
                    <FilterCheckbox category="amortecimento" value="responsivo" label="Responsivo/Rápido" />
                    <FilterCheckbox category="amortecimento" value="firme" label="Firme" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Suporte/Estabilidade</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="suporte" value="neutro" label="Neutro" />
                    <FilterCheckbox category="suporte" value="estavel" label="Estável" />
                    <FilterCheckbox category="suporte" value="controle" label="Controle de Movimento" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Drop</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="drop" value="baixo" label="Baixo (0-4mm)" />
                    <FilterCheckbox category="drop" value="medio" label="Médio (5-8mm)" />
                    <FilterCheckbox category="drop" value="alto" label="Alto (9-12mm)" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Peso</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="peso" value="leve" label="Leve (até 250g)" />
                    <FilterCheckbox category="peso" value="medio" label="Médio" />
                    <FilterCheckbox category="peso" value="pesado" label="Pesado" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Flexibilidade</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="flexibilidade" value="baixa" label="Baixa" />
                    <FilterCheckbox category="flexibilidade" value="media" label="Média" />
                    <FilterCheckbox category="flexibilidade" value="alta" label="Alta" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Tipo de Solado</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="solado" value="trilha" label="Trilha/Cravos" />
                    <FilterCheckbox category="solado" value="borracha" label="Borracha Aderente" />
                    <FilterCheckbox category="solado" value="liso" label="Solado Liso/Indoor" />
                    <FilterCheckbox category="solado" value="segmentado" label="Solado Segmentado" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Material do Cabedal</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="cabedal" value="mesh" label="Mesh Respirável" />
                    <FilterCheckbox category="cabedal" value="knit" label="Knit" />
                    <FilterCheckbox category="cabedal" value="sintetico" label="Sintético" />
                    <FilterCheckbox category="cabedal" value="couro" label="Couro" />
                    <FilterCheckbox category="cabedal" value="combinado" label="Combinado" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Ventilação</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="ventilacao" value="baixa" label="Baixa" />
                    <FilterCheckbox category="ventilacao" value="media" label="Média" />
                    <FilterCheckbox category="ventilacao" value="alta" label="Alta" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Altura do Cano</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="alturaCano" value="baixo" label="Baixo" />
                    <FilterCheckbox category="alturaCano" value="medio" label="Médio" />
                    <FilterCheckbox category="alturaCano" value="alto" label="Alto" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="estetica" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm font-semibold py-3" data-testid="accordion-estetica">
                Estética e Estilo
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Cor Principal</p>
                  <div className="flex flex-wrap gap-2">
                    <ColorSwatch color="#000000" value="preto" />
                    <ColorSwatch color="#FFFFFF" value="branco" />
                    <ColorSwatch color="#3B82F6" value="azul" />
                    <ColorSwatch color="#EF4444" value="vermelho" />
                    <ColorSwatch color="#6B7280" value="cinza" />
                    <ColorSwatch color="#22C55E" value="verde" />
                    <ColorSwatch color="#EC4899" value="rosa" />
                    <ColorSwatch color="#F59E0B" value="amarelo" />
                    <ColorSwatch color="#8B5CF6" value="roxo" />
                    <ColorSwatch color="#F97316" value="laranja" />
                    <div
                      className={`w-8 h-8 rounded-md border-2 bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 ${
                        (filters.corPrincipal as string[]).includes("multicolorido")
                          ? "border-primary ring-2 ring-primary ring-offset-2"
                          : "border-border"
                      }`}
                      onClick={() => toggleFilter("corPrincipal", "multicolorido")}
                      data-testid="color-multicolorido"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Estilo Visual</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="estiloVisual" value="minimalista" label="Minimalista" />
                    <FilterCheckbox category="estiloVisual" value="robusto" label="Robusto" />
                    <FilterCheckbox category="estiloVisual" value="retro" label="Retrô" />
                    <FilterCheckbox category="estiloVisual" value="chunky" label="Chunky" />
                    <FilterCheckbox category="estiloVisual" value="performance" label="Performance" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Público de Imagem</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="publicoImagem" value="lifestyle" label="Lifestyle" />
                    <FilterCheckbox category="publicoImagem" value="performance" label="Performance" />
                    <FilterCheckbox category="publicoImagem" value="casual" label="Casual Esportivo" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="avaliacao" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm font-semibold py-3" data-testid="accordion-avaliacao">
                Avaliação e Popularidade
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Avaliação Mínima</p>
                  <div className="space-y-2">
                    {[4.5, 4, 3.5, 3].map((rating) => (
                      <button
                        key={rating}
                        className={`flex items-center gap-2 w-full p-2 rounded-md border ${
                          filters.avaliacao === rating
                            ? "bg-primary/10 border-primary"
                            : "hover-elevate"
                        }`}
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            avaliacao: prev.avaliacao === rating ? 0 : rating,
                          }))
                        }
                        data-testid={`button-rating-${rating}`}
                      >
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-muted-foreground"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-sm">{rating}+ estrelas</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Popularidade</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="popularidade" value="mais-vistos" label="Mais Vistos" />
                    <FilterCheckbox category="popularidade" value="mais-clicados" label="Mais Clicados" />
                    <FilterCheckbox category="popularidade" value="mais-favoritos" label="Mais Favoritados" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="preco" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm font-semibold py-3" data-testid="accordion-preco">
                Preço e Ofertas
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Faixa de Preço</p>
                  <div className="px-2">
                    <Slider
                      value={priceRange}
                      onValueChange={setPriceRange}
                      min={0}
                      max={2000}
                      step={50}
                      data-testid="slider-price"
                    />
                    <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                      <span>R$ {priceRange[0]}</span>
                      <span>R$ {priceRange[1]}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Desconto</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="desconto" value="sem-desconto" label="Sem Desconto" />
                    <FilterCheckbox category="desconto" value="ate-20" label="Até 20% OFF" />
                    <FilterCheckbox category="desconto" value="20-40" label="20% a 40% OFF" />
                    <FilterCheckbox category="desconto" value="40-60" label="40% a 60% OFF" />
                    <FilterCheckbox category="desconto" value="60-mais" label="60%+ OFF" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Condições Especiais</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="condicoes" value="frete-gratis" label="Frete Grátis" />
                    <FilterCheckbox category="condicoes" value="entrega-rapida" label="Entrega Rápida" />
                    <FilterCheckbox category="condicoes" value="sem-juros" label="Sem Juros" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="logistica" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm font-semibold py-3" data-testid="accordion-logistica">
                Logística e Origem
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Origem/Marketplace</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="origem" value="mercado-livre" label="Mercado Livre" />
                    <FilterCheckbox category="origem" value="magazine-luiza" label="Magazine Luiza" />
                    <FilterCheckbox category="origem" value="centauro" label="Centauro" />
                    <FilterCheckbox category="origem" value="netshoes" label="Netshoes" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Prazo de Entrega</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="prazoEntrega" value="curto" label="Curto (até 3 dias)" />
                    <FilterCheckbox category="prazoEntrega" value="medio" label="Médio (4-7 dias)" />
                    <FilterCheckbox category="prazoEntrega" value="longo" label="Longo (8+ dias)" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="meias" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm font-semibold py-3" data-testid="accordion-meias">
                Meias e Compressores
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Tipo de Produto</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="tipoProdutoMeias" value="meia-esportiva" label="Meia Esportiva" />
                    <FilterCheckbox category="tipoProdutoMeias" value="meia-compressao" label="Meia de Compressão" />
                    <FilterCheckbox category="tipoProdutoMeias" value="canelito" label="Canelito" />
                    <FilterCheckbox category="tipoProdutoMeias" value="tornozeleira" label="Tornozeleira" />
                    <FilterCheckbox category="tipoProdutoMeias" value="tensor-panturrilha" label="Tensor de Panturrilha" />
                    <FilterCheckbox category="tipoProdutoMeias" value="tensor-joelho" label="Tensor de Joelho/Perna" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Nível de Compressão</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="compressao" value="leve" label="Leve" />
                    <FilterCheckbox category="compressao" value="moderada" label="Moderada" />
                    <FilterCheckbox category="compressao" value="alta" label="Alta" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Altura</p>
                  <div className="grid grid-cols-2 gap-2">
                    <FilterCheckbox category="alturaMeia" value="invisivel" label="Invisível" />
                    <FilterCheckbox category="alturaMeia" value="cano-baixo" label="Cano Baixo" />
                    <FilterCheckbox category="alturaMeia" value="medio" label="Médio" />
                    <FilterCheckbox category="alturaMeia" value="alto" label="Alto" />
                    <FilterCheckbox category="alturaMeia" value="3-4" label="3/4" />
                    <FilterCheckbox category="alturaMeia" value="7-8" label="7/8" />
                    <FilterCheckbox category="alturaMeia" value="coxa" label="Até a Coxa" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Tamanho</p>
                  <div className="flex gap-2">
                    {["P", "M", "G", "GG"].map((size) => (
                      <Button
                        key={size}
                        variant={
                          (filters.tamanhoMeia as string[]).includes(size)
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => toggleFilter("tamanhoMeia", size)}
                        data-testid={`button-meia-size-${size}`}
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Finalidade</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="finalidade" value="performance" label="Performance Esportiva" />
                    <FilterCheckbox category="finalidade" value="recuperacao" label="Recuperação Muscular" />
                    <FilterCheckbox category="finalidade" value="circulacao" label="Circulação/Viagem" />
                    <FilterCheckbox category="finalidade" value="prevencao" label="Prevenção de Lesões" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Parte do Corpo</p>
                  <div className="space-y-2">
                    <FilterCheckbox category="parteCorpo" value="pe" label="Pé" />
                    <FilterCheckbox category="parteCorpo" value="tornozelo" label="Tornozelo" />
                    <FilterCheckbox category="parteCorpo" value="panturrilha" label="Panturrilha" />
                    <FilterCheckbox category="parteCorpo" value="perna" label="Perna Inteira" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="disponibilidade" className="border rounded-md px-3">
              <AccordionTrigger className="text-sm font-semibold py-3" data-testid="accordion-disponibilidade">
                Disponibilidade
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pb-4">
                <FilterCheckbox category="disponibilidade" value="em-estoque" label="Em Estoque" />
                <FilterCheckbox category="disponibilidade" value="pouco-estoque" label="Pouco Estoque" />
                <FilterCheckbox category="disponibilidade" value="esgotado" label="Esgotado" />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="sticky bottom-0 bg-background border-t p-4">
          <Button className="w-full" data-testid="button-apply-filters">
            Aplicar Filtros
          </Button>
        </div>
      </aside>
    </>
  );
}
