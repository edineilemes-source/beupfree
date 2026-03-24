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
  syncBrands,
  syncCategories,
  ensureDefaultMarketplace,
} from "./services/productSync";
import { scrapeAllSources } from "./services/mlScraper";
import { runCollectJob } from "./jobs/collect";
import { registerAdminCollectionsRoutes } from "./routes/adminCollections";
import brandSectionsRouter from "./routes/brandSections";
import dealSectionsRouter from "./routes/dealSections";
import { startScheduler } from "./jobs/scheduler";

const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;

export async function registerRoutes(app: Express): Promise<Server> {
  // ============ MERCADO LIVRE OAUTH ============

  app.get("/api/ml/auth", (req, res) => {
    if (!ML_CLIENT_ID) {
      return res.status(500).json({ error: "ML_CLIENT_ID não configurado" });
    }
    const redirectUri = `https://${REPLIT_DEV_DOMAIN}/api/ml/callback`;
    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    res.redirect(authUrl);
  });

  app.get("/api/ml/callback", async (req, res) => {
    try {
      const { code, error } = req.query;
      if (error) return res.redirect(`/admin/triagem?error=${encodeURIComponent(String(error))}`);
      if (!code) return res.redirect("/admin/triagem?error=no_code");

      const redirectUri = `https://${REPLIT_DEV_DOMAIN}/api/ml/callback`;
      const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: ML_CLIENT_ID!,
          client_secret: ML_CLIENT_SECRET!,
          code: String(code),
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        console.error("OAuth token error:", await tokenResponse.text());
        return res.redirect(`/admin/triagem?error=token_failed`);
      }

      const tokenData = await tokenResponse.json();
      mercadoLivreService.setAccessToken(tokenData.access_token, tokenData.expires_in);
      res.redirect("/admin/triagem?success=true");
    } catch (error: any) {
      console.error("OAuth callback error:", error);
      res.redirect(`/admin/triagem?error=${encodeURIComponent(error.message)}`);
    }
  });

  app.get("/api/ml/auth-status", (req, res) => {
    res.json({
      authenticated: mercadoLivreService.isAuthenticated(),
      redirectUri: `https://${REPLIT_DEV_DOMAIN}/api/ml/callback`,
    });
  });

  // ============ ML SCRAPER ============

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

  // ============ ADMIN: COLLECTION PIPELINE ============

  app.post("/api/admin/collect", async (req, res) => {
    try {
      const result = await runCollectJob();
      res.json(result);
    } catch (error: any) {
      console.error("Erro na coleta:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ADMIN: TRIAGE ============

  app.get("/api/admin/triage", async (req, res) => {
    try {
      const { status, limit, offset, brand } = req.query;
      const brandParam = brand ? String(brand).replace(/-/g, ' ') : undefined;
      const items = await storage.getTriageQueue({
        status: status ? String(status) : 'pending',
        limit: limit ? parseInt(String(limit)) : 200,
        offset: offset ? parseInt(String(offset)) : 0,
        brand: brandParam,
      });

      // Fetch all sources once for source name lookup
      const sources = await storage.getCollectionSources();
      const sourceMap = new Map(sources.map(s => [s.id, s.name]));

      const enriched = await Promise.all(
        items.map(async (item) => {
          const processed = await storage.getProcessedItem(item.processedItemId);
          const sourceName = item.collectionSourceId ? (sourceMap.get(item.collectionSourceId) ?? null) : null;
          return { ...item, processedItem: processed, sourceName };
        })
      );

      res.json({ total: enriched.length, items: enriched });
    } catch (error: any) {
      console.error("Erro ao listar triagem:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk approve
  app.post("/api/admin/triage/bulk-approve", async (req, res) => {
    try {
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids must be a non-empty array" });
      }

      const results = await Promise.allSettled(ids.map(async (id) => {
        const triageItem = await storage.getTriageItem(id);
        if (!triageItem) throw new Error(`${id} not found`);
        const processed = await storage.getProcessedItem(triageItem.processedItemId);
        if (!processed) throw new Error(`processed item not found for ${id}`);

        const finalName = processed.normalizedTitle;
        const slug = finalName
          .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
          .substring(0, 80) + "-" + Date.now().toString(36);

        const product = await storage.createProduct({
          mainName: finalName, slug,
          brandId: triageItem.suggestedBrandId ?? null,
          mainCategoryId: triageItem.suggestedCategoryId ?? null,
          mainImageUrl: processed.imageUrl,
          catalogStatus: 'published',
          shortDescription: finalName,
        });

        const marketplaceId = await ensureDefaultMarketplace();
        const offer = await storage.createOffer({
          productId: product.id, marketplaceId,
          currentPrice: String(processed.price),
          originalPrice: processed.originalPrice ?? null,
          discountPercent: processed.discountPercent,
          originalUrl: processed.sourceUrl,
          affiliateUrl: processed.affiliateUrl,
          freeShipping: processed.freeShipping,
          externalId: processed.externalId,
          status: 'active',
        });

        await storage.updateTriageItem(id, { status: 'approved', resolvedAt: new Date() });
        await storage.createCurationAction({ triageItemId: id, action: 'approve', resultProductId: product.id, resultOfferId: offer.id });
        if (processed.imageUrl) {
          await storage.createProductImage({ productId: product.id, url: processed.imageUrl, alt: finalName, isPrimary: true, sortOrder: 0 });
        }
        return id;
      }));

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      res.json({ succeeded, failed });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk reject
  app.post("/api/admin/triage/bulk-reject", async (req, res) => {
    try {
      const { ids, reason } = req.body as { ids: string[]; reason?: string };
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "ids must be a non-empty array" });
      }

      const results = await Promise.allSettled(ids.map(async (id) => {
        const triageItem = await storage.getTriageItem(id);
        if (!triageItem) throw new Error(`${id} not found`);
        await storage.updateTriageItem(id, { status: 'rejected', resolvedAt: new Date() });
        await storage.createCurationAction({ triageItemId: id, action: 'reject', rejectionReason: reason ?? 'Rejeitado em lote' });
        return id;
      }));

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      res.json({ succeeded, failed });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/triage/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;
      const { productName, brandId, categoryId } = req.body;

      const triageItem = await storage.getTriageItem(id);
      if (!triageItem) return res.status(404).json({ error: "Item não encontrado" });

      const processed = await storage.getProcessedItem(triageItem.processedItemId);
      if (!processed) return res.status(404).json({ error: "Item processado não encontrado" });

      const finalName = productName || processed.normalizedTitle;
      const slug = finalName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 100) + "-" + Date.now().toString(36);

      const product = await storage.createProduct({
        mainName: finalName,
        slug,
        brandId: brandId || triageItem.suggestedBrandId || null,
        mainCategoryId: categoryId || triageItem.suggestedCategoryId || null,
        mainImageUrl: processed.imageUrl,
        catalogStatus: 'published',
        shortDescription: processed.normalizedTitle,
      });

      const marketplaceId = await ensureDefaultMarketplace();

      const offer = await storage.createOffer({
        productId: product.id,
        marketplaceId,
        currentPrice: String(processed.price),
        originalPrice: processed.originalPrice ? String(processed.originalPrice) : null,
        discountPercent: processed.discountPercent,
        originalUrl: processed.sourceUrl,
        affiliateUrl: processed.affiliateUrl,
        freeShipping: processed.freeShipping,
        externalId: processed.externalId,
        status: 'active',
      });

      await storage.updateTriageItem(id, { status: 'approved', resolvedAt: new Date() });

      await storage.createCurationAction({
        triageItemId: id,
        action: 'approve',
        resultProductId: product.id,
        resultOfferId: offer.id,
      });

      if (processed.imageUrl) {
        await storage.createProductImage({
          productId: product.id,
          url: processed.imageUrl,
          alt: finalName,
          isPrimary: true,
          sortOrder: 0,
        });
      }

      res.json({ success: true, product, offer });
    } catch (error: any) {
      console.error("Erro ao aprovar item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/triage/:id/reject", async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const triageItem = await storage.getTriageItem(id);
      if (!triageItem) return res.status(404).json({ error: "Item não encontrado" });

      await storage.updateTriageItem(id, { status: 'rejected', resolvedAt: new Date() });

      await storage.createCurationAction({
        triageItemId: id,
        action: 'reject',
        rejectionReason: reason || 'Rejeitado pelo curador',
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Erro ao rejeitar item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PUBLIC: CATALOG (products + offers) ============

  app.get("/api/products", async (req, res) => {
    try {
      const { category, brand, limit, offset, search } = req.query;

      const publishedProducts = await storage.getProducts({
        status: 'published',
        limit: limit ? parseInt(String(limit)) : 50,
        offset: offset ? parseInt(String(offset)) : 0,
        search: search ? String(search) : undefined,
      });

      const productsWithOffers = await Promise.all(
        publishedProducts.map(async (product) => {
          const productOffers = await storage.getOffers({ productId: product.id, status: 'active' });
          const images = await storage.getProductImages(product.id);
          const brandData = product.brandId ? await storage.getBrand(product.brandId) : null;
          const categoryData = product.mainCategoryId ? await storage.getCategory(product.mainCategoryId) : null;

          const bestOffer = productOffers.sort((a, b) => parseFloat(a.currentPrice) - parseFloat(b.currentPrice))[0];

          return {
            ...product,
            images,
            brand: brandData,
            category: categoryData,
            bestOffer: bestOffer ? {
              id: bestOffer.id,
              currentPrice: bestOffer.currentPrice,
              originalPrice: bestOffer.originalPrice,
              discountPercent: bestOffer.discountPercent,
              affiliateUrl: bestOffer.affiliateUrl,
              freeShipping: bestOffer.freeShipping,
              lastSeenAt: bestOffer.lastSeenAt,
              formattedPrice: `R$ ${parseFloat(bestOffer.currentPrice).toFixed(2).replace(".", ",")}`,
              formattedOriginalPrice: bestOffer.originalPrice ? `R$ ${parseFloat(bestOffer.originalPrice).toFixed(2).replace(".", ",")}` : null,
            } : null,
            offersCount: productOffers.length,
          };
        })
      );

      let filtered = productsWithOffers;
      if (category) filtered = filtered.filter(p => p.category?.slug === category);
      if (brand) filtered = filtered.filter(p => p.brand?.slug === brand);

      res.json({ total: filtered.length, products: filtered });
    } catch (error: any) {
      console.error("Erro ao listar produtos:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ error: "Produto não encontrado" });

      const productOffers = await storage.getOffers({ productId: product.id, status: 'active' });
      const images = await storage.getProductImages(product.id);
      const brandData = product.brandId ? await storage.getBrand(product.brandId) : null;
      const categoryData = product.mainCategoryId ? await storage.getCategory(product.mainCategoryId) : null;

      res.json({
        ...product,
        images,
        brand: brandData,
        category: categoryData,
        offers: productOffers.map(o => ({
          ...o,
          formattedPrice: `R$ ${parseFloat(o.currentPrice).toFixed(2).replace(".", ",")}`,
          formattedOriginalPrice: o.originalPrice ? `R$ ${parseFloat(o.originalPrice).toFixed(2).replace(".", ",")}` : null,
        })),
      });
    } catch (error: any) {
      console.error("Erro ao buscar produto:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PUBLIC: AFFILIATE CLICK TRACKING ============

  app.get("/api/click/:offerId", async (req, res) => {
    try {
      const offer = await storage.getOffer(req.params.offerId);
      if (!offer || !offer.affiliateUrl) {
        return res.status(404).json({ error: "Oferta não encontrada" });
      }

      await storage.createAffiliateClick({
        offerId: offer.id,
        productId: offer.productId,
        sourcePageUrl: req.headers.referer || null,
        userAgent: req.headers["user-agent"] || null,
        ipHash: null,
      });

      res.redirect(offer.affiliateUrl);
    } catch (error: any) {
      console.error("Erro no tracking de clique:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CATEGORIES & BRANDS ============

  app.get("/api/categories", async (req, res) => {
    try {
      const cats = await storage.getCategories();
      res.json(cats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/brands", async (req, res) => {
    try {
      const b = await storage.getBrands();
      res.json(b);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ NEWSLETTER ============

  app.post("/api/newsletter/subscribe", async (req, res) => {
    try {
      const { email, name } = req.body;
      if (!email) return res.status(400).json({ error: "Email é obrigatório" });

      const alreadySubscribed = await storage.isSubscribed(email);
      if (alreadySubscribed) return res.json({ success: true, message: "Você já está inscrito!" });

      await storage.subscribeNewsletter({ email, name });
      res.json({ success: true, message: "Inscrito com sucesso!" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SEARCH ============

  app.post("/api/search/log", async (req, res) => {
    try {
      const { query, filters, resultsCount, sessionId, clickedProductId } = req.body;
      await storage.logSearch({ query, filters, resultsCount, sessionId, clickedProductId });
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

  // ============ AI (PERPLEXITY) ============

  app.post("/api/ai/ask", async (req, res) => {
    try {
      const { question, systemPrompt } = req.body;
      if (!question) return res.status(400).json({ error: "Campo 'question' é obrigatório" });
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
      if (!title) return res.status(400).json({ error: "Campo 'title' é obrigatório" });
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
      if (!productName || !brand) return res.status(400).json({ error: "Campos 'productName' e 'brand' são obrigatórios" });
      const info = await searchProductInfo(productName, brand);
      res.json(info);
    } catch (error: any) {
      console.error("Erro ao buscar informações:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ HEALTH & INIT ============

  app.get("/api/health", async (req, res) => {
    try {
      const cats = await storage.getCategories();
      const b = await storage.getBrands();
      const prods = await storage.getProducts({ limit: 1 });

      res.json({
        status: "ok",
        database: "connected",
        perplexityConfigured: !!process.env.PERPLEXITY_API_KEY,
        stats: { categories: cats.length, brands: b.length, products: prods.length > 0 ? "has_products" : "empty" },
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

  app.post("/api/init", async (req, res) => {
    try {
      const brandMap = await syncBrands();
      const categoryMap = await syncCategories();
      const marketplaceId = await ensureDefaultMarketplace();

      res.json({
        success: true,
        brands: brandMap.size,
        categories: categoryMap.size,
        marketplaceId,
        message: "Dados iniciais criados com sucesso!",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PUBLIC SECTIONS ============
  app.use(brandSectionsRouter);
  app.use(dealSectionsRouter);

  // ============ ADMIN ROUTES ============
  registerAdminCollectionsRoutes(app);

  const httpServer = createServer(app);

  setTimeout(async () => {
    try {
      await startScheduler();
    } catch (err: any) {
      console.error("[Scheduler] Erro ao iniciar:", err.message);
    }
  }, 5000);

  return httpServer;
}
