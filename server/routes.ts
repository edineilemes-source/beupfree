import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { askPerplexity, classifyProduct, searchProductInfo } from "./services/perplexity";

export async function registerRoutes(app: Express): Promise<Server> {
  // Rota de teste - Pergunta geral ao Perplexity
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

  // Rota de teste - Classificar produto
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

  // Rota de teste - Buscar informações do produto
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

  // Rota de health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      perplexityConfigured: !!process.env.PERPLEXITY_API_KEY 
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
