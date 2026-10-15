import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Settings2, X } from "lucide-react";
import type { CatalogProduct, MultiFilterKey } from "@/lib/catalogFilters";
import { brandNameOf, colorsOf, discountOf, genderOf, sizeOf, ageOf, modalityOf, typeOf } from "@/lib/catalogFilters";
import type { CatalogUrlFilters, CatalogSortMode } from "@/lib/catalogState";

const LABELS: Partial<Record<MultiFilterKey, string>> = {
  marca: "Marca", cor: "Cor", tamanho: "Tamanho", genero: "Gênero",
  idade: "Idade", modalidade: "Modalidade", tipo: "Tipo",
  desconto: "Desconto", frete: "Frete", avaliacao: "Avaliação",
};
const GROUPABLE: MultiFilterKey[] = ["marca", "genero", "tamanho", "cor", "idade", "modalidade", "tipo", "frete", "desconto", "avaliacao"];
const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
function valuesOf(product: CatalogProduct, field: MultiFilterKey): string[] {
  switch (field) {
    case "marca": return [brandNameOf(product)];
    case "genero": return [genderOf(product)].filter((v): v is string => Boolean(v));
    case "tamanho": return [sizeOf(product)].filter((v): v is string => Boolean(v));
    case "cor": return colorsOf(product).map(c => c.label);
    case "idade": return [ageOf(product)].filter((v): v is string => Boolean(v));
    case "modalidade": return [modalityOf(product)].filter((v): v is string => Boolean(v));
    case "tipo": return [typeOf(product)];
    case "frete": return [product.bestOffer?.freeShipping ? "Sim" : "Não"];
    case "desconto": return [String(Math.floor(discountOf(product) / 10) * 10) + "%+"];
    case "avaliacao": return product.averageRating ? [String(Math.floor(product.averageRating)) + " estrelas"] : [];
    default: return [];
  }
}
export function groupCatalogPage(products: CatalogProduct[], dimensions: MultiFilterKey[]) {
  if (!dimensions.length) return [{ title: "", products }];
  // Each selected dimension creates distinct buckets, including the final one.
  // Preserve the API's product order within every bucket (e.g. highest discount).
  let rows: Array<{ path: string[]; products: CatalogProduct[] }> = [{ path: [], products }];
  for (const field of dimensions) {
    const next: typeof rows = [];
    for (const row of rows) {
      const buckets = new Map<string, CatalogProduct[]>();
      for (const product of row.products) {
        const values = valuesOf(product, field);
        for (const value of new Set(values.length ? values : ["Não identificado"])) {
          if (!buckets.has(value)) buckets.set(value, []);
          buckets.get(value)!.push(product);
        }
      }
      for (const value of [...buckets.keys()].sort(collator.compare)) {
        next.push({ path: [...row.path, value], products: buckets.get(value)! });
      }
    }
    rows = next;
  }
  return rows.map(row => ({ title: row.path.join(" › "), products: row.products }));
}

interface Props {
  filters: CatalogUrlFilters;
  products: CatalogProduct[];
  sortMode: CatalogSortMode;
  onSortChange: (sort: CatalogSortMode) => void;
  children: (products: CatalogProduct[]) => React.ReactNode;
  serverDriven: boolean;
  total: number;
}
export default function CatalogOrganizer({ filters, products, sortMode, onSortChange, children, serverDriven, total }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dimensions, setDimensions] = useState<MultiFilterKey[]>([]);
  const available = GROUPABLE.filter(key => filters[key].length > 0);
  const selected = dimensions.filter(key => available.includes(key)).slice(0, 3);
  const [dragging, setDragging] = useState<MultiFilterKey | null>(null);
  const rows = groupCatalogPage(products, selected);
  const addAt = (key: MultiFilterKey, index?: number) => {
    if (!available.includes(key)) return;
    const next = selected.filter(item => item !== key);
    if (index == null) {
      if (next.length >= 3) return;
      next.push(key);
    } else {
      next.splice(index, next.length >= 3 && !selected.includes(key) ? 1 : 0, key);
    }
    setDimensions(next.slice(0, 3));
  };
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[index], next[target]] = [next[target], next[index]];
    setDimensions(next);
  };
  return (
    <div data-testid="catalog-organizer">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}
          className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold"
          data-testid="button-organize"><Settings2 className="h-4 w-4" /> Organizar resultados</button>
        <span className="text-xs text-muted-foreground">{selected.length ? selected.map(k => LABELS[k]).join(" → ") : "Sem agrupamento"} · {sortMode === "maior-desconto" ? "Maior desconto" : sortMode === "menor-preco" ? "Menor preço" : sortMode === "recentes" ? "Mais recentes" : "Mais relevantes"}</span>
      </div>
      {expanded && <div className="mb-5 rounded-lg border border-border bg-background p-4" data-testid="panel-organize">
        <label className="block text-sm font-semibold">Ordenar produtos por
          <select value={sortMode} onChange={e => onSortChange(e.target.value as CatalogSortMode)}
            className="mt-2 block w-full max-w-xs rounded-md border border-border bg-background p-2 text-sm" data-testid="organizer-sort">
            <option value="maior-desconto">Maior desconto</option>
            <option value="menor-preco">Menor preço</option>
            <option value="relevantes">Mais relevantes</option>
            <option value="recentes">Mais recentes</option>
          </select>
        </label>
        <p className="mt-4 text-sm font-semibold">Filtros disponíveis para agrupamento</p>
        <div className="mt-2 flex flex-wrap gap-2" data-testid="organizer-available">
          {available.length === 0 && <p className="text-xs text-muted-foreground">Selecione filtros na lateral para organizar os produtos.</p>}
          {available.map(key => <button key={key} type="button" draggable onDragStart={() => setDragging(key)}
            onClick={() => addAt(key)} disabled={selected.includes(key) || selected.length >= 3}
            className="rounded-md border border-border px-3 py-2 text-xs disabled:opacity-50">{LABELS[key]} ({filters[key].length})</button>)}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2"><p className="text-sm font-semibold">Agrupar por · máximo 3</p>
          <button type="button" className="text-xs underline" onClick={() => setDimensions([])}>Limpar grupos</button></div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[0, 1, 2].map(index => {
            const key = selected[index];
            return <div key={index} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragging) addAt(dragging, index); setDragging(null); }}
              className="flex min-h-11 items-center justify-between rounded-md border border-dashed border-border px-3 py-2 text-sm" data-testid={`organizer-slot-${index}`}>
              {key ? <><span draggable onDragStart={() => setDragging(key)} className="flex cursor-grab items-center gap-2"><GripVertical className="h-4 w-4" /> {index + 1}. {LABELS[key]}</span>
                <span className="flex gap-1"><button aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-4 w-4" /></button>
                  <button aria-label="Descer" disabled={index === selected.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-4 w-4" /></button>
                  <button aria-label="Remover agrupamento" onClick={() => setDimensions(selected.filter(k => k !== key))}><X className="h-4 w-4" /></button></span></>
                : <span className="text-muted-foreground">{index + 1}. Arraste um filtro para cá</span>}
            </div>;
          })}
        </div>
      </div>}
      {selected.length > 0 && serverDriven && <p role="note" className="mb-3 text-xs text-muted-foreground">Agrupamento dos {products.length} produtos desta página, de {total} resultados. Os grupos podem continuar em outras páginas.</p>}
      {selected.length === 0 ? children(products) : rows.map((row, index) =>
        <section key={index} className="mb-6 border-t border-border pt-4" data-testid="organizer-group">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">{row.title || "Não identificado"}</h3>
            <span className="text-xs text-muted-foreground">{row.products.length} nesta página</span>
          </div>
          {children(row.products)}
        </section>)}
    </div>
  );
}
