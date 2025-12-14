const ML_API_BASE = "https://api.mercadolibre.com";
const ML_SITE_ID = "MLB";
const AFFILIATE_CODE = "14610626";

export interface MLProduct {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  currency_id: string;
  available_quantity: number;
  sold_quantity: number;
  condition: string;
  permalink: string;
  thumbnail: string;
  shipping: {
    free_shipping: boolean;
  };
  attributes: Array<{
    id: string;
    name: string;
    value_name: string;
  }>;
}

export interface MLSearchResponse {
  query: string;
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
  results: MLProduct[];
}

export interface ProcessedProduct {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null;
  discount: number;
  image: string;
  affiliateLink: string;
  freeShipping: boolean;
  brand: string;
  soldQuantity: number;
}

function extractBrand(product: MLProduct): string {
  const brandAttr = product.attributes?.find(
    attr => attr.id === "BRAND" || attr.name === "Marca"
  );
  if (brandAttr?.value_name) return brandAttr.value_name;

  const title = product.title.toLowerCase();
  const brands = ["nike", "adidas", "puma", "mizuno", "asics", "olympikus", "fila", "reebok", "new balance", "under armour", "vans", "converse"];
  
  for (const brand of brands) {
    if (title.includes(brand)) {
      return brand.charAt(0).toUpperCase() + brand.slice(1);
    }
  }
  
  return "Outra";
}

function getHighQualityImage(thumbnail: string): string {
  return thumbnail.replace("-I.jpg", "-O.jpg").replace("http://", "https://");
}

function generateAffiliateLink(permalink: string): string {
  const separator = permalink.includes("?") ? "&" : "?";
  return `${permalink}${separator}matt_tool=${AFFILIATE_CODE}&matt_word=&matt_source=google&matt_campaign_id=${AFFILIATE_CODE}`;
}

function calculateDiscount(originalPrice: number | null, currentPrice: number): number {
  if (!originalPrice || originalPrice <= currentPrice) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

function processProduct(product: MLProduct): ProcessedProduct {
  return {
    id: product.id,
    title: product.title,
    price: product.price,
    originalPrice: product.original_price,
    discount: calculateDiscount(product.original_price, product.price),
    image: getHighQualityImage(product.thumbnail),
    affiliateLink: generateAffiliateLink(product.permalink),
    freeShipping: product.shipping?.free_shipping || false,
    brand: extractBrand(product),
    soldQuantity: product.sold_quantity,
  };
}

export async function searchMLProducts(query: string, limit = 50): Promise<ProcessedProduct[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      condition: "new",
    });

    const response = await fetch(`${ML_API_BASE}/sites/${ML_SITE_ID}/search?${params}`, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`ML API Error: ${response.status}`);
    }

    const data: MLSearchResponse = await response.json();
    return data.results.map(processProduct);
  } catch (error) {
    console.error("Error fetching ML products:", error);
    return [];
  }
}

export async function fetchMLPromotions(): Promise<ProcessedProduct[]> {
  const queries = [
    "tenis corrida promocao",
    "tenis esportivo desconto",
    "chuteira futebol",
    "tenis nike",
    "tenis adidas",
  ];

  const allProducts: ProcessedProduct[] = [];
  const seenIds = new Set<string>();

  for (const query of queries) {
    try {
      const products = await searchMLProducts(query, 20);
      
      for (const product of products) {
        if (!seenIds.has(product.id) && product.discount > 0) {
          seenIds.add(product.id);
          allProducts.push(product);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error fetching "${query}":`, error);
    }
  }

  return allProducts.sort((a, b) => b.discount - a.discount);
}

export async function fetchMLFeaturedProducts(): Promise<ProcessedProduct[]> {
  const queries = [
    "tenis corrida masculino",
    "tenis esportivo feminino",
  ];

  const allProducts: ProcessedProduct[] = [];
  const seenIds = new Set<string>();

  for (const query of queries) {
    try {
      const products = await searchMLProducts(query, 30);
      
      for (const product of products) {
        if (!seenIds.has(product.id)) {
          seenIds.add(product.id);
          allProducts.push(product);
        }
      }
    } catch (error) {
      console.error(`Error fetching "${query}":`, error);
    }
  }

  return allProducts.slice(0, 12);
}
