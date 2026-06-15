export interface CatalogBestOffer {
  currentPrice: string;
  originalPrice: string | null;
  discountPercent: number | null;
  affiliateUrl: string;
  freeShipping: boolean;
  lastSeenAt?: string;
}

export interface CatalogProduct {
  id: string;
  mainName: string;
  mainImageUrl: string | null;
  brand: { name: string; slug?: string } | null;
  category: { name: string; slug?: string } | null;
  averageRating: number | null;
  totalReviews: number;
  bestOffer: CatalogBestOffer | null;
}

export type MultiFilterKey =
  | "marca"
  | "desconto"
  | "frete"
  | "tamanho"
  | "genero"
  | "idade"
  | "modalidade"
  | "tipo"
  | "avaliacao";

export interface CatalogFilters {
  marca: string[];
  desconto: string[];
  frete: string[];
  tamanho: string[];
  genero: string[];
  idade: string[];
  modalidade: string[];
  tipo: string[];
  avaliacao: string[];
  price: [number, number] | null;
}

export const EMPTY_FILTERS: CatalogFilters = {
  marca: [],
  desconto: [],
  frete: [],
  tamanho: [],
  genero: [],
  idade: [],
  modalidade: [],
  tipo: [],
  avaliacao: [],
  price: null,
};

export const DESCONTO_BUCKETS: { label: string; test: (d: number) => boolean }[] = [
  { label: "50% ou mais", test: (d) => d >= 50 },
  { label: "40% - 49%", test: (d) => d >= 40 && d < 50 },
  { label: "30% - 39%", test: (d) => d >= 30 && d < 40 },
  { label: "20% - 29%", test: (d) => d >= 20 && d < 30 },
  { label: "Até 19%", test: (d) => d > 0 && d < 20 },
];

export const FRETE_OPTIONS = ["Sim", "Não"] as const;

export const AVALIACAO_BUCKETS: { label: string; min: number }[] = [
  { label: "4 estrelas ou mais", min: 4 },
  { label: "3 estrelas ou mais", min: 3 },
  { label: "2 estrelas ou mais", min: 2 },
  { label: "1 estrela ou mais", min: 1 },
];

// Brand and category are detected and persisted server-side at publish time
// (see server/services/productSync.ts), so the catalog reads them directly
// from the API instead of parsing the product title.
export function brandNameOf(p: CatalogProduct): string {
  return p.brand?.name || "Outras";
}

export function categoryNameOf(p: CatalogProduct): string {
  return p.category?.name || "Calçados";
}

// ---------------------------------------------------------------------------
// Atributos derivados do título do produto.
// Como o backend ainda não armazena gênero/tamanho/idade/modalidade por
// produto, derivamos esses dados a partir do título (mesmo padrão usado para
// marca/categoria). Só classificamos quando há sinal claro no texto — produtos
// sem o atributo simplesmente não entram quando aquele filtro está ativo.
// ---------------------------------------------------------------------------

const GENDER_RULES: { label: string; terms: string[] }[] = [
  { label: "Unissex", terms: ["unissex"] },
  { label: "Feminino", terms: ["feminino", "feminina", "menina", "mulher"] },
  { label: "Masculino", terms: ["masculino", "masculina", "menino", "homem"] },
];

export function genderOf(p: CatalogProduct): string | null {
  const lower = p.mainName.toLowerCase();
  for (const rule of GENDER_RULES) {
    if (rule.terms.some((t) => lower.includes(t))) return rule.label;
  }
  return null;
}

const INFANTIL_TERMS = [
  "infantil",
  "criança",
  "crianca",
  "kids",
  "menino",
  "menina",
  "bebê",
  "bebe",
  "juvenil",
  "baby",
];

export function ageOf(p: CatalogProduct): string {
  const lower = p.mainName.toLowerCase();
  return INFANTIL_TERMS.some((t) => lower.includes(t)) ? "Infantil" : "Adulto";
}

// Tamanhos BR de calçado ficam entre 16 e 48. A convenção dos títulos do ML é
// colocar o tamanho logo antes de um "Br" no fim (ex.: "... 40 Br", "... 39.0 Br"),
// então priorizamos esse padrão para não confundir com um tamanho "Eu" que às vezes
// aparece depois (ex.: "... 40 Br ... 35 Eu"). Se não houver "Br", caímos no último
// número isolado de 2 dígitos dentro da faixa (\b...\b ignora códigos de modelo
// como "R7524100020015" ou "Cm6ow43te689").
export function sizeOf(p: CatalogProduct): string | null {
  const brMatch = p.mainName.toLowerCase().match(/\b(\d{2})(?:[.,]0)?\s+br\b/);
  if (brMatch) {
    const n = Number(brMatch[1]);
    if (n >= 16 && n <= 48) return String(n);
  }
  const matches = p.mainName.match(/\b\d{2}\b/g);
  if (!matches) return null;
  const sizes = matches.map(Number).filter((n) => n >= 16 && n <= 48);
  if (sizes.length === 0) return null;
  return String(sizes[sizes.length - 1]);
}

const MODALITY_RULES: { label: string; terms: string[] }[] = [
  { label: "Corrida", terms: ["corrida", "running"] },
  { label: "Caminhada", terms: ["caminhada"] },
  { label: "Treino", terms: ["treino", "academia", "training", "fitness", "crossfit"] },
  { label: "Futebol", terms: ["futebol", "futsal", "society", "chuteira"] },
  { label: "Basquete", terms: ["basquete", "basketball"] },
  { label: "Vôlei", terms: ["vôlei", "volei", "volleyball"] },
  { label: "Skate", terms: ["skate"] },
  {
    label: "Casual",
    terms: ["casual", "slip on", "slip-on", "slipon", "conforto", "passeio", "escolar", "lifestyle"],
  },
];

export function modalityOf(p: CatalogProduct): string | null {
  const lower = p.mainName.toLowerCase();
  for (const rule of MODALITY_RULES) {
    if (rule.terms.some((t) => lower.includes(t))) return rule.label;
  }
  return null;
}

// Tipo de produto. O catálogo é majoritariamente calçado, mas o menu também
// leva para "Acessórios" (meias, bonés, mochilas, etc.). Detectamos acessórios
// por palavras-chave no título; tudo que não casa é tratado como "Calçados".
const ACCESSORY_TERMS = [
  "meia",
  "meias",
  "boné",
  "bone",
  "mochila",
  "bolsa",
  "garrafa",
  "squeeze",
  "viseira",
  "touca",
  "luva",
  "munhequeira",
  "cadarço",
  "cadarco",
  "palmilha",
  "necessaire",
  "pochete",
  "sacola",
  "chaveiro",
  "acessório",
  "acessorio",
];

export const TIPO_OPTIONS = ["Calçados", "Acessórios"] as const;

export function typeOf(p: CatalogProduct): string {
  const lower = p.mainName.toLowerCase();
  return ACCESSORY_TERMS.some((t) => lower.includes(t)) ? "Acessórios" : "Calçados";
}

export function priceOf(p: CatalogProduct): number {
  const raw = p.bestOffer?.currentPrice;
  const n = raw ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : 0;
}

export function discountOf(p: CatalogProduct): number {
  return p.bestOffer?.discountPercent ?? 0;
}

export function ratingOf(p: CatalogProduct): number | null {
  return p.averageRating != null && p.averageRating > 0 ? p.averageRating : null;
}

function matchesAvaliacao(p: CatalogProduct, labels: string[]): boolean {
  if (labels.length === 0) return true;
  const r = ratingOf(p);
  if (r == null) return false;
  return labels.some((label) => {
    const bucket = AVALIACAO_BUCKETS.find((b) => b.label === label);
    return bucket ? r >= bucket.min : false;
  });
}

function matchesDesconto(p: CatalogProduct, labels: string[]): boolean {
  if (labels.length === 0) return true;
  const d = discountOf(p);
  return labels.some((label) => {
    const bucket = DESCONTO_BUCKETS.find((b) => b.label === label);
    return bucket ? bucket.test(d) : false;
  });
}

function matchesFrete(p: CatalogProduct, labels: string[]): boolean {
  if (labels.length === 0) return true;
  const free = p.bestOffer?.freeShipping ?? false;
  return labels.some((l) => (l === "Sim" ? free : !free));
}

export function applyFilters(products: CatalogProduct[], f: CatalogFilters): CatalogProduct[] {
  return products.filter((p) => {
    if (f.marca.length > 0) {
      if (!f.marca.includes(brandNameOf(p))) return false;
    }
    if (!matchesDesconto(p, f.desconto)) return false;
    if (!matchesFrete(p, f.frete)) return false;
    if (f.tamanho.length > 0) {
      const s = sizeOf(p);
      if (!s || !f.tamanho.includes(s)) return false;
    }
    if (f.genero.length > 0) {
      const g = genderOf(p);
      if (!g || !f.genero.includes(g)) return false;
    }
    if (f.idade.length > 0) {
      if (!f.idade.includes(ageOf(p))) return false;
    }
    if (f.modalidade.length > 0) {
      const m = modalityOf(p);
      if (!m || !f.modalidade.includes(m)) return false;
    }
    if (f.tipo.length > 0) {
      if (!f.tipo.includes(typeOf(p))) return false;
    }
    if (!matchesAvaliacao(p, f.avaliacao)) return false;
    if (f.price) {
      const price = priceOf(p);
      if (price < f.price[0] || price > f.price[1]) return false;
    }
    return true;
  });
}

export interface CatalogFacets {
  brands: { label: string; count: number }[];
  desconto: Record<string, number>;
  frete: { Sim: number; Não: number };
  sizes: { label: string; count: number }[];
  generos: { label: string; count: number }[];
  idades: { label: string; count: number }[];
  modalidades: { label: string; count: number }[];
  tipos: { label: string; count: number }[];
  avaliacoes: Record<string, number>;
  priceMin: number;
  priceMax: number;
}

const GENDER_ORDER = ["Masculino", "Feminino", "Unissex"];
const IDADE_ORDER = ["Adulto", "Infantil"];
const TIPO_ORDER = ["Calçados", "Acessórios"];

export function computeFacets(products: CatalogProduct[]): CatalogFacets {
  const brandCounts = new Map<string, number>();
  const sizeCounts = new Map<string, number>();
  const generoCounts = new Map<string, number>();
  const idadeCounts = new Map<string, number>();
  const modalidadeCounts = new Map<string, number>();
  const tipoCounts = new Map<string, number>();
  const desconto: Record<string, number> = {};
  DESCONTO_BUCKETS.forEach((b) => (desconto[b.label] = 0));
  const avaliacoes: Record<string, number> = {};
  AVALIACAO_BUCKETS.forEach((b) => (avaliacoes[b.label] = 0));
  const frete = { Sim: 0, Não: 0 };
  let priceMin = Infinity;
  let priceMax = 0;

  const bump = (m: Map<string, number>, key: string) =>
    m.set(key, (m.get(key) ?? 0) + 1);

  for (const p of products) {
    bump(brandCounts, brandNameOf(p));

    const d = discountOf(p);
    for (const bucket of DESCONTO_BUCKETS) {
      if (bucket.test(d)) desconto[bucket.label]++;
    }

    if (p.bestOffer?.freeShipping) frete.Sim++;
    else frete.Não++;

    const size = sizeOf(p);
    if (size) bump(sizeCounts, size);

    const genero = genderOf(p);
    if (genero) bump(generoCounts, genero);

    bump(idadeCounts, ageOf(p));

    const modalidade = modalityOf(p);
    if (modalidade) bump(modalidadeCounts, modalidade);

    bump(tipoCounts, typeOf(p));

    const rating = ratingOf(p);
    if (rating != null) {
      for (const bucket of AVALIACAO_BUCKETS) {
        if (rating >= bucket.min) avaliacoes[bucket.label]++;
      }
    }

    const price = priceOf(p);
    if (price > 0) {
      priceMin = Math.min(priceMin, price);
      priceMax = Math.max(priceMax, price);
    }
  }

  const brands = Array.from(brandCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const sizes = Array.from(sizeCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => Number(a.label) - Number(b.label));

  const orderedFacet = (m: Map<string, number>, order: string[]) =>
    order
      .filter((label) => m.has(label))
      .map((label) => ({ label, count: m.get(label) ?? 0 }));

  const generos = orderedFacet(generoCounts, GENDER_ORDER);
  const idades = orderedFacet(idadeCounts, IDADE_ORDER);
  const modalidades = Array.from(modalidadeCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
  const tipos = orderedFacet(tipoCounts, TIPO_ORDER);

  return {
    brands,
    desconto,
    frete,
    sizes,
    generos,
    idades,
    modalidades,
    tipos,
    avaliacoes,
    priceMin: Number.isFinite(priceMin) ? Math.floor(priceMin) : 0,
    priceMax: priceMax > 0 ? Math.ceil(priceMax) : 0,
  };
}

export function countActiveFilters(f: CatalogFilters): number {
  return (
    f.marca.length +
    f.desconto.length +
    f.frete.length +
    f.tamanho.length +
    f.genero.length +
    f.idade.length +
    f.modalidade.length +
    f.tipo.length +
    f.avaliacao.length +
    (f.price ? 1 : 0)
  );
}
