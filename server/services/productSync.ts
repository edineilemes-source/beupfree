import { storage } from "../storage";
import { mercadoLivreService, type MLProduct } from "./mercadolivre";
import type { InsertProduct, InsertBrand, InsertCategory, InsertPromotion } from "@shared/schema";

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 100);
}

function generateSku(mlId: string): string {
  return `ML-${mlId}`;
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

function detectCategory(product: MLProduct): string {
  const title = product.title.toLowerCase();
  
  if (title.includes("chuteira") || title.includes("society") || title.includes("campo") || title.includes("futsal")) {
    return "futebol";
  }
  if (title.includes("corrida") || title.includes("running") || title.includes("runner")) {
    return "corrida";
  }
  if (title.includes("academia") || title.includes("treino") || title.includes("training") || title.includes("crossfit")) {
    return "academia";
  }
  if (title.includes("basquete") || title.includes("basketball")) {
    return "basquete";
  }
  if (title.includes("caminhada") || title.includes("walking")) {
    return "caminhada";
  }
  if (title.includes("meia") || title.includes("palmilha") || title.includes("cadarço")) {
    return "acessorios";
  }
  
  return "casual";
}

export async function syncProductsFromML(options?: {
  limit?: number;
  query?: string;
}): Promise<{
  synced: number;
  errors: number;
  products: any[];
}> {
  const brandMap = await syncBrands();
  const categoryMap = await syncCategories();
  
  let mlProducts: MLProduct[] = [];
  
  if (options?.query) {
    const response = await mercadoLivreService.searchProducts(options.query, {
      limit: options.limit || 50,
      condition: "new",
    });
    mlProducts = response.results;
  } else {
    const response = await mercadoLivreService.fetchSportsFootwearPromotions();
    mlProducts = response.products.slice(0, options?.limit || 100);
  }

  let synced = 0;
  let errors = 0;
  const syncedProducts: any[] = [];

  for (const mlProduct of mlProducts) {
    try {
      const sku = generateSku(mlProduct.id);
      const existing = await storage.getProductBySku(sku);
      
      if (existing) {
        await storage.updateProduct(existing.id, {
          price: String(mlProduct.price),
          compareAtPrice: mlProduct.original_price ? String(mlProduct.original_price) : null,
          stock: mlProduct.available_quantity,
        });
        synced++;
        syncedProducts.push({ id: existing.id, action: "updated", title: mlProduct.title });
        continue;
      }

      const brandName = mercadoLivreService.extractBrand(mlProduct);
      const brandId = brandMap.get(brandName.toLowerCase()) || brandMap.get("outra");
      
      const categorySlug = detectCategory(mlProduct);
      const categoryId = categoryMap.get(categorySlug) || categoryMap.get("casual");

      const discount = mercadoLivreService.calculateDiscount(mlProduct.original_price, mlProduct.price);
      const highQualityImage = mercadoLivreService.getHighQualityImage(mlProduct.thumbnail);
      const affiliateLink = mercadoLivreService.generateAffiliateLink(mlProduct.permalink);

      const productData: InsertProduct = {
        sku,
        name: mlProduct.title,
        slug: generateSlug(mlProduct.title) + "-" + mlProduct.id.slice(-6),
        description: `Produto do Mercado Livre. ${mlProduct.condition === "new" ? "Novo" : "Usado"}. ${mlProduct.shipping?.free_shipping ? "Frete grátis!" : ""}`,
        shortDescription: mlProduct.title.substring(0, 150),
        price: String(mlProduct.price),
        compareAtPrice: mlProduct.original_price ? String(mlProduct.original_price) : null,
        stock: mlProduct.available_quantity,
        categoryId: categoryId || null,
        brandId: brandId || null,
        attributes: {
          color: mercadoLivreService.extractColor(mlProduct) || undefined,
          size: mercadoLivreService.extractSize(mlProduct) || undefined,
          condition: mlProduct.condition,
          freeShipping: mlProduct.shipping?.free_shipping,
        },
        tags: [brandName.toLowerCase(), categorySlug, "mercadolivre"],
        isActive: true,
        isFeatured: discount >= 30,
        isNewArrival: false,
        affiliateUrl: affiliateLink,
        affiliateSource: "mercadolivre",
        affiliateProductId: mlProduct.id,
      };

      const created = await storage.createProduct(productData);

      await storage.createProductImage({
        productId: created.id,
        url: highQualityImage,
        alt: mlProduct.title,
        isPrimary: true,
        sortOrder: 0,
      });

      synced++;
      syncedProducts.push({ 
        id: created.id, 
        action: "created", 
        title: mlProduct.title,
        discount,
        price: mlProduct.price,
        originalPrice: mlProduct.original_price,
      });
    } catch (error) {
      console.error(`Error syncing product ${mlProduct.id}:`, error);
      errors++;
    }
  }

  return { synced, errors, products: syncedProducts };
}

export async function createTodayPromotions(): Promise<any> {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const existingPromo = await storage.getPromotions({ isActive: true, isPriority: true });
  const todayPromo = existingPromo.find(p => p.slug === "promocoes-do-dia");
  
  if (todayPromo) {
    return todayPromo;
  }

  const promotion = await storage.createPromotion({
    name: "Promoções do Dia",
    slug: "promocoes-do-dia",
    description: "As melhores ofertas de calçados esportivos de hoje!",
    type: "percentage",
    value: "0",
    startDate: now,
    endDate: endOfDay,
    isActive: true,
    isPriority: true,
    badgeText: "HOJE",
    badgeColor: "#ef4444",
  });

  const products = await storage.getProducts({ isFeatured: true, limit: 20 });
  
  for (const product of products) {
    try {
      await storage.addProductToPromotion(promotion.id, product.id);
    } catch (e) {
    }
  }

  return promotion;
}

export async function getProductsWithPromotions(): Promise<any[]> {
  const products = await storage.getProducts({ isActive: true, limit: 50 });
  
  const productsWithImages = await Promise.all(
    products.map(async (product) => {
      const images = await storage.getProductImages(product.id);
      const brand = product.brandId ? await storage.getBrand(product.brandId) : null;
      const category = product.categoryId ? await storage.getCategory(product.categoryId) : null;
      
      const price = parseFloat(product.price);
      const originalPrice = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
      const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

      return {
        ...product,
        images,
        brand,
        category,
        discount,
        formattedPrice: `R$ ${price.toFixed(2).replace(".", ",")}`,
        formattedOriginalPrice: originalPrice ? `R$ ${originalPrice.toFixed(2).replace(".", ",")}` : null,
      };
    })
  );

  return productsWithImages;
}
