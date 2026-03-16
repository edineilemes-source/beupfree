import { storage } from "../storage";
import { scrapeAllSources } from "../services/mlScraper";
import { detectBrand, detectCategory, ensureDefaultMarketplace, syncBrands, syncCategories } from "../services/productSync";
import crypto from "crypto";

const AFFILIATE_CODE = "14610626";

function generateAffiliateLink(url: string): string {
  if (!url) return "";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}matt_tool=${AFFILIATE_CODE}&matt_word=&matt_source=google&matt_campaign_id=${AFFILIATE_CODE}`;
}

function contentHash(title: string, price: number | null): string {
  const data = `${title}|${price || 0}`;
  return crypto.createHash("sha256").update(data).digest("hex").substring(0, 64);
}

export async function runCollectJob(): Promise<{
  batchId: string;
  collected: number;
  processed: number;
  queued: number;
  errors: number;
}> {
  const brandMap = await syncBrands();
  const categoryMap = await syncCategories();
  const marketplaceId = await ensureDefaultMarketplace();

  let sources = await storage.getCollectionSources();
  if (sources.length === 0) {
    await storage.createCollectionSource({
      name: "ML Ofertas Esportivas",
      sourceType: "scraper",
      url: "https://www.mercadolivre.com.br/ofertas?category=MLB23332",
      marketplaceId,
      isActive: true,
    });
    sources = await storage.getCollectionSources();
  }

  const batch = await storage.createCollectionBatch({
    sourceId: sources[0]?.id || null,
    status: 'running',
  });

  let collected = 0;
  let processed = 0;
  let queued = 0;
  let errors = 0;

  try {
    const scrapeResult = await scrapeAllSources();

    for (const produto of scrapeResult.produtos) {
      try {
        const nome = produto.nome || "";
        const precoAtual = produto.preco_atual;
        const precoOriginal = produto.preco_original;
        const descontoPercent = produto.desconto_percent;
        const linkAfiliado = produto.link_afiliado || "";
        const url = produto.url || "";
        const imagem = produto.imagens && produto.imagens[0] ? produto.imagens[0] : null;
        const freteGratis = produto.frete_gratis || false;

        if (!nome) {
          errors++;
          continue;
        }

        const hash = contentHash(nome, precoAtual);

        const rawItem = await storage.createRawCollectedItem({
          batchId: batch.id,
          externalId: null,
          rawTitle: nome,
          rawPrice: precoAtual ? String(precoAtual) : null,
          rawOriginalPrice: precoOriginal ? String(precoOriginal) : null,
          rawImageUrl: imagem,
          rawUrl: url || linkAfiliado,
          rawDiscount: descontoPercent || null,
          rawData: produto as any,
          contentHash: hash,
        });
        collected++;

        const detectedBrandName = detectBrand(nome);
        const detectedCategorySlug = detectCategory(nome);
        const finalAffiliateUrl = linkAfiliado || (url ? generateAffiliateLink(url) : "");

        const processedItem = await storage.createProcessedItem({
          rawItemId: rawItem.id,
          normalizedTitle: nome,
          detectedBrand: detectedBrandName,
          detectedCategory: detectedCategorySlug,
          price: precoAtual ? String(precoAtual) : null,
          originalPrice: precoOriginal ? String(precoOriginal) : null,
          discountPercent: descontoPercent || null,
          imageUrl: imagem,
          sourceUrl: url,
          affiliateUrl: finalAffiliateUrl,
          externalId: null,
          freeShipping: freteGratis,
          contentHash: hash,
          isDuplicate: false,
        });
        processed++;

        const suggestedBrandId = brandMap.get(detectedBrandName) || null;
        const suggestedCategoryId = categoryMap.get(detectedCategorySlug) || null;

        await storage.createTriageItem({
          processedItemId: processedItem.id,
          status: 'pending',
          priority: descontoPercent && descontoPercent >= 30 ? 10 : 0,
          suggestedBrandId: suggestedBrandId || null,
          suggestedCategoryId: suggestedCategoryId || null,
        });
        queued++;
      } catch (err) {
        console.error("Erro processando item:", err);
        errors++;
      }
    }

    await storage.updateCollectionBatch(batch.id, {
      status: 'completed',
      totalCollected: collected,
      totalErrors: errors,
      finishedAt: new Date(),
    });
  } catch (err: any) {
    await storage.updateCollectionBatch(batch.id, {
      status: 'failed',
      totalErrors: errors,
      finishedAt: new Date(),
      errorLog: err.message,
    });
    throw err;
  }

  return { batchId: batch.id, collected, processed, queued, errors };
}
