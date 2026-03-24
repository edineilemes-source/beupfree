import { storage } from "../storage";
import { scrapeCollectionUrl } from "../services/mlCollectionsCollector";
import { scrapeBrandShopUrl } from "../services/mlBrandCollector";
import { upsertMembership, deactivateByBatch } from "../usecases/upsertMembership";
import { detectBrand, detectCategory, ensureDefaultMarketplace } from "../services/productSync";
import { evaluateAutoApproval } from "../services/autoApprove";
import crypto from "crypto";
import { db } from "../db";
import { products, offers, productImages } from "@shared/schema";

const AFFILIATE_CODE = "14610626";

// Minimum items expected in a successful scrape before we trust deactivation.
// If we get fewer items than this, the scrape was probably partial — don't mark items as ESGOTADO.
const MIN_EXPECTED_FOR_DEACTIVATION = 5;

function buildAffiliateUrl(url: string): string {
  if (!url) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}matt_tool=${AFFILIATE_CODE}&matt_word=&matt_source=&matt_campaign_id=&matt_ad_group_id=&matt_match_type=&matt_network=&matt_device=&matt_creative=&matt_keyword=&matt_ad_position=&matt_ad_type=&matt_merchant_id=&matt_product_id=&matt_product_partition_id=&matt_target_id=`;
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").substring(0, 64);
}

function generateSlug(text: string, suffix: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80) + "-" + suffix;
}

export interface CollectCollectionsResult {
  sourcesRun: number;
  totalCollected: number;
  totalNew: number;
  totalDeactivated: number;
  totalAutoApproved: number;
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
    totalAutoApproved: 0,
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

    let batchSuccess = false;
    let collectedCount = 0;
    let newCount = 0;
    let autoApprovedCount = 0;

    try {
      const isBrandSource = source.sourceType === "ml_brand_offers";
      const scrapeResult = isBrandSource
        ? await scrapeBrandShopUrl(source.url!, source.name)
        : await scrapeCollectionUrl(source.url!, source.name);

      const { items, errors: scrapeErrors } = scrapeResult;

      if (scrapeErrors.length > 0) {
        result.errors.push(...scrapeErrors.map((e) => `[${source.name}] ${e}`));
      }

      // Detect if this source filters by a specific brand name
      const sourceLower = source.name.toLowerCase();
      const brandFilter = sourceLower.includes("nike")
        ? "nike"
        : sourceLower.includes("adidas")
        ? "adidas"
        : null;

      for (const item of items) {
        if (!item.nome || item.preco_atual <= 0) continue;

        // For brand sources, filter by discount >= 40%
        if (isBrandSource && item.desconto_percent && item.desconto_percent < 40) {
          continue;
        }

        // For brand-filtered sources (Nike/Adidas), only keep items matching that brand
        if (brandFilter) {
          const titleLower = item.nome.toLowerCase();
          const marcaLower = (item.marca || "").toLowerCase();
          if (!titleLower.includes(brandFilter) && !marcaLower.includes(brandFilter)) {
            continue;
          }
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
              // Evaluate auto-approval
              const approval = evaluateAutoApproval({
                title: item.nome,
                marcaField: item.marca,
                sourceUrl: item.url,
                imageUrl: item.imagens[0] || null,
                price: item.preco_atual,
                discountPercent: item.desconto_percent,
              });

              if (approval.shouldAutoApprove) {
                // Auto-approve: create product + offer directly
                try {
                  const slug = generateSlug(item.nome, Date.now().toString(36));
                  const product = await db.insert(products).values({
                    mainName: item.nome,
                    slug,
                    mainImageUrl: item.imagens[0] || null,
                    catalogStatus: 'published',
                    shortDescription: item.nome,
                  }).returning().then(r => r[0]);

                  const offer = await db.insert(offers).values({
                    productId: product.id,
                    marketplaceId,
                    currentPrice: String(item.preco_atual),
                    originalPrice: item.preco_original ? String(item.preco_original) : null,
                    discountPercent: item.desconto_percent,
                    originalUrl: item.url,
                    affiliateUrl,
                    freeShipping: item.frete_gratis,
                    externalId: item.externalItemId,
                    status: 'active',
                  }).returning().then(r => r[0]);

                  if (item.imagens[0]) {
                    await db.insert(productImages).values({
                      productId: product.id,
                      url: item.imagens[0],
                      alt: item.nome,
                      isPrimary: true,
                      sortOrder: 0,
                    });
                  }

                  // Record in triage as auto-approved for audit
                  await storage.createTriageItem({
                    processedItemId: processedItem.id,
                    status: "approved",
                    priority: item.desconto_percent && item.desconto_percent >= 20 ? 1 : 0,
                    suggestedBrandId: null,
                    suggestedCategoryId: null,
                    adminNotes: `Auto-aprovado: ${approval.brand} (${Math.round(approval.confidence * 100)}% confiança)`,
                    approvedBy: "system",
                    autoApproved: true,
                    autoApprovedReason: approval.reason,
                    brandDetected: approval.brand,
                    brandConfidence: String(approval.confidence),
                    resolvedAt: new Date(),
                  } as any);

                  autoApprovedCount++;
                } catch (approveErr: any) {
                  // If auto-approve fails, fall back to triage
                  result.errors.push(`[${source.name}] Auto-approve falhou para "${item.nome}": ${approveErr.message}`);
                  await storage.createTriageItem({
                    processedItemId: processedItem.id,
                    status: "pending",
                    priority: item.desconto_percent && item.desconto_percent >= 20 ? 1 : 0,
                    suggestedBrandId: null,
                    suggestedCategoryId: null,
                    adminNotes: `Coleta automática: ${source.name}`,
                    brandDetected: approval.brand,
                    brandConfidence: String(approval.confidence),
                    issues: approval.issues,
                  } as any);
                }
              } else {
                // Send to manual triage with audit info
                await storage.createTriageItem({
                  processedItemId: processedItem.id,
                  status: "pending",
                  priority: item.desconto_percent && item.desconto_percent >= 20 ? 1 : 0,
                  suggestedBrandId: null,
                  suggestedCategoryId: null,
                  collectionSourceId: source.id,
                  adminNotes: `Coleta automática: ${source.name}`,
                  brandDetected: approval.brand,
                  brandConfidence: String(approval.confidence),
                  issues: approval.issues,
                } as any);
              }

              newCount++;
            }

            collectedCount++;
          }
        } catch (itemErr: any) {
          result.errors.push(`[${source.name}] Item "${item.nome}": ${itemErr.message}`);
        }
      }

      // ===== ESGOTADO: Robust batch-based deactivation =====
      // Only deactivate when:
      // 1. Batch completed successfully (no exception thrown)
      // 2. We collected enough items (not a partial scrape)
      batchSuccess = true;
      const deactivated =
        collectedCount >= MIN_EXPECTED_FOR_DEACTIVATION
          ? await deactivateByBatch(source.id, batch.id)
          : 0;

      if (collectedCount < MIN_EXPECTED_FOR_DEACTIVATION && collectedCount > 0) {
        console.log(
          `[CollectCollections] ${source.name}: apenas ${collectedCount} itens — skip deactivation (min=${MIN_EXPECTED_FOR_DEACTIVATION})`
        );
      }

      result.totalCollected += collectedCount;
      result.totalNew += newCount;
      result.totalDeactivated += deactivated;
      result.totalAutoApproved += autoApprovedCount;

      await storage.updateCollectionBatch(batch.id, {
        status: "completed",
        totalCollected: collectedCount,
        totalErrors: scrapeErrors.length,
        finishedAt: new Date(),
      });

      await storage.updateCollectionSource(source.id, { lastRunAt: new Date() });

      console.log(
        `[CollectCollections] ${source.name}: ${collectedCount} coletados, ${newCount} novos (${autoApprovedCount} auto-aprovados), ${deactivated} desativados`
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
