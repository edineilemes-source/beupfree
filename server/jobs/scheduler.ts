import { storage } from "../storage";
import { runCollectionsJob } from "./collectCollections";

interface ScheduledSource {
  sourceId: string;
  name: string;
  frequencyMs: number;
  timer: ReturnType<typeof setInterval>;
}

const activeTimers: Map<string, ScheduledSource> = new Map();

async function runSource(sourceId: string, name: string): Promise<void> {
  console.log(`[Scheduler] Iniciando coleta agendada: ${name}`);
  try {
    const result = await runCollectionsJob(sourceId);
    console.log(
      `[Scheduler] Coleta concluída: ${name} — ${result.totalCollected} coletados, ${result.totalNew} novos, ${result.totalDeactivated} desativados`
    );
  } catch (err: any) {
    console.error(`[Scheduler] Erro na coleta agendada de ${name}:`, err.message);
  }
}

export async function startScheduler(): Promise<void> {
  stopScheduler();

  const sources = await storage.getCollectionSources();
  const activeSources = sources.filter((s) => s.isActive && s.url);

  if (activeSources.length === 0) {
    console.log("[Scheduler] Nenhuma fonte ativa para agendar.");
    return;
  }

  for (const source of activeSources) {
    const frequencyMs = (source.collectFrequencyMinutes || 120) * 60 * 1000;

    const timer = setInterval(() => {
      runSource(source.id, source.name);
    }, frequencyMs);

    activeTimers.set(source.id, {
      sourceId: source.id,
      name: source.name,
      frequencyMs,
      timer,
    });

    console.log(
      `[Scheduler] Fonte "${source.name}" agendada a cada ${source.collectFrequencyMinutes || 120} minutos.`
    );
  }

  console.log(`[Scheduler] ${activeTimers.size} fontes agendadas.`);
}

export function stopScheduler(): void {
  for (const [, scheduled] of activeTimers) {
    clearInterval(scheduled.timer);
  }
  activeTimers.clear();
}

export function getSchedulerStatus(): Array<{
  sourceId: string;
  name: string;
  frequencyMinutes: number;
}> {
  return Array.from(activeTimers.values()).map((s) => ({
    sourceId: s.sourceId,
    name: s.name,
    frequencyMinutes: Math.round(s.frequencyMs / 60000),
  }));
}
