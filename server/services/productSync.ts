import { storage } from "../storage";
import type { InsertBrand, InsertCategory } from "@shared/schema";

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

export async function syncBrands(): Promise<Map<string, string>> {
  const brandMap = new Map<string, string>();
  
  const defaultBrands = [
    { name: "Nike", slug: "nike", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/200px-Logo_NIKE.svg.png" },
    { name: "Adidas", slug: "adidas", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/20/Adidas_Logo.svg/200px-Adidas_Logo.svg.png" },
    { name: "Puma", slug: "puma", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/d/da/Puma_complete_logo.svg/200px-Puma_complete_logo.svg.png" },
    { name: "Mizuno", slug: "mizuno", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Mizuno_logo.svg/200px-Mizuno_logo.svg.png" },
    { name: "Asics", slug: "asics", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Asics_Logo.svg/200px-Asics_Logo.svg.png" },
    { name: "Olympikus", slug: "olympikus", logo: "" },
    { name: "Fila", slug: "fila", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Fila_logo.svg/200px-Fila_logo.svg.png" },
    { name: "Reebok", slug: "reebok", logo: "" },
    { name: "New Balance", slug: "new-balance", logo: "" },
    { name: "Under Armour", slug: "under-armour", logo: "" },
    { name: "Vans", slug: "vans", logo: "" },
    { name: "Converse", slug: "converse", logo: "" },
    { name: "Outra", slug: "outra", logo: "" },
  ];

  for (const brand of defaultBrands) {
    let existing = await storage.getBrandBySlug(brand.slug);
    if (!existing) {
      existing = await storage.createBrand({
        name: brand.name,
        slug: brand.slug,
        logo: brand.logo || null,
        isActive: true,
        isFeatured: ["Nike", "Adidas", "Puma", "Mizuno", "Asics"].includes(brand.name),
      });
    }
    brandMap.set(brand.name.toLowerCase(), existing.id);
  }

  return brandMap;
}

export async function syncCategories(): Promise<Map<string, string>> {
  const categoryMap = new Map<string, string>();
  
  const defaultCategories = [
    { name: "Corrida", slug: "corrida", icon: "running", description: "Tênis para corrida e running" },
    { name: "Futebol", slug: "futebol", icon: "soccer", description: "Chuteiras e calçados para futebol" },
    { name: "Academia", slug: "academia", icon: "dumbbell", description: "Tênis para treino e musculação" },
    { name: "Casual", slug: "casual", icon: "shoe", description: "Tênis casuais e lifestyle" },
    { name: "Basquete", slug: "basquete", icon: "basketball", description: "Tênis para basquete" },
    { name: "Caminhada", slug: "caminhada", icon: "walk", description: "Tênis para caminhada" },
    { name: "Acessórios", slug: "acessorios", icon: "socks", description: "Meias, palmilhas e acessórios" },
  ];

  for (const category of defaultCategories) {
    let existing = await storage.getCategoryBySlug(category.slug);
    if (!existing) {
      existing = await storage.createCategory({
        name: category.name,
        slug: category.slug,
        icon: category.icon,
        description: category.description,
        isActive: true,
      });
    }
    categoryMap.set(category.slug, existing.id);
  }

  return categoryMap;
}

export function detectCategory(title: string): string {
  const lower = title.toLowerCase();
  
  if (lower.includes("chuteira") || lower.includes("society") || lower.includes("campo") || lower.includes("futsal")) return "futebol";
  if (lower.includes("corrida") || lower.includes("running") || lower.includes("runner")) return "corrida";
  if (lower.includes("academia") || lower.includes("treino") || lower.includes("training") || lower.includes("crossfit")) return "academia";
  if (lower.includes("basquete") || lower.includes("basketball")) return "basquete";
  if (lower.includes("caminhada") || lower.includes("walking")) return "caminhada";
  if (lower.includes("meia") || lower.includes("palmilha") || lower.includes("cadarço")) return "acessorios";
  
  return "casual";
}

// Aliases conhecidos: linhas/produtos que pertencem a marcas mas não trazem o nome
// da marca no título (ex: "Lightmotion" é Adidas, "Court Vision" é Nike, etc.).
const BRAND_ALIASES: Record<string, string> = {
  // Adidas
  lightmotion: "adidas",
  ultraboost: "adidas",
  ultra_boost: "adidas",
  superstar: "adidas",
  ozweego: "adidas",
  galaxy: "adidas",
  duramo: "adidas",
  runfalcon: "adidas",
  questar: "adidas",
  ultimashow: "adidas",
  grand_court: "adidas",
  // Nike
  air_max: "nike",
  airmax: "nike",
  air_force: "nike",
  airforce: "nike",
  pegasus: "nike",
  revolution: "nike",
  downshifter: "nike",
  court_vision: "nike",
  // Puma
  rs_x: "puma",
  suede: "puma",
  cell: "puma",
  // Asics
  gel_: "asics",
  // Olympikus
  corre_: "olympikus",
  // Mizuno
  wave_: "mizuno",
};

const BRAND_LIST = [
  "nike", "adidas", "puma", "mizuno", "asics", "olympikus", "fila",
  "reebok", "new balance", "under armour", "vans", "converse",
];

export function detectBrand(title: string, hintBrand?: string | null): string {
  // 1) Preferir o brand explícito do card do ML (campo .poly-component__brand)
  if (hintBrand) {
    const lowerHint = hintBrand.toLowerCase().trim();
    for (const brand of BRAND_LIST) {
      if (lowerHint.includes(brand)) return brand;
    }
  }

  const lower = title.toLowerCase();

  // 2) Procurar nome da marca no título
  for (const brand of BRAND_LIST) {
    if (lower.includes(brand)) return brand;
  }

  // 3) Aliases (linhas de produto)
  for (const [alias, brand] of Object.entries(BRAND_ALIASES)) {
    const needle = alias.replace(/_/g, " ");
    if (lower.includes(needle)) return brand;
  }

  return "outra";
}

export async function ensureDefaultMarketplace(): Promise<string> {
  const existing = await storage.getMarketplaces();
  const ml = existing.find(m => m.slug === "mercadolivre");
  if (ml) return ml.id;

  const created = await storage.createMarketplace({
    name: "Mercado Livre",
    slug: "mercadolivre",
    baseUrl: "https://www.mercadolivre.com.br",
    affiliateCode: "14610626",
    isActive: true,
  });
  return created.id;
}
