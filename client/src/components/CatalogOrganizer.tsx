import { useEffect, useRef, useState } from "react";
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
// Preserve selected brand columns even before their products arrive through infinite scroll.
export function organizerFirstColumnValues(
  rows: Array<{ title: string }>, firstDimension: MultiFilterKey | undefined, selectedValues: string[],
): string[] {
  const loaded = rows.map(row => row.title.split(" › ")[0]);
  if (firstDimension !== "marca") return [...new Set(loaded)];
  const byNormalized = new Map<string, string>();
  for (const value of [...selectedValues, ...loaded]) {
    const key = value.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
    if (!byNormalized.has(key)) byNormalized.set(key, value);
  }
  return [...byNormalized.values()].sort(collator.compare);
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
      for (const value of [...buckets.keys()].sort(field === "desconto"
        ? (a, b) => (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0)
        : collator.compare)) {
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
  children: (products: CatalogProduct[], columnMode?: boolean) => React.ReactNode;
  serverDriven: boolean;
  total: number;
}
export default function CatalogOrganizer({ filters, products, sortMode, onSortChange, children, serverDriven, total }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [dimensions, setDimensions] = useState<MultiFilterKey[]>([]);
  const available = GROUPABLE.filter(key => filters[key].length > 0);
  const selected = dimensions.filter(key => available.includes(key)).slice(0, 3);
  const [dragging, setDragging] = useState<MultiFilterKey | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ width: 0, content: 0, left: 0, visible: false });
  useEffect(() => {
    const columns = columnsRef.current;
    if (!columns || !selected.length) return;
    const update = () => {
      const rect = columns.getBoundingClientRect();
      setMetrics(previous => {
        const next = { width: columns.clientWidth, content: columns.scrollWidth, left: rect.left, visible: rect.top < window.innerHeight && rect.bottom > 0 };
        return Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next;
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(columns);
    for (const child of columns.children) observer.observe(child);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => { observer.disconnect(); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [selected.join("|"), products.length]);
  const rows = groupCatalogPage(products, selected);
  const firstColumnValues = organizerFirstColumnValues(rows, selected[0], selected[0] === "marca" ? filters.marca : []);
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
          className="flex items-center gap-2 rounded-lg border-2 border-emerald-600/50 bg-emerald-50 px-4 py-3 text-base font-bold text-emerald-900 shadow-sm transition-colors hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
          data-testid="button-organize"><Settings2 className="h-5 w-5" /> Organizar resultados</button>
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
        <div className="mt-2 grid gap-2">
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
      {selected.length > 0 && serverDriven && <p role="note" className="mb-3 text-xs text-muted-foreground">Exibindo {products.length} de {total} produtos; mais produtos são carregados ao rolar.</p>}
      {selected.length === 0 ? children(products) : (
        <div ref={columnsRef} onScroll={event => { if (barRef.current) barRef.current.scrollLeft = event.currentTarget.scrollLeft; }} className="flex items-start gap-4 overflow-x-auto pb-5" data-testid="organizer-columns" aria-label={`Comparação por ${LABELS[selected[0]]}`}>
          {firstColumnValues.map((firstValue, columnIndex) => {
            const columnRows = rows.filter(row => collator.compare(row.title.split(" › ")[0], firstValue) === 0);
            const columnCount = columnRows.reduce((sum, row) => sum + row.products.length, 0);
            return (
              <section key={firstValue} className={`w-[280px] min-w-[280px] shrink-0 rounded-lg border border-border p-3 sm:w-[320px] sm:min-w-[320px] ${columnIndex % 2 === 0 ? "bg-background" : "bg-emerald-50/80 dark:bg-emerald-950/25"}`} data-testid="organizer-column">
                <div className="sticky top-0 z-10 mb-3 flex items-center justify-between gap-2 rounded-md bg-background p-2 shadow-sm">
                  <h3 className="text-sm font-bold">{firstValue}</h3>
                  <span className="text-xs text-muted-foreground">{columnCount} nesta página</span>
                </div>
                {columnRows.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground" data-testid="organizer-awaiting-products">Aguardando produtos desta marca nas próximas cargas.</p>}
                {columnRows.map((row, index) => (
                  <div key={index} className="mb-5" data-testid="organizer-group">
                    {selected.length > 1 && <h4 className="mb-3 rounded-md border-l-4 border-emerald-600 bg-emerald-100/90 px-3 py-2 text-sm font-bold leading-snug text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">{row.title.split(" › ").slice(1).join(" › ")}</h4>}
                    {children(row.products, true)}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
      {selected.length > 0 && metrics.content > metrics.width + 2 && (
        <div className="fixed bottom-0 z-40 border-t border-border bg-background/95 px-2 py-2 shadow-lg backdrop-blur"
          style={{ left: metrics.left, width: metrics.width, display: metrics.visible ? "block" : "none" }}
          data-testid="organizer-fixed-scrollbar">
          <div ref={barRef} onScroll={event => { if (columnsRef.current) columnsRef.current.scrollLeft = event.currentTarget.scrollLeft; }}
            className="overflow-x-scroll overflow-y-hidden" style={{ height: 18 }} aria-label="Deslocar colunas horizontalmente">
            <div style={{ width: metrics.content, height: 1 }} />
          </div>
        </div>
      )}
    </div>
  );
}
