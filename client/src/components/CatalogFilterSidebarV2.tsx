import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Search,
  Check,
  Star,
  X,
} from "lucide-react";
import {
  CatalogFilters,
  CatalogFacets,
  MultiFilterKey,
  DESCONTO_BUCKETS,
  FRETE_OPTIONS,
  AVALIACAO_BUCKETS,
  countActiveFilters,
} from "@/lib/catalogFilters";

const PINNED_BRANDS = ["Nike", "Adidas", "Olympikus"];

function normalizeBrand(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isSameBrand(a: string, b: string) {
  const normalizedA = normalizeBrand(a);
  const normalizedB = normalizeBrand(b);
  if (normalizedB === "olympikus") {
    return normalizedA === "olympikus" || normalizedA === "olimpikus";
  }
  return normalizedA === normalizedB;
}

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
    <div className="border-b border-border py-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
        data-testid={`section-${title.toLowerCase()}`}
      >
        <span className="text-xs font-bold uppercase tracking-wide text-foreground">
          {title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
  testId,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onToggle: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex w-full items-center justify-between rounded-md px-1 py-1.5 hover-elevate"
      data-testid={testId}
    >
      <span className="flex items-center gap-2.5">
        <span
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors"
          style={{
            borderColor: checked ? "hsl(var(--primary))" : "hsl(var(--input))",
            backgroundColor: checked ? "hsl(var(--primary))" : "transparent",
          }}
        >
          {checked && <Check className="h-3 w-3 text-primary-foreground" />}
        </span>
        <span className="text-left text-sm leading-tight text-foreground">
          {label}
        </span>
      </span>
      {count !== undefined && (
        <span className="flex-shrink-0 text-xs text-muted-foreground">
          ({count})
        </span>
      )}
    </button>
  );
}

function Chip({ label, onRemove, testId }: { label: string; onRemove: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="flex items-center gap-1 rounded-full border border-primary-border bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover-elevate"
      data-testid={testId}
    >
      <span className="leading-none">{label}</span>
      <X className="h-3 w-3" />
    </button>
  );
}

interface Props {
  facets: CatalogFacets;
  filters: CatalogFilters;
  onToggle: (key: MultiFilterKey, value: string) => void;
  onPriceChange: (price: [number, number] | null) => void;
  onClearAll: () => void;
}

export default function CatalogFilterSidebar({
  facets,
  filters,
  onToggle,
  onPriceChange,
  onClearAll,
}: Props) {
  const [showAllBrands, setShowAllBrands] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");

  const priceMin = facets.priceMin;
  const priceMax = facets.priceMax || 1;
  const price = filters.price ?? [priceMin, priceMax];

  const clamp = (n: number) =>
    Math.min(priceMax, Math.max(priceMin, Number.isFinite(n) ? n : priceMin));
  const setMin = (raw: number) =>
    onPriceChange([Math.min(clamp(raw), price[1]), price[1]]);
  const setMax = (raw: number) =>
    onPriceChange([price[0], Math.max(clamp(raw), price[0])]);

  const span = Math.max(1, priceMax - priceMin);
  const leftPct = ((price[0] - priceMin) / span) * 100;
  const rightPct = ((price[1] - priceMin) / span) * 100;
  const priceChanged = filters.price !== null;

  const pinnedBrands = PINNED_BRANDS.map((brand) => {
    const match = facets.brands.find((b) => isSameBrand(b.label, brand));
    return { label: match?.label ?? brand, count: match?.count ?? 0 };
  });
  const otherBrands = facets.brands.filter(
    (b) => !PINNED_BRANDS.some((brand) => isSameBrand(b.label, brand)),
  );
  const brandQueryNormalized = normalizeBrand(brandQuery);
  const searchedBrands = [...pinnedBrands, ...otherBrands].filter((b) =>
    normalizeBrand(b.label).includes(brandQueryNormalized),
  );
  const visibleBrands = brandQuery ? searchedBrands : pinnedBrands;
  const expandableBrands = brandQuery || !showAllBrands ? [] : otherBrands;

  const activeCount = countActiveFilters(filters);
  const hasActive = activeCount > 0;

  const chips: { key: MultiFilterKey; value: string; label: string }[] = [];
  filters.marca.forEach((v) => chips.push({ key: "marca", value: v, label: v }));
  filters.tamanho.forEach((v) =>
    chips.push({ key: "tamanho", value: v, label: `Tamanho ${v}` }),
  );
  filters.genero.forEach((v) => chips.push({ key: "genero", value: v, label: v }));
  filters.idade.forEach((v) => chips.push({ key: "idade", value: v, label: v }));
  filters.modalidade.forEach((v) => chips.push({ key: "modalidade", value: v, label: v }));
  filters.avaliacao.forEach((v) => chips.push({ key: "avaliacao", value: v, label: v }));
  filters.desconto.forEach((v) => chips.push({ key: "desconto", value: v, label: v }));
  filters.frete.forEach((v) =>
    chips.push({ key: "frete", value: v, label: `Frete: ${v}` }),
  );

  return (
    <aside className="w-full flex-shrink-0 md:w-[250px]">
      <div
        className="border border-border bg-background px-4 pb-4 md:sticky md:top-[132px] md:max-h-[calc(100vh-148px)] md:overflow-y-auto"
        style={{ scrollbarWidth: "thin" }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background py-4">
          <span className="flex items-center gap-2 text-[15px] font-bold text-foreground">
            <SlidersHorizontal className="h-4 w-4 text-primary" />
            Filtros
            {activeCount > 0 && (
              <span className="text-xs font-semibold text-muted-foreground">
                ({activeCount})
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={onClearAll}
            data-testid="button-limpar-todos"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Limpar todos
          </button>
        </div>

        {/* Selected filters */}
        {hasActive && (
          <div className="border-b border-border py-3" data-testid="active-filters">
            <span className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Filtros selecionados
            </span>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <Chip
                  key={`${c.key}-${c.value}`}
                  label={c.label}
                  onRemove={() => onToggle(c.key, c.value)}
                  testId={`chip-${c.key}-${c.value}`}
                />
              ))}
              {priceChanged && (
                <Chip
                  label={`R$ ${price[0]} – R$ ${price[1]}`}
                  onRemove={() => onPriceChange(null)}
                  testId="chip-price"
                />
              )}
            </div>
          </div>
        )}

        {/* Marca */}
        <Section title="Marca">
          {facets.brands.length > PINNED_BRANDS.length && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)}
                placeholder="Buscar marcas..."
                className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-xs text-foreground outline-none focus:border-primary"
                data-testid="input-brand-search"
              />
            </div>
          )}
          <div className="space-y-0.5">
            {visibleBrands.map((b) => (
              <CheckRow
                key={b.label}
                label={b.label}
                count={b.count}
                checked={filters.marca.includes(b.label)}
                onToggle={() => onToggle("marca", b.label)}
                testId={`filter-marca-${b.label}`}
              />
            ))}
            {expandableBrands.map((b) => (
              <CheckRow
                key={b.label}
                label={b.label}
                count={b.count}
                checked={filters.marca.includes(b.label)}
                onToggle={() => onToggle("marca", b.label)}
                testId={`filter-marca-${b.label}`}
              />
            ))}
            {visibleBrands.length === 0 && (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                Nenhuma marca encontrada
              </p>
            )}
          </div>
          {!brandQuery && otherBrands.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllBrands((s) => !s)}
              data-testid="button-ver-mais-marcas"
              className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary"
            >
              {showAllBrands ? "Ver menos marcas" : "Outras marcas"}
              {showAllBrands ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </Section>

        {/* Tamanho */}
        {facets.sizes.length > 0 && (
          <Section title="Tamanho">
            <div className="grid grid-cols-4 gap-1.5">
              {facets.sizes.map((s) => {
                const selected = filters.tamanho.includes(s.label);
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => onToggle("tamanho", s.label)}
                    aria-pressed={selected}
                    className={
                      selected
                        ? "rounded-md bg-primary py-1.5 text-sm font-semibold text-primary-foreground"
                        : "rounded-md border border-border py-1.5 text-sm text-foreground hover-elevate"
                    }
                    data-testid={`filter-tamanho-${s.label}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Desconto */}
        <Section title="Desconto">
          <div className="space-y-0.5">
            {DESCONTO_BUCKETS.map((b) => (
              <CheckRow
                key={b.label}
                label={b.label}
                count={facets.desconto[b.label]}
                checked={filters.desconto.includes(b.label)}
                onToggle={() => onToggle("desconto", b.label)}
                testId={`filter-desconto-${b.label}`}
              />
            ))}
          </div>
        </Section>

        {/* Preço */}
        <Section title="Preço">
          <div className="relative mb-4 mt-2 h-4">
            <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-muted" />
            <div
              className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
              style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
            />
            <input
              type="range"
              min={priceMin}
              max={priceMax}
              value={price[0]}
              onChange={(e) => setMin(Number(e.target.value))}
              className="beup-range"
              aria-label="Preço mínimo"
              data-testid="range-price-min"
            />
            <input
              type="range"
              min={priceMin}
              max={priceMax}
              value={price[1]}
              onChange={(e) => setMax(Number(e.target.value))}
              className="beup-range"
              aria-label="Preço máximo"
              data-testid="range-price-max"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-[11px] text-muted-foreground">Mínimo:</span>
              <div className="flex items-center rounded-md border border-border px-2 py-1.5">
                <span className="mr-1 text-xs text-muted-foreground">R$</span>
                <input
                  type="number"
                  min={priceMin}
                  max={priceMax}
                  value={price[0]}
                  onChange={(e) => setMin(Number(e.target.value))}
                  className="w-full bg-transparent text-xs text-foreground outline-none"
                  data-testid="input-price-min"
                />
              </div>
            </label>
            <label className="flex-1">
              <span className="mb-1 block text-[11px] text-muted-foreground">Máximo:</span>
              <div className="flex items-center rounded-md border border-border px-2 py-1.5">
                <span className="mr-1 text-xs text-muted-foreground">R$</span>
                <input
                  type="number"
                  min={priceMin}
                  max={priceMax}
                  value={price[1]}
                  onChange={(e) => setMax(Number(e.target.value))}
                  className="w-full bg-transparent text-xs text-foreground outline-none"
                  data-testid="input-price-max"
                />
              </div>
            </label>
          </div>
        </Section>

        {/* Frete Grátis */}
        <Section title="Frete Grátis">
          <div className="space-y-0.5">
            {FRETE_OPTIONS.map((opt) => (
              <CheckRow
                key={opt}
                label={opt}
                count={facets.frete[opt]}
                checked={filters.frete.includes(opt)}
                onToggle={() => onToggle("frete", opt)}
                testId={`filter-frete-${opt}`}
              />
            ))}
          </div>
        </Section>

        {/* Gênero */}
        {facets.generos.length > 0 && (
          <Section title="Gênero">
            <div className="space-y-0.5">
              {facets.generos.map((g) => (
                <CheckRow
                  key={g.label}
                  label={g.label}
                  count={g.count}
                  checked={filters.genero.includes(g.label)}
                  onToggle={() => onToggle("genero", g.label)}
                  testId={`filter-genero-${g.label}`}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Idade */}
        {facets.idades.length > 0 && (
          <Section title="Idade">
            <div className="space-y-0.5">
              {facets.idades.map((i) => (
                <CheckRow
                  key={i.label}
                  label={i.label}
                  count={i.count}
                  checked={filters.idade.includes(i.label)}
                  onToggle={() => onToggle("idade", i.label)}
                  testId={`filter-idade-${i.label}`}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Avaliação */}
        {AVALIACAO_BUCKETS.some((b) => facets.avaliacoes[b.label] > 0) && (
          <Section title="Avaliação">
            <div className="space-y-0.5">
              {AVALIACAO_BUCKETS.filter((b) => facets.avaliacoes[b.label] > 0).map((b) => {
                const checked = filters.avaliacao.includes(b.label);
                return (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => onToggle("avaliacao", b.label)}
                    className="group flex w-full items-center justify-between rounded-md px-1 py-1.5 hover-elevate"
                    data-testid={`filter-avaliacao-${b.min}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[4px] border transition-colors"
                        style={{
                          borderColor: checked ? "hsl(var(--primary))" : "hsl(var(--input))",
                          backgroundColor: checked ? "hsl(var(--primary))" : "transparent",
                        }}
                      >
                        {checked && <Check className="h-3 w-3 text-primary-foreground" />}
                      </span>
                      <span className="flex items-center gap-1 text-left text-sm leading-tight text-foreground">
                        {Array.from({ length: b.min }).map((_, i) => (
                          <Star
                            key={i}
                            className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400"
                          />
                        ))}
                        <span className="ml-0.5">ou mais</span>
                      </span>
                    </span>
                    <span className="flex-shrink-0 text-xs text-muted-foreground">
                      ({facets.avaliacoes[b.label]})
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Tipo de Uso */}
        {facets.modalidades.length > 0 && (
          <Section title="Tipo de Uso">
            <div className="space-y-0.5">
              {facets.modalidades.map((m) => (
                <CheckRow
                  key={m.label}
                  label={m.label}
                  count={m.count}
                  checked={filters.modalidade.includes(m.label)}
                  onToggle={() => onToggle("modalidade", m.label)}
                  testId={`filter-modalidade-${m.label}`}
                />
              ))}
            </div>
          </Section>
        )}

      </div>
    </aside>
  );
}
