import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Search,
  Star,
  X,
} from "lucide-react";
import "./_group.css";

const GREEN = "hsl(145 70% 35%)";
const GREEN_DARK = "hsl(145 70% 28%)";
const CHIP_BG = "hsl(145 55% 94%)";
const CHIP_BORDER = "hsl(145 45% 82%)";

const PRICE_MAX = 6115;
const PRICE_MIN = 8;

interface Item {
  label: string;
  count?: string;
}

const FIXED_BRANDS: Item[] = [
  { label: "Nike", count: "1.245" },
  { label: "Adidas", count: "1.087" },
  { label: "Olympikus", count: "823" },
];

const MORE_BRANDS: Item[] = [
  { label: "Asics", count: "647" },
  { label: "Puma", count: "532" },
  { label: "Mizuno", count: "423" },
  { label: "Fila", count: "312" },
  { label: "New Balance", count: "287" },
  { label: "Reebok", count: "198" },
  { label: "Under Armour", count: "156" },
];

/* Filtros mantidos = só os que têm dado real nos títulos do ML.
   Contagens ilustrativas baseadas na amostra de 1.889 produtos coletados. */

const GENERO: Item[] = [
  { label: "Masculino", count: "750" },
  { label: "Feminino", count: "547" },
  { label: "Unissex", count: "312" },
];

const IDADE: Item[] = [
  { label: "Adulto", count: "1.776" },
  { label: "Infantil", count: "113" },
];

const ESPORTES: Item[] = [
  { label: "Futebol", count: "98" },
  { label: "Basquete", count: "54" },
  { label: "Skate", count: "41" },
  { label: "Tênis / Raquete", count: "37" },
  { label: "Vôlei", count: "23" },
];

const MODALIDADE: Item[] = [
  { label: "Casual", count: "463" },
  { label: "Treino", count: "156" },
  { label: "Corrida", count: "133" },
  { label: "Caminhada", count: "131" },
  { label: "Academia", count: "89" },
];

const DESCONTO: Item[] = [
  { label: "50% ou mais", count: "104" },
  { label: "40% - 49%", count: "218" },
  { label: "30% - 39%", count: "421" },
  { label: "20% - 29%", count: "534" },
  { label: "Até 19%", count: "612" },
];

const SIZES = ["34", "35", "36", "37", "38", "39", "40", "41", "42", "43"];

/* ---------------- shared pieces ---------------- */

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
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

function CheckRow({
  label,
  count,
  checked,
  onToggle,
  logo,
}: {
  label: string;
  count?: string;
  checked: boolean;
  onToggle: () => void;
  logo?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className="group flex w-full items-center justify-between rounded-md px-1 py-1.5 hover:bg-gray-50"
    >
      <span className="flex items-center gap-2.5">
        <span
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors"
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
          <span className="flex h-5 w-7 flex-shrink-0 items-center justify-center rounded bg-gray-100 text-[9px] font-bold text-gray-500">
            {label.slice(0, 3).toUpperCase()}
          </span>
        )}
        <span className="text-left text-[13px] leading-tight text-gray-700">
          {label}
        </span>
      </span>
      {count && (
        <span className="flex-shrink-0 text-[12px] text-gray-400">
          ({count})
        </span>
      )}
    </button>
  );
}

/* Generic searchable / scrollable checkbox group */
function FilterGroup({
  groupKey,
  title,
  items,
  selected,
  onToggle,
  searchable,
  maxVisible = 6,
  defaultOpen = true,
  resetSignal = 0,
}: {
  groupKey: string;
  title: string;
  items: Item[];
  selected: string[];
  onToggle: (key: string, value: string) => void;
  searchable?: boolean;
  maxVisible?: number;
  defaultOpen?: boolean;
  resetSignal?: number;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery("");
  }, [resetSignal]);
  const filtered = query
    ? items.filter((i) =>
        i.label.toLowerCase().includes(query.toLowerCase()),
      )
    : items;
  const scrolls = filtered.length > maxVisible;

  return (
    <Section title={title} defaultOpen={defaultOpen}>
      {searchable && (
        <div className="relative mb-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Faça sua busca"
            className="w-full rounded-md border border-gray-300 py-1.5 pl-3 pr-8 text-[12px] text-gray-700 outline-none focus:border-gray-400"
          />
          <Search className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        </div>
      )}
      <div
        className={`space-y-0.5 ${scrolls ? "max-h-[185px] overflow-y-auto pr-1" : ""}`}
        style={scrolls ? { scrollbarWidth: "thin" } : undefined}
      >
        {filtered.map((it) => (
          <CheckRow
            key={it.label}
            label={it.label}
            count={it.count}
            checked={selected.includes(it.label)}
            onToggle={() => onToggle(groupKey, it.label)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="px-1 py-2 text-[12px] text-gray-400">
            Nenhum item encontrado
          </p>
        )}
      </div>
    </Section>
  );
}

/* Removable chip for the "selected filters" summary */
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      onClick={onRemove}
      className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium"
      style={{
        backgroundColor: CHIP_BG,
        borderColor: CHIP_BORDER,
        color: GREEN_DARK,
      }}
    >
      <span className="leading-none">{label}</span>
      <X className="h-3 w-3" />
    </button>
  );
}

/* ---------------- main ---------------- */

export function FilterSidebar() {
  const [selected, setSelected] = useState<Record<string, string[]>>({
    marca: ["Nike"],
    tamanho: ["38"],
    desconto: ["30% - 39%"],
  });
  const [showMoreBrands, setShowMoreBrands] = useState(false);
  const [showAllSizes, setShowAllSizes] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");
  const [price, setPrice] = useState<[number, number]>([PRICE_MIN, PRICE_MAX]);
  const [resetSignal, setResetSignal] = useState(0);

  const clamp = (n: number) =>
    Math.min(PRICE_MAX, Math.max(PRICE_MIN, Number.isFinite(n) ? n : PRICE_MIN));

  const setMin = (raw: number) =>
    setPrice(([, hi]) => [Math.min(clamp(raw), hi), hi]);
  const setMax = (raw: number) =>
    setPrice(([lo]) => [lo, Math.max(clamp(raw), lo)]);

  const toggle = (key: string, value: string) =>
    setSelected((prev) => {
      const list = prev[key] ?? [];
      return {
        ...prev,
        [key]: list.includes(value)
          ? list.filter((v) => v !== value)
          : [...list, value],
      };
    });

  const get = (key: string) => selected[key] ?? [];

  const clearAll = () => {
    setSelected({});
    setPrice([PRICE_MIN, PRICE_MAX]);
    setBrandQuery("");
    setShowMoreBrands(false);
    setShowAllSizes(false);
    setResetSignal((n) => n + 1);
  };

  const visibleMoreBrands = MORE_BRANDS.filter((b) =>
    b.label.toLowerCase().includes(brandQuery.toLowerCase()),
  );
  const visibleSizes = showAllSizes ? SIZES : SIZES.slice(0, 5);

  const span = PRICE_MAX - PRICE_MIN;
  const leftPct = ((price[0] - PRICE_MIN) / span) * 100;
  const rightPct = ((price[1] - PRICE_MIN) / span) * 100;

  /* Selected-filter chips (shown under the "Filtros" header) */
  const chipLabel = (key: string, v: string) =>
    key === "tamanho"
      ? `Tamanho ${v}`
      : key === "avaliacao"
        ? `${v}+ estrelas`
        : v;

  const chips: { key: string; value: string; label: string }[] = [];
  Object.entries(selected).forEach(([key, vals]) =>
    vals.forEach((v) =>
      chips.push({ key, value: v, label: chipLabel(key, v) }),
    ),
  );
  const priceChanged = price[0] !== PRICE_MIN || price[1] !== PRICE_MAX;
  const hasActive = chips.length > 0 || priceChanged;

  return (
    <aside className="w-[240px] flex-shrink-0">
      <div
        className="sticky top-[76px] max-h-[calc(100vh-92px)] overflow-y-auto rounded-lg border border-gray-200 bg-white px-4 pb-4"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white py-4">
          <span className="flex items-center gap-2 text-[15px] font-bold text-gray-900">
            <SlidersHorizontal className="h-4 w-4" style={{ color: GREEN }} />
            Filtros
          </span>
          <button
            onClick={clearAll}
            data-testid="button-limpar-todos"
            className="text-[12px] font-semibold hover:underline"
            style={{ color: GREEN }}
          >
            Limpar todos
          </button>
        </div>

        {/* Filtros selecionados */}
        {hasActive && (
          <div className="border-b border-gray-200 py-3" data-testid="active-filters">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
              Filtros selecionados
            </span>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <Chip
                  key={`${c.key}-${c.value}`}
                  label={c.label}
                  onRemove={() => toggle(c.key, c.value)}
                />
              ))}
              {priceChanged && (
                <Chip
                  label={`R$ ${price[0]} – R$ ${price[1]}`}
                  onRemove={() => setPrice([PRICE_MIN, PRICE_MAX])}
                />
              )}
            </div>
          </div>
        )}

        {/* Marca (fixed + ver mais) */}
        <Section title="Marca">
          <div className="space-y-0.5">
            {FIXED_BRANDS.map((b) => (
              <CheckRow
                key={b.label}
                label={b.label}
                count={b.count}
                logo
                checked={get("marca").includes(b.label)}
                onToggle={() => toggle("marca", b.label)}
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
                    key={b.label}
                    label={b.label}
                    count={b.count}
                    checked={get("marca").includes(b.label)}
                    onToggle={() => toggle("marca", b.label)}
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

        {/* Tamanho */}
        <Section title="Tamanho">
          <div className="grid grid-cols-5 gap-1.5">
            {visibleSizes.map((s) => {
              const active = get("tamanho").includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggle("tamanho", s)}
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

        {/* Desconto */}
        <FilterGroup
          groupKey="desconto"
          title="Desconto"
          items={DESCONTO}
          selected={get("desconto")}
          onToggle={toggle}
          resetSignal={resetSignal}
          maxVisible={6}
        />

        {/* Preço */}
        <Section title="Preço">
          <div className="relative mb-4 mt-2 h-4">
            <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-gray-200" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
              style={{
                left: `${leftPct}%`,
                right: `${100 - rightPct}%`,
                backgroundColor: GREEN,
              }}
            />
            <input
              type="range"
              min={PRICE_MIN}
              max={PRICE_MAX}
              value={price[0]}
              onChange={(e) => setMin(Number(e.target.value))}
              className="beup-range"
            />
            <input
              type="range"
              min={PRICE_MIN}
              max={PRICE_MAX}
              value={price[1]}
              onChange={(e) => setMax(Number(e.target.value))}
              className="beup-range"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-[11px] text-gray-500">
                Mínimo:
              </span>
              <div className="flex items-center rounded-md border border-gray-300 px-2 py-1.5">
                <span className="mr-1 text-[12px] text-gray-400">R$</span>
                <input
                  type="number"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  value={price[0]}
                  onChange={(e) => setMin(Number(e.target.value))}
                  className="w-full text-[12px] text-gray-700 outline-none"
                />
              </div>
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-[11px] text-gray-500">
                Máximo:
              </span>
              <div className="flex items-center rounded-md border border-gray-300 px-2 py-1.5">
                <span className="mr-1 text-[12px] text-gray-400">R$</span>
                <input
                  type="number"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  value={price[1]}
                  onChange={(e) => setMax(Number(e.target.value))}
                  className="w-full text-[12px] text-gray-700 outline-none"
                />
              </div>
            </label>
          </div>
        </Section>

        {/* Gênero */}
        <FilterGroup
          groupKey="genero"
          title="Gênero"
          items={GENERO}
          selected={get("genero")}
          onToggle={toggle}
          resetSignal={resetSignal}
        />

        {/* Idade */}
        <FilterGroup
          groupKey="idade"
          title="Idade"
          items={IDADE}
          selected={get("idade")}
          onToggle={toggle}
          resetSignal={resetSignal}
        />

        {/* Avaliação */}
        <Section title="Avaliação">
          <div className="space-y-0.5">
            {[4, 3, 2, 1].map((stars) => {
              const key = `${stars}`;
              const active = get("avaliacao").includes(key);
              return (
                <button
                  key={stars}
                  onClick={() => toggle("avaliacao", key)}
                  className="flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-gray-50"
                >
                  <span
                    className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors"
                    style={{
                      borderColor: active ? GREEN : "#cbd5e1",
                      backgroundColor: active ? GREEN : "transparent",
                    }}
                  >
                    {active && (
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
                  <span className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className="h-3.5 w-3.5"
                        style={{
                          color: i <= stars ? GREEN : "#d1d5db",
                          fill: i <= stars ? GREEN : "transparent",
                        }}
                      />
                    ))}
                  </span>
                  <span className="text-[12px] text-gray-500">e acima</span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Esportes */}
        <FilterGroup
          groupKey="esportes"
          title="Esportes"
          items={ESPORTES}
          selected={get("esportes")}
          onToggle={toggle}
          resetSignal={resetSignal}
        />

        {/* Modalidade */}
        <FilterGroup
          groupKey="modalidade"
          title="Modalidade"
          items={MODALIDADE}
          selected={get("modalidade")}
          onToggle={toggle}
          resetSignal={resetSignal}
        />

        {/* Apply */}
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
