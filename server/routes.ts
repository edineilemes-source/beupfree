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

      const demoProducts = [
        { name: "Nike Air Max 270", brand: "nike", category: "corrida", price: 799.90, originalPrice: 999.90, image: "https://static.nike.com/a/images/c_limit,w_592,f_auto/t_product_v1/e0b3e476-4a2c-4e5f-bb9e-e0c83cf5d5a4/tenis-air-max-270-XRBc3p.png", featured: true },
        { name: "Adidas Ultraboost 22", brand: "adidas", category: "corrida", price: 899.90, originalPrice: 1199.90, image: "https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/19fa95e5de9e47d587f8ad7a00f81ee1_9366/Tenis_Ultraboost_22_Preto_GZ0127_01_standard.jpg", featured: true },
        { name: "Nike Revolution 6", brand: "nike", category: "corrida", price: 299.90, originalPrice: 399.90, image: "https://static.nike.com/a/images/c_limit,w_592,f_auto/t_product_v1/8e1d9c2f-5c3e-4c1c-9c3f-5e5b5f5a5a5a/tenis-revolution-6-2vVb3p.png", featured: false },
        { name: "Puma RS-X3", brand: "puma", category: "casual", price: 599.90, originalPrice: 749.90, image: "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_600,h_600/global/374915/01/sv01/fnd/BRA/fmt/png/T%C3%AAnis-RS-X3-Puzzle", featured: true },
        { name: "Mizuno Wave Rider 26", brand: "mizuno", category: "corrida", price: 699.90, originalPrice: 899.90, image: "https://images.mizuno.com.br/produtos/4148970-0099_tenis-mizuno-wave-rider-26/01.jpg", featured: true },
        { name: "Asics Gel-Nimbus 25", brand: "asics", category: "corrida", price: 899.90, originalPrice: 1099.90, image: "https://images.asics.com/is/image/asics/1011B547_020_SR_RT_GLB?wid=500&hei=500&fmt=jpg", featured: true },
        { name: "Nike Mercurial Vapor 15", brand: "nike", category: "futebol", price: 599.90, originalPrice: 799.90, image: "https://static.nike.com/a/images/c_limit,w_592,f_auto/t_product_v1/0d0e0e0e-0e0e-0e0e-0e0e-0e0e0e0e0e0e/chuteira-mercurial-vapor-15.png", featured: true },
        { name: "Adidas Predator Edge", brand: "adidas", category: "futebol", price: 549.90, originalPrice: 699.90, image: "https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e7e/Chuteira_Predator_Edge.jpg", featured: false },
        { name: "Nike Metcon 8", brand: "nike", category: "academia", price: 649.90, originalPrice: 799.90, image: "https://static.nike.com/a/images/c_limit,w_592,f_auto/t_product_v1/1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a/tenis-metcon-8.png", featured: false },
        { name: "Adidas Forum Low", brand: "adidas", category: "casual", price: 499.90, originalPrice: 599.90, image: "https://assets.adidas.com/images/h_840,f_auto,q_auto,fl_lossy,c_fill,g_auto/2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b/Tenis_Forum_Low.jpg", featured: true },
        { name: "Olympikus Corre 1", brand: "olympikus", category: "corrida", price: 199.90, originalPrice: 279.90, image: "https://static.dafiti.com.br/p/olympikus-tenis-olympikus-corre-1-masculino-preto-8888-8888881-1-zoom.jpg", featured: false },
        { name: "Fila Racer Move", brand: "fila", category: "corrida", price: 249.90, originalPrice: 329.90, image: "https://fila.vtexassets.com/arquivos/ids/275547-800-800?v=638046604785470000&width=800&height=800&aspect=true", featured: false },
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
            affiliateUrl: null,
            sourceUrl: null,
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
