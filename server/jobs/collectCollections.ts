import { storage } from "../storage";
import { scrapeCollectionUrl } from "../services/mlCollectionsCollector";
import { scrapeBrandShopUrl } from "../services/mlBrandCollector";
import { upsertMembership, deactivateStaleMemberships } from "../usecases/upsertMembership";
import { detectBrand, detectCategory, ensureDefaultMarketplace } from "../services/productSync";
import crypto from "crypto";

const AFFILIATE_CODE = "14610626";

function buildAffiliateUrl(url: string): string {
  if (!url) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}matt_tool=${AFFILIATE_CODE}&matt_word=&matt_source=&matt_campaign_id=&matt_ad_group_id=&matt_match_type=&matt_network=&matt_device=&matt_creative=&matt_keyword=&matt_ad_position=&matt_ad_type=&matt_merchant_id=&matt_product_id=&matt_product_partition_id=&matt_target_id=`;
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").substring(0, 64);
}

export interface CollectCollectionsResult {
  sourcesRun: number;
  totalCollected: number;
  totalNew: number;
  totalDeactivated: number;
  errors: string[];
}

export async function runCollectionsJob(
  sourceId?: string
): Promise<CollectCollectionsResult> {
  const result: CollectCollectionsResult = {
    sourcesRun: 0,
    totalCollected: 0,
    totalNew: 0,
    totalDeactivated: 0,
    errors: [],
  };

  await ensureDefaultCollectionSources();

  const allSources = await storage.getCollectionSources();
  const activeSources = allSources.filter((s) =>
    s.isActive && s.url && (sourceId ? s.id === sourceId : true)
  );

  if (activeSources.length === 0) {
    result.errors.push("Nenhuma fonte de coleta ativa encontrada.");
    return result;
  }

  const marketplaceId = await ensureDefaultMarketplace();

  for (const source of activeSources) {
    result.sourcesRun++;
    const batch = await storage.createCollectionBatch({
      sourceId: source.id,
      status: "running",
      totalCollected: 0,
      totalErrors: 0,
    });

    try {
      // Use brand collector for brand-specific pages, generic collector for others
      const isBrandSource = source.sourceType === "ml_brand_offers";
      const scrapeResult = isBrandSource
        ? await scrapeBrandShopUrl(source.url!, source.name)
        : await scrapeCollectionUrl(source.url!, source.name);
      
      const { items, errors: scrapeErrors } = scrapeResult;

      if (scrapeErrors.length > 0) {
        result.errors.push(...scrapeErrors.map((e) => `[${source.name}] ${e}`));
      }

      let collectedCount = 0;
      let newCount = 0;

      for (const item of items) {
        if (!item.nome || item.preco_atual <= 0) continue;

        // For brand sources, filter by discount >= 40%
        if (isBrandSource && item.desconto_percent && item.desconto_percent < 40) {
          continue;
        }

        try {
          const contentHash = item.contentHash || sha256(`${item.nome}::${item.preco_atual}`);

          await upsertMembership({
            collectionSourceId: source.id,
            batchId: batch.id,
            item: { ...item, contentHash },
          });

          const existingRaw = await storage.getRawCollectedItemByHash(contentHash);

          if (!existingRaw) {
            const rawItem = await storage.createRawCollectedItem({
              batchId: batch.id,
              externalId: item.externalItemId,
              rawTitle: item.nome,
              rawPrice: String(item.preco_atual),
              rawOriginalPrice: item.preco_original ? String(item.preco_original) : null,
              rawImageUrl: item.imagens[0] || null,
              rawUrl: item.url,
              rawDiscount: item.desconto_percent,
              rawData: {
                marca: item.marca,
                avaliacao_media: item.avaliacao_media,
                qtd_avaliacoes: item.qtd_avaliacoes,
                frete_gratis: item.frete_gratis,
                parcelas: item.parcelas,
                fonte: item.fonte,
              },
              contentHash,
            });

            const detectedBrand = detectBrand(item.nome);
            const detectedCategory = detectCategory(item.nome);

            const affiliateUrl = item.link_afiliado || buildAffiliateUrl(item.url);

            const processedItem = await storage.createProcessedItem({
              rawItemId: rawItem.id,
              normalizedTitle: item.nome,
              detectedBrand,
              detectedCategory,
              detectedGender: null,
              price: String(item.preco_atual),
              originalPrice: item.preco_original ? String(item.preco_original) : null,
              discountPercent: item.desconto_percent,
              imageUrl: item.imagens[0] || null,
              sourceUrl: item.url,
              affiliateUrl,
              externalId: item.externalItemId,
              freeShipping: item.frete_gratis,
              contentHash,
              isDuplicate: false,
              matchedProductId: null,
            });

            const existingTriageForHash = await storage.getTriageItemByContentHash(contentHash);

            if (!existingTriageForHash) {
              await storage.createTriageItem({
                processedItemId: processedItem.id,
                status: "pending",
                priority: item.desconto_percent && item.desconto_percent >= 20 ? 1 : 0,
                suggestedBrandId: null,
                suggestedCategoryId: null,
                adminNotes: `Coleta automática: ${source.name}`,
              });
              newCount++;
            }

            collectedCount++;
          }
        } catch (itemErr: any) {
          result.errors.push(`[${source.name}] Item "${item.nome}": ${itemErr.message}`);
        }
      }

      const antiFlappingMinutes = (source.collectFrequencyMinutes || 120) * 2;
      const deactivated = await deactivateStaleMemberships(
        source.id,
        batch.id,
        antiFlappingMinutes
      );

      result.totalCollected += collectedCount;
      result.totalNew += newCount;
      result.totalDeactivated += deactivated;

      await storage.updateCollectionBatch(batch.id, {
        status: "completed",
        totalCollected: collectedCount,
        totalErrors: scrapeErrors.length,
        finishedAt: new Date(),
      });

      await storage.updateCollectionSource(source.id, { lastRunAt: new Date() });

      console.log(
        `[CollectCollections] ${source.name}: ${collectedCount} coletados, ${newCount} novos, ${deactivated} desativados`
      );
    } catch (err: any) {
      result.errors.push(`[${source.name}] Falha na coleta: ${err.message}`);
      await storage.updateCollectionBatch(batch.id, {
        status: "failed",
        finishedAt: new Date(),
        errorLog: err.message,
      });
    }
  }

  return result;
}

async function ensureDefaultCollectionSources(): Promise<void> {
  const existing = await storage.getCollectionSources();
  const existingUrls = new Set(existing.map((s) => s.url));

  const defaultSources = [
    {
      name: "Calçados Esportivos - Ofertas do Dia",
      sourceType: "ml_offers_page",
      url: "https://www.mercadolivre.com.br/ofertas?category=MLB23332",
      collectFrequencyMinutes: 120,
    },
    {
      name: "Tênis Esportivos - Destaques",
      sourceType: "ml_offers_page",
      url: "https://www.mercadolivre.com.br/ofertas?category=MLB3900",
      collectFrequencyMinutes: 30,
    },
    {
      name: "Calçados Esportivos - Masculino",
      sourceType: "ml_offers_page",
      url: "https://www.mercadolivre.com.br/ofertas?category=MLB3912",
      collectFrequencyMinutes: 90,
    },
    {
      name: "Calçados Esportivos - Feminino",
      sourceType: "ml_offers_page",
      url: "https://www.mercadolivre.com.br/ofertas?category=MLB3913",
      collectFrequencyMinutes: 360,
    },
  ];

  let created = 0;
  for (const src of defaultSources) {
    if (!existingUrls.has(src.url)) {
      await storage.createCollectionSource({
        name: src.name,
        sourceType: src.sourceType,
        url: src.url,
        isActive: true,
        collectFrequencyMinutes: src.collectFrequencyMinutes,
      });
      created++;
    }
  }

  if (created > 0) {
    console.log(`[CollectCollections] ${created} novas fontes padrão criadas.`);
  }
}
