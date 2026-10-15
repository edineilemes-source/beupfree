import type { CatalogProduct } from "./catalogFilters";

// Explicitly opt-in, browser-only preview. Never includes live merchant links.
const brands = ["Nike", "Adidas", "Olympikus", "Asics", "Puma"];
const models = ["Corrida", "Casual", "Treino", "Caminhada", "Basquete"];
const products: CatalogProduct[] = Array.from({ length: 45 }, (_, i) => {
  const brand = brands[i % brands.length];
  const size = 38 + (i % 5);
  const gender = i % 3 === 0 ? "feminino" : "masculino";
  const original = 300 + (i % 6) * 80;
  const discount = 15 + (i % 7) * 10;
  const current = Math.round(original * (1 - discount / 100) * 100) / 100;
  return {
    id: `preview-${i + 1}`,
    mainName: `Tênis ${brand} ${models[i % models.length]} ${size} Br`,
    gender,
    mainImageUrl: `/organizer-preview-shoe.svg`,
    primaryColor: i % 2 ? "Preto" : "Branco",
    brand: { name: brand },
    category: { name: "Tênis" },
    averageRating: 4 + (i % 10) / 10,
    totalReviews: 10 + i,
    catalogSource: "demo",
    demonstrative: true,
    bestOffer: {
      currentPrice: String(current),
      originalPrice: String(original),
      discountPercent: discount,
      affiliateUrl: "",
      marketplaceName: null,
      sellerName: null,
      freeShipping: i % 2 === 0,
      demonstrative: true,
    },
  };
});

export function demoCatalogResponse() {
  return {
    total: products.length,
    serverDriven: false,
    catalogSource: "demo" as const,
    demonstrative: true,
    products,
  };
}
