import type { SourceCollector } from "./collectorResolver";
import { storage } from "../storage";
import { runCollectionsJob } from "../jobs/collectCollections";

// Adapter de transição: o pipeline existente ainda usa collection_sources em suas FKs.
export const mercadoLivreCollector: SourceCollector = {
  async collect(source) {
    console.log(`[CurationSources] provider=${source.marketplaceSlug} source=${source.id} url=${new URL(source.url).origin + new URL(source.url).pathname}`);
    const existing = (await storage.getCollectionSources()).find((item) => item.url === source.url);
    const legacy = existing
      ? await storage.updateCollectionSource(existing.id, { name: source.name, url: source.url, marketplaceId: source.marketplaceId, sourceType: "ml_offers_page", isActive: true })
      : await storage.createCollectionSource({ name: source.name, url: source.url, marketplaceId: source.marketplaceId, sourceType: "ml_offers_page", isActive: true, collectFrequencyMinutes: 120 });
    if (!legacy) throw new Error("Não foi possível preparar a fonte para o pipeline de coleta.");
    const result = await runCollectionsJob(legacy.id);
    if (result.errors.length && result.totalParsed === 0) throw new Error(result.errors[0]);
    return { itemsFound: result.totalParsed, itemsCreated: result.totalNew, itemsUpdated: null, itemsIgnored: Math.max(0, result.totalParsed - result.totalNew), errors: result.errors.length };
  },
};
