import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { askPerplexity, classifyProduct, searchProductInfo } from "./services/perplexity";
import { mercadoLivreService } from "./services/mercadolivre";
import { syncProductsFromML, syncBrands, syncCategories, createTodayPromotions, getProductsWithPromotions } from "./services/productSync";

export async function registerRoutes(app: Express): Promise<Server> {
  
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
        products: response.results.map(p => ({
          id: p.id,
          title: p.title,
          price: p.price,
          originalPrice: p.original_price,
          discount: mercadoLivreService.calculateDiscount(p.original_price, p.price),
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
      
      const response = await mercadoLivreService.fetchSportsFootwearPromotions();

      const products = response.products
        .slice(0, limit ? parseInt(String(limit)) : 50)
        .map(p => ({
          id: p.id,
          title: p.title,
          price: p.price,
          originalPrice: p.original_price,
          discount: mercadoLivreService.calculateDiscount(p.original_price, p.price),
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
        filtered = filtered.filter(p => p.category?.slug === category);
      }
      if (brand) {
        filtered = filtered.filter(p => p.brand?.slug === brand);
      }
      if (featured === "true") {
        filtered = filtered.filter(p => p.isFeatured);
      }
      if (search) {
        const searchLower = String(search).toLowerCase();
        filtered = filtered.filter(p => 
          p.name.toLowerCase().includes(searchLower) ||
          p.brand?.name.toLowerCase().includes(searchLower)
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
      const brand = product.brandId ? await storage.getBrand(product.brandId) : null;
      const category = product.categoryId ? await storage.getCategory(product.categoryId) : null;
      const reviews = await storage.getProductReviews(product.id);

      await storage.incrementProductViews(product.id);

      const price = parseFloat(product.price);
      const originalPrice = product.compareAtPrice ? parseFloat(product.compareAtPrice) : null;
      const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

      res.json({
        ...product,
        images,
        brand,
        category,
        reviews,
        discount,
        formattedPrice: `R$ ${price.toFixed(2).replace(".", ",")}`,
        formattedOriginalPrice: originalPrice ? `R$ ${originalPrice.toFixed(2).replace(".", ",")}` : null,
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
        })
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
      const { query, filters, resultsCount, sessionId, clickedProductId } = req.body;
      
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
        return res.status(400).json({ error: "Campo 'question' é obrigatório" });
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
        return res.status(400).json({ error: "Campos 'productName' e 'brand' são obrigatórios" });
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
        }
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
        return res.status(400).json({ error: "Campo 'products' é obrigatório e deve ser um array" });
      }

      const brands = await storage.getBrands();
      const categories = await storage.getCategories();
      
      const brandMap = new Map(brands.map(b => [b.slug, b.id]));
      const categoryMap = new Map(categories.map(c => [c.slug, c.id]));

      let imported = 0;
      let errors = 0;

      for (const p of importProducts) {
        try {
          const brandSlug = p.brand?.toLowerCase().replace(/\s+/g, '-') || 'outra';
          const categorySlug = p.category?.toLowerCase().replace(/\s+/g, '-') || 'corrida';
          
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
              slug: (p.title || p.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 100),
              sku: p.sku || p.id || `ML-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              description: p.description || '',
              shortDescription: '',
              price: String(p.price),
              compareAtPrice: p.originalPrice ? String(p.originalPrice) : null,
              costPrice: null,
              brandId: brandMap.get(brandSlug) || brandMap.get('outra') || null,
              categoryId: categoryMap.get(categorySlug) || categoryMap.get('corrida') || null,
              isActive: true,
              isFeatured: p.isFeatured || false,
              stockQuantity: p.stockQuantity || 100,
              affiliateUrl: p.affiliateLink || p.permalink || null,
              sourceUrl: p.permalink || null,
              metadata: {
                mlId: p.id,
                soldQuantity: p.soldQuantity,
                freeShipping: p.freeShipping,
              },
            });

            if (p.image || p.thumbnail) {
              const imageUrl = (p.image || p.thumbnail).replace("-I.jpg", "-O.jpg").replace("http://", "https://");
              await storage.createProductImage({
                productId: product.id,
                url: imageUrl,
                altText: p.title || p.name,
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
      
      const brandMap = new Map(brands.map(b => [b.slug, b.id]));
      const categoryMap = new Map(categories.map(c => [c.slug, c.id]));

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
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_946029-MLB72036506233_102023-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/tenis-nike-air-max-sc-masculino/p/MLB21907858",
          featured: true 
        },
        { 
          name: "Tênis Adidas Runfalcon 3.0 Masculino", 
          brand: "adidas", 
          category: "corrida", 
          price: 249.99, 
          originalPrice: 349.99, 
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_928936-MLA54968820490_042023-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/tenis-adidas-runfalcon-30-masculino/p/MLB21221990",
          featured: true 
        },
        { 
          name: "Tênis Nike Revolution 6 Next Nature Masculino", 
          brand: "nike", 
          category: "corrida", 
          price: 279.99, 
          originalPrice: 399.99, 
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_853689-MLB52505996877_112022-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/tenis-nike-revolution-6-next-nature-masculino/p/MLB17050389",
          featured: true 
        },
        { 
          name: "Tênis Olympikus Corre 1 Masculino", 
          brand: "olympikus", 
          category: "corrida", 
          price: 149.99, 
          originalPrice: 229.99, 
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_865115-MLB49715652757_042022-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/tenis-olympikus-corre-1-masculino/p/MLB18183837",
          featured: true 
        },
        { 
          name: "Tênis Fila Racer Move Masculino", 
          brand: "fila", 
          category: "corrida", 
          price: 189.99, 
          originalPrice: 279.99, 
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_615691-MLB51339082730_082022-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/tenis-fila-racer-move-masculino/p/MLB19108729",
          featured: true 
        },
        { 
          name: "Tênis Puma Transport Masculino", 
          brand: "puma", 
          category: "corrida", 
          price: 199.99, 
          originalPrice: 299.99, 
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_739467-MLB54542899694_032023-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/tenis-puma-transport-masculino/p/MLB21099929",
          featured: true 
        },
        { 
          name: "Chuteira Nike Mercurial Vapor 15 Club FG/MG", 
          brand: "nike", 
          category: "futebol", 
          price: 349.99, 
          originalPrice: 499.99, 
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_846099-MLB72661232574_112023-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/chuteira-nike-mercurial-vapor-15-club-fgmg/p/MLB22134829",
          featured: true 
        },
        { 
          name: "Chuteira Adidas X Speedportal.4 FXG", 
          brand: "adidas", 
          category: "futebol", 
          price: 279.99, 
          originalPrice: 399.99, 
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_718505-MLB54171608653_032023-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/chuteira-adidas-x-speedportal4-fxg/p/MLB20987609",
          featured: false 
        },
        { 
          name: "Tênis Nike Court Vision Low Masculino", 
          brand: "nike", 
          category: "casual", 
          price: 329.99, 
          originalPrice: 449.99, 
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_932660-MLB51869254149_102022-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/tenis-nike-court-vision-low-masculino/p/MLB15816181",
          featured: true 
        },
        { 
          name: "Tênis Adidas Forum Low Masculino", 
          brand: "adidas", 
          category: "casual", 
          price: 399.99, 
          originalPrice: 599.99, 
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_621298-MLB53102953088_012023-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/tenis-adidas-forum-low-masculino/p/MLB19785427",
          featured: true 
        },
        { 
          name: "Tênis Mizuno Wave Rider 27 Masculino", 
          brand: "mizuno", 
          category: "corrida", 
          price: 599.99, 
          originalPrice: 899.99, 
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_693989-MLB73847048097_012024-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/tenis-mizuno-wave-rider-27-masculino/p/MLB23006541",
          featured: true 
        },
        { 
          name: "Tênis Asics Gel-Excite 10 Masculino", 
          brand: "asics", 
          category: "corrida", 
          price: 399.99, 
          originalPrice: 549.99, 
          image: "https://http2.mlstatic.com/D_NQ_NP_2X_656108-MLB73020474412_112023-F.webp",
          mlUrl: "https://www.mercadolivre.com.br/tenis-asics-gel-excite-10-masculino/p/MLB22648927",
          featured: true 
        },
      ];

      let created = 0;
      for (const p of demoProducts) {
        try {
          const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
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
            stockQuantity: 50,
            affiliateUrl: generateAffiliateLink((p as any).mlUrl || ""),
            sourceUrl: (p as any).mlUrl || null,
            metadata: { demo: true },
          });

          await storage.createProductImage({
            productId: product.id,
            url: p.image,
            altText: p.name,
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
