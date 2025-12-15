const ML_API_BASE = "https://api.mercadolibre.com";
const ML_SITE_ID = "MLB"; // Brasil

// Credenciais do Mercado Livre Developer
const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;

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
  thumbnail_id: string;
  accepts_mercadopago: boolean;
  shipping: {
    free_shipping: boolean;
    mode: string;
    logistic_type: string;
  };
  seller: {
    id: number;
    nickname: string;
  };
  attributes: Array<{
    id: string;
    name: string;
    value_name: string;
  }>;
  category_id: string;
}

export interface MLSearchResponse {
  site_id: string;
  country_default_time_zone: string;
  query: string;
  paging: {
    total: number;
    primary_results: number;
    offset: number;
    limit: number;
  };
  results: MLProduct[];
  filters: Array<{
    id: string;
    name: string;
    values: Array<{ id: string; name: string }>;
  }>;
  available_filters: Array<{
    id: string;
    name: string;
    values: Array<{ id: string; name: string; results: number }>;
  }>;
}

export interface MLCategory {
  id: string;
  name: string;
}

export interface MLProductDetails {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  currency_id: string;
  available_quantity: number;
  sold_quantity: number;
  condition: string;
  permalink: string;
  pictures: Array<{
    id: string;
    url: string;
    secure_url: string;
    size: string;
    max_size: string;
  }>;
  attributes: Array<{
    id: string;
    name: string;
    value_name: string;
  }>;
  shipping: {
    free_shipping: boolean;
    mode: string;
  };
  seller_id: number;
  category_id: string;
  warranty: string;
}

class MercadoLivreService {
  private affiliateId: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.affiliateId = process.env.ML_AFFILIATE_ID || "beupfree";
  }

  // Método para definir o token OAuth manualmente (usado pelo callback)
  setAccessToken(token: string, expiresIn: number): void {
    this.accessToken = token;
    this.tokenExpiry = Date.now() + (expiresIn * 1000);
    console.log("ML access token set manually, expires at:", new Date(this.tokenExpiry).toISOString());
  }

  // Verifica se está autenticado
  isAuthenticated(): boolean {
    return !!(this.accessToken && Date.now() < this.tokenExpiry - 300000);
  }

  private async getAccessToken(): Promise<string | null> {
    // Check if we have a valid OAuth token
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    // Token expired or not available
    console.log("No valid ML access token available");
    return null;
  }

  private async fetchApi<T>(endpoint: string): Promise<T> {
    const token = await this.getAccessToken();
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    console.log(`Fetching ML API: ${ML_API_BASE}${endpoint}`);
    
    const response = await fetch(`${ML_API_BASE}${endpoint}`, { headers });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ML API Error: ${response.status} - ${errorText}`);
      throw new Error(`ML API Error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  generateAffiliateLink(permalink: string): string {
    const separator = permalink.includes("?") ? "&" : "?";
    return `${permalink}${separator}matt_tool=14610626&matt_word=&matt_source=google&matt_campaign_id=14610626`;
  }

  async searchProducts(query: string, options?: {
    limit?: number;
    offset?: number;
    sort?: "price_asc" | "price_desc" | "relevance";
    condition?: "new" | "used";
    freeShipping?: boolean;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<MLSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      limit: String(options?.limit || 50),
      offset: String(options?.offset || 0),
    });

    if (options?.sort) {
      params.append("sort", options.sort);
    }
    if (options?.condition) {
      params.append("condition", options.condition);
    }
    if (options?.freeShipping) {
      params.append("shipping", "free");
    }
    if (options?.minPrice) {
      params.append("price", `${options.minPrice}-*`);
    }
    if (options?.maxPrice) {
      params.append("price", `*-${options.maxPrice}`);
    }

    return this.fetchApi<MLSearchResponse>(`/sites/${ML_SITE_ID}/search?${params}`);
  }

  async searchSportsShoes(options?: {
    limit?: number;
    offset?: number;
    sort?: "price_asc" | "price_desc" | "relevance";
    onlyPromotions?: boolean;
  }): Promise<MLSearchResponse> {
    const searches = [
      "tênis corrida",
      "tênis esportivo",
      "chuteira futebol",
      "tênis academia",
      "tênis running",
      "tênis treino",
    ];

    const randomSearch = searches[Math.floor(Math.random() * searches.length)];
    
    return this.searchProducts(randomSearch, {
      limit: options?.limit || 50,
      offset: options?.offset || 0,
      sort: options?.sort || "relevance",
      condition: "new",
    });
  }

  async searchByCategory(categoryId: string, options?: {
    limit?: number;
    offset?: number;
  }): Promise<MLSearchResponse> {
    const params = new URLSearchParams({
      category: categoryId,
      limit: String(options?.limit || 50),
      offset: String(options?.offset || 0),
    });

    return this.fetchApi<MLSearchResponse>(`/sites/${ML_SITE_ID}/search?${params}`);
  }

  async getProductDetails(productId: string): Promise<MLProductDetails> {
    return this.fetchApi<MLProductDetails>(`/items/${productId}`);
  }

  async getMultipleProducts(productIds: string[]): Promise<MLProductDetails[]> {
    const ids = productIds.join(",");
    const response = await this.fetchApi<Array<{ code: number; body: MLProductDetails }>>(`/items?ids=${ids}`);
    return response.filter(r => r.code === 200).map(r => r.body);
  }

  async getCategories(): Promise<MLCategory[]> {
    return this.fetchApi<MLCategory[]>(`/sites/${ML_SITE_ID}/categories`);
  }

  async getCategoryDetails(categoryId: string): Promise<any> {
    return this.fetchApi(`/categories/${categoryId}`);
  }

  async getSportsFootwearCategories(): Promise<string[]> {
    return [
      "MLB264587", // Calçados de Corrida
      "MLB264601", // Chuteiras
      "MLB264586", // Tênis Casual
      "MLB264590", // Tênis de Basquete
      "MLB264588", // Tênis de Treino
      "MLB264589", // Tênis de Caminhada
    ];
  }

  async fetchSportsFootwearPromotions(): Promise<{
    products: MLProduct[];
    totalFound: number;
  }> {
    const allProducts: MLProduct[] = [];
    const queries = [
      "tênis corrida promoção",
      "chuteira futebol oferta",
      "tênis esportivo desconto",
      "tênis nike promoção",
      "tênis adidas oferta",
      "tênis mizuno promoção",
      "tênis puma desconto",
      "tênis asics promoção",
      "tênis olympikus oferta",
      "chuteira nike",
      "chuteira adidas",
    ];

    for (const query of queries) {
      try {
        const response = await this.searchProducts(query, {
          limit: 50,
          condition: "new",
          sort: "relevance",
        });
        
        const productsWithDiscount = response.results.filter(p => 
          p.original_price && p.original_price > p.price
        );
        
        allProducts.push(...productsWithDiscount);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error fetching "${query}":`, error);
      }
    }

    const uniqueProducts = allProducts.reduce((acc, product) => {
      if (!acc.find(p => p.id === product.id)) {
        acc.push(product);
      }
      return acc;
    }, [] as MLProduct[]);

    return {
      products: uniqueProducts,
      totalFound: uniqueProducts.length,
    };
  }

  calculateDiscount(originalPrice: number | null, currentPrice: number): number {
    if (!originalPrice || originalPrice <= currentPrice) return 0;
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  }

  extractBrand(product: MLProduct): string {
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

  extractSize(product: MLProduct): string | null {
    const sizeAttr = product.attributes?.find(
      attr => attr.id === "SIZE" || attr.name === "Tamanho"
    );
    return sizeAttr?.value_name || null;
  }

  extractColor(product: MLProduct): string | null {
    const colorAttr = product.attributes?.find(
      attr => attr.id === "COLOR" || attr.name === "Cor"
    );
    return colorAttr?.value_name || null;
  }

  getHighQualityImage(thumbnail: string): string {
    return thumbnail.replace("-I.jpg", "-O.jpg").replace("http://", "https://");
  }
}

export const mercadoLivreService = new MercadoLivreService();
