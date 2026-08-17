import type { CurationSourcesRepository, OperationalCurationSource } from "./repository";
import type { SourceCollector } from "./collectorResolver";
import { resolveCollector } from "./collectorResolver";

export type SourceCollectionResult = {
  itemsFound: number;
  itemsCreated: number;
  itemsUpdated: number | null;
  itemsIgnored: number;
  errors: number;
};

export class SourceExecutionError extends Error {
  constructor(public code: "not_found" | "not_collectable" | "unsupported_provider" | "already_running" | "invalid_configuration" | "collection_failed", message: string) {
    super(message);
  }
}

type Resolver = (providerSlug: string) => SourceCollector | undefined;
const runningSources = new Set<string>();

function validate(source: OperationalCurationSource) {
  if (source.status !== "active") throw new SourceExecutionError("not_collectable", `Fonte ${source.status === "ended" ? "encerrada" : "inativa"} não pode ser coletada.`);
  let url: URL;
  try { url = new URL(source.url); } catch { throw new SourceExecutionError("invalid_configuration", "A fonte não possui uma URL válida."); }
  if (!(["http:", "https:"] as string[]).includes(url.protocol)) throw new SourceExecutionError("invalid_configuration", "A URL da fonte deve usar HTTP ou HTTPS.");
  const now = new Date();
  if (source.startsAt && source.startsAt > now) throw new SourceExecutionError("not_collectable", "A fonte ainda não atingiu sua data de início.");
  if (source.endsAt && source.endsAt < now) throw new SourceExecutionError("not_collectable", "O período configurado para esta fonte terminou.");
}

export function createSourceExecutor(repository: CurationSourcesRepository, resolver: Resolver = resolveCollector) {
  return async function executeSource(sourceId: string, triggerType: "manual" | "scheduled" = "manual") {
    if (runningSources.has(sourceId)) throw new SourceExecutionError("already_running", "Esta fonte já está sendo coletada.");
    const source = await repository.findOperationalById(sourceId);
    if (!source) throw new SourceExecutionError("not_found", "Fonte não encontrada.");
    validate(source);
    const collector = resolver(source.marketplaceSlug);
    if (!collector) throw new SourceExecutionError("unsupported_provider", "Coleta ainda não disponível para este provedor.");

    runningSources.add(sourceId);
    console.log(`[CurationSources] execute source=${source.id} provider=${source.marketplaceSlug} url=${new URL(source.url).origin + new URL(source.url).pathname}`);
    const run = await repository.createRun(sourceId, triggerType);
    try {
      const result = await collector.collect(source);
      await repository.finishRun(run.id, {
        status: "completed", finishedAt: new Date(), itemsFound: result.itemsFound,
        itemsCreated: result.itemsCreated, itemsUpdated: result.itemsUpdated,
        itemsIgnored: result.itemsIgnored, errorMessage: result.errors ? `${result.errors} erro(s) operacional(is)` : null,
      });
      return { runId: run.id, status: "completed" as const, ...result };
    } catch (error) {
      console.error(`[CurationSources] Falha ao coletar fonte ${sourceId}:`, error);
      await repository.finishRun(run.id, { status: "failed", finishedAt: new Date(), errorMessage: "Falha operacional durante a coleta." });
      throw new SourceExecutionError("collection_failed", "Falha na coleta.");
    } finally {
      runningSources.delete(sourceId);
    }
  };
}
