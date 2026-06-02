import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Search,
} from "lucide-react";

const GREEN = "hsl(145 70% 35%)";
const GREEN_DARK = "hsl(145 70% 28%)";

const FIXED_BRANDS = [
  { name: "Nike", count: "1.245" },
  { name: "Adidas", count: "1.087" },
  { name: "Olympikus", count: "823" },
];

const MORE_BRANDS = [
  { name: "Asics", count: "647" },
  { name: "Puma", count: "532" },
  { name: "Mizuno", count: "423" },
  { name: "Fila", count: "312" },
  { name: "New Balance", count: "287" },
  { name: "Reebok", count: "198" },
  { name: "Under Armour", count: "156" },
];

const CATEGORIES = [
  { name: "Corrida", count: "2.341" },
  { name: "Caminhada", count: "1.532" },
  { name: "Treino", count: "1.087" },
  { name: "Casual", count: "823" },
  { name: "Basquete", count: "312" },
];

const SIZES = ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43"];

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-gray-200 py-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[13px] font-bold uppercase tracking-wide text-gray-800">
          {title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

interface CheckRowProps {
  label: string;
  count: string;
  checked: boolean;
  onToggle: () => void;
  logo?: boolean;
}

function CheckRow({ label, count, checked, onToggle, logo }: CheckRowProps) {
  return (
    <button
      onClick={onToggle}
      className="group flex w-full items-center justify-between rounded-md px-1 py-1.5 hover:bg-gray-50"
    >
      <span className="flex items-center gap-2.5">
        <span
          className="flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors"
          style={{
            borderColor: checked ? GREEN : "#cbd5e1",
            backgroundColor: checked ? GREEN : "transparent",
          }}
        >
          {checked && (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
              <path
                d="M2.5 6.5l2.5 2.5 4.5-5"
                stroke="white"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        {logo && (
          <span className="flex h-5 w-7 items-center justify-center rounded bg-gray-100 text-[9px] font-bold text-gray-500">
            {label.slice(0, 3).toUpperCase()}
          </span>
        )}
        <span className="text-[13px] text-gray-700">{label}</span>
      </span>
      <span className="text-[12px] text-gray-400">{count}</span>
    </button>
  );
}

export function FilterSidebar() {
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [showMoreBrands, setShowMoreBrands] = useState(false);
  const [showAllSizes, setShowAllSizes] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");

  const toggle = (
    value: string,
    list: string[],
    setter: (v: string[]) => void,
  ) =>
    setter(
      list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value],
    );

  const clearAll = () => {
    setSelectedBrands([]);
    setSelectedCats([]);
    setSelectedSizes([]);
  };

  const visibleMoreBrands = MORE_BRANDS.filter((b) =>
    b.name.toLowerCase().includes(brandQuery.toLowerCase()),
  );

  const visibleSizes = showAllSizes ? SIZES : SIZES.slice(0, 5);

  return (
    <aside className="w-[230px] flex-shrink-0">
      <div
        className="sticky top-[76px] max-h-[calc(100vh-92px)] overflow-y-auto rounded-lg border border-gray-200 bg-white px-4 pb-4"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 py-4">
          <span className="flex items-center gap-2 text-[15px] font-bold text-gray-900">
            <SlidersHorizontal className="h-4 w-4" style={{ color: GREEN }} />
            Filtros
          </span>
          <button
            onClick={clearAll}
            className="text-[12px] font-semibold hover:underline"
            style={{ color: GREEN }}
          >
            Limpar todos
          </button>
        </div>

        {/* Marca */}
        <Section title="Marca">
          <div className="space-y-0.5">
            {FIXED_BRANDS.map((b) => (
              <CheckRow
                key={b.name}
                label={b.name}
                count={b.count}
                logo
                checked={selectedBrands.includes(b.name)}
                onToggle={() =>
                  toggle(b.name, selectedBrands, setSelectedBrands)
                }
              />
            ))}
          </div>

          <button
            onClick={() => setShowMoreBrands((s) => !s)}
            data-testid="button-ver-mais-marcas"
            className="mt-2 flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: GREEN }}
          >
            {showMoreBrands ? "Ver menos marcas" : "Ver mais marcas"}
            {showMoreBrands ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showMoreBrands && (
            <div className="mt-3">
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  value={brandQuery}
                  onChange={(e) => setBrandQuery(e.target.value)}
                  placeholder="Buscar outras marcas..."
                  className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-2 text-[12px] text-gray-700 outline-none focus:border-gray-400"
                />
              </div>
              <div className="max-h-[170px] space-y-0.5 overflow-y-auto pr-1">
                {visibleMoreBrands.map((b) => (
                  <CheckRow
                    key={b.name}
                    label={b.name}
                    count={b.count}
                    checked={selectedBrands.includes(b.name)}
                    onToggle={() =>
                      toggle(b.name, selectedBrands, setSelectedBrands)
                    }
                  />
                ))}
                {visibleMoreBrands.length === 0 && (
                  <p className="px-1 py-2 text-[12px] text-gray-400">
                    Nenhuma marca encontrada
                  </p>
                )}
              </div>
              <button
                className="mt-1 text-[12px] font-semibold hover:underline"
                style={{ color: GREEN }}
              >
                Ver todas
              </button>
            </div>
          )}
        </Section>

        {/* Categoria */}
        <Section title="Categoria">
          <div className="space-y-0.5">
            {CATEGORIES.map((c) => (
              <CheckRow
                key={c.name}
                label={c.name}
                count={c.count}
                checked={selectedCats.includes(c.name)}
                onToggle={() => toggle(c.name, selectedCats, setSelectedCats)}
              />
            ))}
          </div>
        </Section>

        {/* Tamanho */}
        <Section title="Tamanho">
          <div className="grid grid-cols-5 gap-1.5">
            {visibleSizes.map((s) => {
              const active = selectedSizes.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggle(s, selectedSizes, setSelectedSizes)}
                  className="flex h-8 items-center justify-center rounded-md border text-[12px] font-medium transition-colors"
                  style={{
                    borderColor: active ? GREEN : "#d1d5db",
                    backgroundColor: active ? GREEN : "white",
                    color: active ? "white" : "#374151",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setShowAllSizes((s) => !s)}
            className="mt-3 text-[12px] font-semibold hover:underline"
            style={{ color: GREEN }}
          >
            {showAllSizes ? "Ver menos" : "Ver mais"}
          </button>
        </Section>

        {/* Apply (mobile-friendly accent) */}
        <button
          className="mt-4 w-full rounded-md py-2 text-[13px] font-bold text-white transition-colors"
          style={{ backgroundColor: GREEN }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = GREEN_DARK)
          }
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = GREEN)}
        >
          Aplicar filtros
        </button>
      </div>
    </aside>
  );
}
