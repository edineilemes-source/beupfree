import type { OperationalCurationSource } from "./repository";
import type { SourceCollectionResult } from "./executeSource";

export interface SourceCollector {
  collect(source: OperationalCurationSource): Promise<SourceCollectionResult>;
}

const collectors = new Map<string, SourceCollector>();

export function registerCollector(providerSlugs: string[], collector: SourceCollector): void {
  for (const slug of providerSlugs) collectors.set(slug.trim().toLowerCase(), collector);
}

export function resolveCollector(providerSlug: string): SourceCollector | undefined {
  return collectors.get(providerSlug.trim().toLowerCase());
}

export function providerIsSupported(providerSlug: string): boolean {
  return Boolean(resolveCollector(providerSlug));
}
