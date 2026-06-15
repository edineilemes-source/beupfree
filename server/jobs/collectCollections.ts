import { storage } from "../storage";
import { scrapeCollectionUrl } from "../services/mlCollectionsCollector";
import { upsertMembership, deactivateByBatch } from "../usecases/upsertMembership";
import { detectBrand, detectCategory, ensureDefaultMarketplace, resolveBrandId, resolveCategoryId } from "../services/productSync";
import { evaluateAutoApproval } from "../services/autoApprove";
import crypto from "crypto";
import { db } from "../db";
import { products, offers, productImages, collectionSources } from "@shared/schema";
import { eq, ne, sql } from "drizzle-orm";

const AFFILIATE_CODE = "14610626";

// Minimum items expected in a successful scrape before we trust deactivation.
const MIN_EXPECTED_FOR_DEACTIVATION = 30;
const MIN_DISCOUNT_FOR_AUTO_APPROVE = 30;
// Quando true, todo item processado vira product+offer direto, pulando triagem.
// O filtro de desconto mínimo de 25% continua valendo (aplicado no scrape).
const AUTO_PUBLISH_ALL = process.env.AUTO_PUBLISH_ALL !== "false";
const GERAL_SOURCE_URL = "https://www.mercadolivre.com.br/ofertas?category=MLB3900";
const GERAL_SOURCE_NAME = "Ofertas Calçados (Geral)";

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
      const scrapeResult = await scrapeCollectionUrl(source.url!, source.name);
      const { items, errors: scrapeErrors } = scrapeResult;

      if (scrapeErrors.length > 0) {
        result.errors.push(...scrapeErrors.map((e) => `[${source.name}] ${e}`));
      }

      for (const item of items) {
        if (!item.nome || item.preco_atual <= 0) continue;

        try {
          // Always compute SHA256 from title+price for consistency —
          // ignore the scraper's 8-char hash which can cause lookup mismatches.
          const contentHash = sha256(`${item.nome}::${item.preco_atual}`);

          await upsertMembership({
            collectionSourceId: source.id,
            batchId: batch.id,
            item: { ...item, contentHash },
          });

          const existingRaw = await storage.getRawCollectedItemByHash(contentHash);
          let processedItem;

          if (!existingRaw) {
            // Brand new item — create raw + processed records
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

            // Usa a marca explícita do card ML (.poly-component__brand) como hint primário,
            // depois cai para detecção por título/aliases.
            const detectedBrand = detectBrand(item.nome, item.marca);
            const detectedCategory = detectCategory(item.nome);
            const affiliateUrl = item.link_afiliado || buildAffiliateUrl(item.url);

            processedItem = await storage.createProcessedItem({
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
              detectedRating: item.avaliacao_media != null ? String(item.avaliacao_media) : null,
              detectedReviews: item.qtd_avaliacoes ?? 0,
              freeShipping: item.frete_gratis,
              contentHash,
              isDuplicate: false,
              matchedProductId: null,
              promotionType: item.promotionType,
            });
          } else {
            // Previously collected — retrieve existing processed item
            processedItem = await storage.getProcessedItemByContentHash(contentHash);
            // Refresh promotionType (item may have moved between sections)
            if (processedItem && (processedItem as any).promotionType !== item.promotionType) {
              await db.execute(
                sql`UPDATE processed_items SET promotion_type = ${item.promotionType} WHERE content_hash = ${contentHash}`
              );
            }
          }

          collectedCount++;

          // Always check if a triage entry exists — even for previously-seen items.
          // Use hasBeenTriaged (any status) to avoid re-adding approved/rejected items.
          // Items only re-enter triage if their triage record was deleted (queue cleared).
          if (processedItem) {
            const alreadyTriaged = await storage.hasBeenTriaged(contentHash, item.externalItemId);
            const existingTriageForHash = alreadyTriaged ? true : await storage.getTriageItemByContentHash(contentHash);

            if (!existingTriageForHash) {
              const affiliateUrl = processedItem.affiliateUrl || buildAffiliateUrl(item.url);

              // Evaluate auto-approval
              const approval = evaluateAutoApproval({
                title: item.nome,
                marcaField: item.marca,
                sourceUrl: item.url,
                imageUrl: item.imagens[0] || null,
                price: item.preco_atual,
                discountPercent: item.desconto_percent,
              });

              // Auto-approve requires: brand whitelist (handled by approval) + min discount
              const meetsDiscountFloor =
                (item.desconto_percent ?? 0) >= MIN_DISCOUNT_FOR_AUTO_APPROVE;

              if (AUTO_PUBLISH_ALL || (approval.shouldAutoApprove && meetsDiscountFloor)) {
                // Auto-approve: create product + offer directly
                try {
                  const slug = generateSlug(item.nome, Date.now().toString(36));
                  const [brandId, categoryId] = await Promise.all([
                    resolveBrandId(detectBrand(item.nome, item.marca)),
                    resolveCategoryId(detectCategory(item.nome)),
                  ]);
                  const product = await db.insert(products).values({
                    mainName: item.nome,
                    slug,
                    brandId,
                    mainCategoryId: categoryId,
                    mainImageUrl: item.imagens[0] || null,
                    catalogStatus: 'published',
                    shortDescription: item.nome,
                    averageRating: item.avaliacao_media != null ? String(item.avaliacao_media) : null,
                    totalReviews: item.qtd_avaliacoes ?? 0,
                  }).returning().then(r => r[0]);

                  await db.insert(offers).values({
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
                  });

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
                  // If auto-approve fails, fall back to manual triage
                  result.errors.push(`[${source.name}] Auto-approve falhou para "${item.nome}": ${approveErr.message}`);
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
              } else {
                // Send to manual triage
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
  const geralSource = existing.find((s) => s.url === GERAL_SOURCE_URL);

  if (!geralSource) {
    await storage.createCollectionSource({
      name: GERAL_SOURCE_NAME,
      sourceType: "ml_offers_page",
      url: GERAL_SOURCE_URL,
      isActive: true,
      collectFrequencyMinutes: 60,
    });
    console.log(`[CollectCollections] Fonte Geral criada: ${GERAL_SOURCE_NAME}`);
  } else if (!geralSource.isActive) {
    await db
      .update(collectionSources)
      .set({ isActive: true, collectFrequencyMinutes: 60 })
      .where(eq(collectionSources.id, geralSource.id));
    console.log(`[CollectCollections] Fonte Geral reativada.`);
  }
}
