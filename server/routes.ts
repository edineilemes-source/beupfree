import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  askPerplexity,
  classifyProduct,
  searchProductInfo,
} from "./services/perplexity";
import { mercadoLivreService } from "./services/mercadolivre";
import {
  syncProductsFromML,
  syncBrands,
  syncCategories,
  createTodayPromotions,
  getProductsWithPromotions,
} from "./services/productSync";
import { scrapeAllSources } from "./services/mlScraper";

const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;

export async function registerRoutes(app: Express): Promise<Server> {
  // ============ MERCADO LIVRE OAUTH ============

  // Iniciar fluxo de autorização OAuth
  app.get("/api/ml/auth", (req, res) => {
    if (!ML_CLIENT_ID) {
      return res.status(500).json({ error: "ML_CLIENT_ID não configurado" });
    }

    const redirectUri = `https://${REPLIT_DEV_DOMAIN}/api/ml/callback`;
    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    res.redirect(authUrl);
  });

  // Callback OAuth - recebe código e troca por token
  app.get("/api/ml/callback", async (req, res) => {
    try {
      const { code, error } = req.query;

      if (error) {
        return res.redirect(
          `/triagem?error=${encodeURIComponent(String(error))}`,
        );
      }

      if (!code) {
        return res.redirect("/triagem?error=no_code");
      }

      const redirectUri = `https://${REPLIT_DEV_DOMAIN}/api/ml/callback`;

      const tokenResponse = await fetch(
        "https://api.mercadolibre.com/oauth/token",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: ML_CLIENT_ID!,
            client_secret: ML_CLIENT_SECRET!,
            code: String(code),
            redirect_uri: redirectUri,
          }),
        },
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("OAuth token error:", errorData);
        return res.redirect(`/triagem?error=token_failed`);
      }

      const tokenData = await tokenResponse.json();

      // Salva o token no serviço
      mercadoLivreService.setAccessToken(
        tokenData.access_token,
        tokenData.expires_in,
      );

      console.log(
        "ML OAuth successful! Token expires in:",
        tokenData.expires_in,
        "seconds",
      );

      res.redirect("/triagem?success=true");
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      res.redirect(`/triagem?error=${encodeURIComponent(error.message)}`);
    }
  });

  // Status da autenticação
  app.get("/api/ml/auth-status", (req, res) => {
    res.json({
      authenticated: mercadoLivreService.isAuthenticated(),
      redirectUri: `https://${REPLIT_DEV_DOMAIN}/api/ml/callback`,
    });
  });

  // ============ MERCADO LIVRE ENDPOINTS ============

  // Buscar produtos no Mercado Livre
  app.get("/api/ml/search", async (req, res) => {
    try {
      const { q, limit, offset, sort } = req.query;

      if (!q) {
        return res.status(400).json({ error: "Parâmetro 'q' é obrigatório" });
      }

      const response = await mercadoLivreService.searchProducts(String(q), {
        limit: limit ? parseInt(String(limit)) : 50,
        offset: offset ? parseInt(String(offset)) : 0,
        sort: sort as any,
      });

      res.json({
        total: response.paging.total,
        products: response.results.map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          originalPrice: p.original_price,
          discount: mercadoLivreService.calculateDiscount(
            p.original_price,
            p.price,
          ),
          image: mercadoLivreService.getHighQualityImage(p.thumbnail),
          affiliateLink: mercadoLivreService.generateAffiliateLink(p.permalink),
          freeShipping: p.shipping?.free_shipping,
          brand: mercadoLivreService.extractBrand(p),
          soldQuantity: p.sold_quantity,
        })),
      });
    } catch (error: any) {
      console.error("Erro ao buscar no ML:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Buscar promoções de calçados esportivos
  app.get("/api/ml/promotions", async (req, res) => {
    try {
      const { limit } = req.query;

      const response =
        await mercadoLivreService.fetchSportsFootwearPromotions();

      const products = response.products
        .slice(0, limit ? parseInt(String(limit)) : 50)
        .map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          originalPrice: p.original_price,
          discount: mercadoLivreService.calculateDiscount(
            p.original_price,
            p.price,
          ),
          image: mercadoLivreService.getHighQualityImage(p.thumbnail),
          affiliateLink: mercadoLivreService.generateAffiliateLink(p.permalink),
          freeShipping: p.shipping?.free_shipping,
          brand: mercadoLivreService.extractBrand(p),
          soldQuantity: p.sold_quantity,
        }));

      res.json({
        total: response.totalFound,
        products,
      });
    } catch (error: any) {
      console.error("Erro ao buscar promoções ML:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Scraper de ofertas ML - páginas públicas estratégicas
  app.get("/api/ml/scrape-ofertas", async (req, res) => {
    try {
      const result = await scrapeAllSources();
      res.json({
        fonte: result.fontes.join(", "),
        coletados: result.total,
        entregues: result.produtos.length,
        produtos: result.produtos,
        erros: result.erros,
      });
    } catch (error: any) {
      console.error("Erro no scraper ML:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy para triagem externa (Cloudflare tunnel) - evita CORS
  app.get("/api/ml/triagem-proxy", async (req, res) => {
    try {
      const { enrich } = req.query;
      const tunnelBase = process.env.ML_TUNNEL_BASE_URL;
      if (!tunnelBase) {
        return res
          .status(500)
          .json({ error: "ML_TUNNEL_BASE_URL não configurado" });
      }
      const url = `${tunnelBase.replace(/\/$/, "")}/triagem?enrich=${enrich || "0"}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        const text = await response.text();
        return res
          .status(response.status)
          .json({ error: `Tunnel error: ${response.status}`, details: text });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Erro no proxy triagem tunnel:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy para triagem - retorna dados brutos da API do ML usando autenticação
  app.get("/api/ml/triagem", async (req, res) => {
    try {
      const { q, limit } = req.query;
      const searchQuery = q ? String(q) : "tenis esportivo masculino";
      const searchLimit = limit ? parseInt(String(limit)) : 10;

      // Usa o serviço autenticado do ML
      const response = await mercadoLivreService.searchProducts(searchQuery, {
        limit: searchLimit,
      });

      // Retorna no formato original da API do ML para a página de triagem
      res.json({
        results: response.results,
        paging: response.paging,
      });
    } catch (error: any) {
      console.error("Erro no proxy de triagem:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Sincronizar produtos do ML com banco de dados
  app.post("/api/ml/sync", async (req, res) => {
    try {
      const { query, limit } = req.body;

      const result = await syncProductsFromML({
        query,
        limit: limit || 100,
      });

      await createTodayPromotions();

      res.json({
        success: true,
        synced: result.synced,
        errors: result.errors,
        message: `${result.synced} produtos sincronizados com sucesso!`,
        products: result.products.slice(0, 20),
      });
    } catch (error: any) {
      console.error("Erro ao sincronizar:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PRODUCTS ENDPOINTS ============

  // Listar produtos
  app.get("/api/products", async (req, res) => {
    try {
      const { category, brand, featured, limit, offset, search } = req.query;

      const products = await getProductsWithPromotions();

      let filtered = products;

      if (category) {
        filtered = filtered.filter((p) => p.category?.slug === category);
      }
      if (brand) {
        filtered = filtered.filter((p) => p.brand?.slug === brand);
      }
      if (featured === "true") {
        filtered = filtered.filter((p) => p.isFeatured);
      }
      if (search) {
        const searchLower = String(search).toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(searchLower) ||
            p.brand?.name.toLowerCase().includes(searchLower),
        );
      }

      const start = offset ? parseInt(String(offset)) : 0;
      const end = limit ? start + parseInt(String(limit)) : filtered.length;

      res.json({
        total: filtered.length,
        products: filtered.slice(start, end),
      });
    } catch (error: any) {
      console.error("Erro ao listar produtos:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Detalhes do produto
  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);

      if (!product) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }

      const images = await storage.getProductImages(product.id);
      const brand = product.brandId
        ? await storage.getBrand(product.brandId)
        : null;
      const category = product.categoryId
        ? await storage.getCategory(product.categoryId)
        : null;
      const reviews = await storage.getProductReviews(product.id);

      await storage.incrementProductViews(product.id);

      const price = parseFloat(product.price);
      const originalPrice = product.compareAtPrice
        ? parseFloat(product.compareAtPrice)
        : null;
      const discount = originalPrice
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0;

      res.json({
        ...product,
        images,
        brand,
        category,
        reviews,
        discount,
        formattedPrice: `R$ ${price.toFixed(2).replace(".", ",")}`,
        formattedOriginalPrice: originalPrice
          ? `R$ ${originalPrice.toFixed(2).replace(".", ",")}`
          : null,
      });
    } catch (error: any) {
      console.error("Erro ao buscar produto:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CATEGORIES ENDPOINTS ============

  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ BRANDS ENDPOINTS ============

  app.get("/api/brands", async (req, res) => {
    try {
      const brands = await storage.getBrands();
      res.json(brands);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PROMOTIONS ENDPOINTS ============

  app.get("/api/promotions", async (req, res) => {
    try {
      const promotions = await storage.getActivePromotions();

      const promotionsWithProducts = await Promise.all(
        promotions.map(async (promo) => {
          const products = await storage.getPromotionProducts(promo.id);
          return {
            ...promo,
            products: products.slice(0, 10),
          };
        }),
      );

      res.json(promotionsWithProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ NEWSLETTER ============

  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const { email, name } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email é obrigatório" });
      }

      const isSubscribed = await storage.isSubscribed(email);
      if (isSubscribed) {
        return res.json({ success: true, message: "Você já está inscrito!" });
      }

      await storage.subscribeNewsletter({ email, name });
      res.json({ success: true, message: "Inscrito com sucesso!" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SEARCH HISTORY ============

  app.post("/api/search/log", async (req, res) => {
    try {
      const { query, filters, resultsCount, sessionId, clickedProductId } =
        req.body;

      await storage.logSearch({
        query,
        filters,
        resultsCount,
        sessionId,
        clickedProductId,
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/search/popular", async (req, res) => {
    try {
      const popular = await storage.getPopularSearches(10);
      res.json(popular);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ AI ENDPOINTS (PERPLEXITY) ============

  app.post("/api/ai/ask", async (req, res) => {
    try {
      const { question, systemPrompt } = req.body;

      if (!question) {
        return res
          .status(400)
          .json({ error: "Campo 'question' é obrigatório" });
      }

      const result = await askPerplexity(question, systemPrompt);
      res.json(result);
    } catch (error: any) {
      console.error("Erro ao consultar Perplexity:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/classify", async (req, res) => {
    try {
      const { title, description } = req.body;

      if (!title) {
        return res.status(400).json({ error: "Campo 'title' é obrigatório" });
      }

      const classification = await classifyProduct(title, description);
      res.json(classification);
    } catch (error: any) {
      console.error("Erro ao classificar produto:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/search-product", async (req, res) => {
    try {
      const { productName, brand } = req.body;

      if (!productName || !brand) {
        return res
          .status(400)
          .json({ error: "Campos 'productName' e 'brand' são obrigatórios" });
      }

      const info = await searchProductInfo(productName, brand);
      res.json(info);
    } catch (error: any) {
      console.error("Erro ao buscar informações:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ HEALTH CHECK ============

  app.get("/api/health", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      const brands = await storage.getBrands();
      const products = await storage.getProducts({ limit: 1 });

      res.json({
        status: "ok",
        database: "connected",
        perplexityConfigured: !!process.env.PERPLEXITY_API_KEY,
        stats: {
          categories: categories.length,
          brands: brands.length,
          products: products.length > 0 ? "has_products" : "empty",
        },
      });
    } catch (error: any) {
      res.json({
        status: "ok",
        database: "error",
        perplexityConfigured: !!process.env.PERPLEXITY_API_KEY,
        error: error.message,
      });
    }
  });

  // Endpoint para inicializar dados
  app.post("/api/init", async (req, res) => {
    try {
      const brandMap = await syncBrands();
      const categoryMap = await syncCategories();

      res.json({
        success: true,
        brands: brandMap.size,
        categories: categoryMap.size,
        message: "Dados iniciais criados com sucesso!",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Importar produtos do frontend (contorna bloqueio de servidor da API ML)
  app.post("/api/products/import", async (req, res) => {
    try {
      const { products: importProducts } = req.body;

      if (!importProducts || !Array.isArray(importProducts)) {
        return res
          .status(400)
          .json({
            error: "Campo 'products' é obrigatório e deve ser um array",
          });
      }

      const brands = await storage.getBrands();
      const categories = await storage.getCategories();

      const brandMap = new Map(brands.map((b) => [b.slug, b.id]));
      const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

      let imported = 0;
      let errors = 0;

      for (const p of importProducts) {
        try {
          const brandSlug =
            p.brand?.toLowerCase().replace(/\s+/g, "-") || "outra";
          const categorySlug =
            p.category?.toLowerCase().replace(/\s+/g, "-") || "corrida";

          const existingProduct = await storage.getProductBySku(p.sku || p.id);
          if (existingProduct) {
            await storage.updateProduct(existingProduct.id, {
              name: p.title || p.name,
              price: String(p.price),
              compareAtPrice: p.originalPrice ? String(p.originalPrice) : null,
            });
          } else {
            const product = await storage.createProduct({
              name: p.title || p.name,
              slug: (p.title || p.name)
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .slice(0, 100),
              sku:
                p.sku ||
                p.id ||
                `ML-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              description: p.description || "",
              shortDescription: "",
              price: String(p.price),
              compareAtPrice: p.originalPrice ? String(p.originalPrice) : null,
              costPrice: null,
              brandId: brandMap.get(brandSlug) || brandMap.get("outra") || null,
              categoryId:
                categoryMap.get(categorySlug) ||
                categoryMap.get("corrida") ||
                null,
              isActive: true,
              isFeatured: p.isFeatured || false,
              stock: p.stockQuantity || 100,
              affiliateUrl: p.affiliateLink || p.permalink || null,
              affiliateProductId: p.id,
            });

            if (p.image || p.thumbnail) {
              const imageUrl = (p.image || p.thumbnail)
                .replace("-I.jpg", "-O.jpg")
                .replace("http://", "https://");
              await storage.createProductImage({
                productId: product.id,
                url: imageUrl,
                alt: p.title || p.name,
                isPrimary: true,
                sortOrder: 0,
              });
            }
          }
          imported++;
        } catch (err) {
          console.error("Error importing product:", err);
          errors++;
        }
      }

      res.json({
        success: true,
        imported,
        errors,
        message: `${imported} produtos importados com sucesso!`,
      });
    } catch (error: any) {
      console.error("Erro ao importar produtos:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Popular banco com produtos de demonstração
  app.post("/api/products/seed", async (req, res) => {
    try {
      const brands = await storage.getBrands();
      const categories = await storage.getCategories();

      const brandMap = new Map(brands.map((b) => [b.slug, b.id]));
      const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

      const AFFILIATE_CODE = "14610626";
      const generateAffiliateLink = (mlUrl: string) => {
        const sep = mlUrl.includes("?") ? "&" : "?";
        return `${mlUrl}${sep}matt_tool=${AFFILIATE_CODE}&matt_word=&matt_source=google&matt_campaign_id=${AFFILIATE_CODE}`;
      };

      const demoProducts = [
        {
          name: "Tênis Nike Air Max SC Masculino",
          brand: "nike",
          category: "corrida",
          price: 379.99,
          originalPrice: 549.99,
          image:
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-3569515498-tenis-nike-air-max-sc-masculino-_JM",
          featured: true,
        },
        {
          name: "Tênis Adidas Runfalcon 3.0 Masculino",
          brand: "adidas",
          category: "corrida",
          price: 249.99,
          originalPrice: 349.99,
          image:
            "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-3441891872-tenis-adidas-runfalcon-30-masculino-_JM",
          featured: true,
        },
        {
          name: "Tênis Nike Revolution 6 Masculino",
          brand: "nike",
          category: "corrida",
          price: 279.99,
          originalPrice: 399.99,
          image:
            "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-2766614776-tenis-nike-revolution-6-masculino-_JM",
          featured: true,
        },
        {
          name: "Tênis Olympikus Corre 1 Masculino",
          brand: "olympikus",
          category: "corrida",
          price: 149.99,
          originalPrice: 229.99,
          image:
            "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-2161169389-tenis-olympikus-corre-1-masculino-_JM",
          featured: true,
        },
        {
          name: "Tênis Fila Racer Move Masculino",
          brand: "fila",
          category: "corrida",
          price: 189.99,
          originalPrice: 279.99,
          image:
            "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-2855742448-tenis-fila-racer-move-masculino-_JM",
          featured: true,
        },
        {
          name: "Tênis Puma Transport Masculino",
          brand: "puma",
          category: "corrida",
          price: 199.99,
          originalPrice: 299.99,
          image:
            "https://images.unsplash.com/photo-1605348532760-6753d2c43329?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-3216408552-tenis-puma-transport-masculino-_JM",
          featured: true,
        },
        {
          name: "Chuteira Nike Mercurial Vapor 15 Club",
          brand: "nike",
          category: "futebol",
          price: 349.99,
          originalPrice: 499.99,
          image:
            "https://images.unsplash.com/photo-1511886929837-354d827aae26?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-3893251496-chuteira-nike-mercurial-vapor-15-club-_JM",
          featured: true,
        },
        {
          name: "Chuteira Adidas X Speedportal",
          brand: "adidas",
          category: "futebol",
          price: 279.99,
          originalPrice: 399.99,
          image:
            "https://images.unsplash.com/photo-1509255929945-586a420363cf?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-3165892471-chuteira-adidas-x-speedportal-_JM",
          featured: false,
        },
        {
          name: "Tênis Nike Court Vision Low Masculino",
          brand: "nike",
          category: "casual",
          price: 329.99,
          originalPrice: 449.99,
          image:
            "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-2895671423-tenis-nike-court-vision-low-masculino-_JM",
          featured: true,
        },
        {
          name: "Tênis Adidas Forum Low Masculino",
          brand: "adidas",
          category: "casual",
          price: 399.99,
          originalPrice: 599.99,
          image:
            "https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-3127459812-tenis-adidas-forum-low-masculino-_JM",
          featured: true,
        },
        {
          name: "Tênis Mizuno Wave Rider 27 Masculino",
          brand: "mizuno",
          category: "corrida",
          price: 599.99,
          originalPrice: 899.99,
          image:
            "https://images.unsplash.com/photo-1562183241-b937e95585b6?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-4125876934-tenis-mizuno-wave-rider-27-masculino-_JM",
          featured: true,
        },
        {
          name: "Tênis Asics Gel-Excite 10 Masculino",
          brand: "asics",
          category: "corrida",
          price: 399.99,
          originalPrice: 549.99,
          image:
            "https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=400&h=400&fit=crop",
          mlUrl:
            "https://produto.mercadolivre.com.br/MLB-4678077208-tnis-asics-gel-excite-10-masculino-_JM",
          featured: true,
        },
      ];

      let created = 0;
      for (const p of demoProducts) {
        try {
          const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const existing = await storage.getProductBySlug(slug);
          if (existing) continue;

          const product = await storage.createProduct({
            name: p.name,
            slug,
            sku: `DEMO-${slug}`,
            description: `${p.name} - Qualidade e conforto para seu esporte.`,
            shortDescription: `${p.name} em promoção!`,
            price: String(p.price),
            compareAtPrice: p.originalPrice ? String(p.originalPrice) : null,
            costPrice: null,
            brandId: brandMap.get(p.brand) || null,
            categoryId: categoryMap.get(p.category) || null,
            isActive: true,
            isFeatured: p.featured,
            stock: 50,
            affiliateUrl: generateAffiliateLink((p as any).mlUrl || ""),
            affiliateSource: "mercadolivre",
          });

          await storage.createProductImage({
            productId: product.id,
            url: p.image,
            alt: p.name,
            isPrimary: true,
            sortOrder: 0,
          });

          created++;
        } catch (err) {
          console.error("Error creating demo product:", err);
        }
      }

      // Create today's promotion
      await createTodayPromotions();

      res.json({
        success: true,
        created,
        message: `${created} produtos de demonstração criados!`,
      });
    } catch (error: any) {
      console.error("Erro ao criar produtos demo:", error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
