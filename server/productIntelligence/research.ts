import { createSuperCatalogCard, type IdentityDescriptor, type TechnicalEvidence, type KnowledgeCard } from "./superCatalog";

/** Provider-neutral research contract. Search and extraction are supplied by a
 * separately configured provider; no secret, crawler or paid API is hardcoded.
 */
export interface ResearchHit {
  url: string;
  title: string;
  snippet: string;
  sourceType: TechnicalEvidence["sourceType"];
}
export interface ResearchProvider {
  search(query: string, limit: number, signal?: AbortSignal): Promise<ResearchHit[]>;
  extract(identity: IdentityDescriptor, hit: ResearchHit, signal?: AbortSignal): Promise<TechnicalEvidence[]>;
}
export interface ResearchResult {
  card: KnowledgeCard;
  state: "ENRICHED" | "NO_EVIDENCE" | "RESEARCH_FAILED";
  queried: boolean;
  warnings: string[];
}
export interface ResearchCache {
  get(key: string): Promise<ResearchResult | null>;
  set(key: string, result: ResearchResult): Promise<void>;
}
export type ResearchOptions = {
  maxSources?: number;
  maxFieldsPerSource?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
};
export type ResearchClaim = (card: KnowledgeCard) => Promise<(() => Promise<void>) | null>;

const pendingByCache = new WeakMap<ResearchCache, Map<string, Promise<ResearchResult>>>();

function waitFor<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
}

function isMasterConflict(error: unknown) {
  return error instanceof Error && error.message === "CACHE_MASTER_ID_MISMATCH";
}
/** Diagnostic codes only: never propagate raw API errors or credentials. */
function failureCode(error: unknown, stage: "SEARCH" | "EXTRACTION"): string {
  const message = error instanceof Error ? error.message : "";
  if (/^RESEARCH_(?:PAID_DISABLED|BUDGET_(?:INVALID|EXHAUSTED|UNAVAILABLE))$/.test(message)) return message;
  if (error instanceof Error && error.name === "AbortError") return stage + "_CANCELLED";
  const match = /^RESEARCH_PROVIDER_HTTP_(\d{3})(_(?:MISSING_SCOPE|INVALID_API_KEY|INSUFFICIENT_QUOTA|MODEL_NOT_FOUND|RATE_LIMIT_EXCEEDED|ORGANIZATION_NOT_FOUND))?$/.exec(message);
  if (match) return stage + "_HTTP_" + match[1] + (match[2] ?? "");
  if (message === "RESEARCH_EXTRACTION_INVALID_JSON") return stage + "_INVALID_JSON";
  if (error instanceof Error && error.name === "TimeoutError") return stage + "_TIMEOUT";
  return stage + "_FAILED";
}
const safeUrl = (url: string) => {
  try { const parsed = new URL(url); return ["https:","http:"].includes(parsed.protocol) && !!parsed.hostname && !parsed.username && !parsed.password; } catch { return false; }
};
export async function enrichProduct(
  identity: IdentityDescriptor,
  provider: ResearchProvider,
  cache: ResearchCache,
  options: ResearchOptions = {},
  claim?: ResearchClaim,
): Promise<ResearchResult> {
  const initial = createSuperCatalogCard(identity);
  const key = initial.superHash;
  const failed = (warning: string, queried = false): ResearchResult =>
    ({ card: initial, state: "RESEARCH_FAILED", queried, warnings: [warning] });
  if (options.signal?.aborted) return failed("RESEARCH_CANCELLED");

  let pending = pendingByCache.get(cache);
  if (!pending) {
    pending = new Map();
    pendingByCache.set(cache, pending);
  }
  const existing = pending.get(key);
  if (existing) {
    const shared = options.signal ? await waitFor(existing, options.signal).catch(error => {
      if (options.signal?.aborted && error === options.signal.reason) return failed("RESEARCH_CANCELLED");
      throw error;
    }) : await existing;
    if (shared.card.masterId !== initial.masterId) throw new Error("CACHE_MASTER_ID_MISMATCH");
    return { ...shared, queried: false };
  }

  const timeoutMs = options.timeoutMs ?? 120_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) {
    throw new Error("INVALID_RESEARCH_TIMEOUT");
  }
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const task = runResearch(identity, initial, provider, cache, options, signal, failed, claim);
  pending.set(key, task);
  try {
    return await task;
  } finally {
    pending.delete(key);
  }
}

async function runResearch(
  identity: IdentityDescriptor,
  initial: KnowledgeCard,
  provider: ResearchProvider,
  cache: ResearchCache,
  options: ResearchOptions,
  signal: AbortSignal,
  failed: (warning: string, queried?: boolean) => ResearchResult,
  claim?: ResearchClaim,
): Promise<ResearchResult> {
  const key = initial.superHash;
  async function readCache() {
    const result = await waitFor(cache.get(key), signal);
    if (result && (result.card.masterId !== initial.masterId || result.card.superHash !== key)) {
      throw new Error("CACHE_MASTER_ID_MISMATCH");
    }
    return result ? { ...result, queried: false, warnings: [...result.warnings] } : null;
  }

  let release: (() => Promise<void>) | null = null;
  let queried = false;
  let result: ResearchResult | undefined;
  let stage = "CACHE_READ";
  try {
    const cached = await readCache();
    if (cached) return (result = cached);
    if (claim) {
      stage = "CLAIM";
      signal.throwIfAborted();
      // Await the acquisition outcome so cancellation cannot orphan a claim.
      release = await claim(initial);
      stage = "CACHE_READ";
      const afterClaim = await readCache();
      if (afterClaim) return (result = afterClaim);
      if (!release) return (result = failed("RESEARCH_IN_PROGRESS"));
    }
    signal.throwIfAborted();
    queried = true;
    result = await research(identity, initial, provider, options, signal);
    if (result.state === "ENRICHED") {
      try {
        signal.throwIfAborted();
        // Keep ownership until the cache write settles.
        await cache.set(key, result);
      } catch (error) {
        if (isMasterConflict(error) || signal.aborted) throw error;
        result.warnings.push("CACHE_WRITE_FAILED");
      }
    }
  } catch (error) {
    if (isMasterConflict(error)) throw error;
    result = failed(signal.aborted
      ? (signal.reason?.name === "TimeoutError" ? "RESEARCH_TIMEOUT" : "RESEARCH_CANCELLED")
      : stage + "_FAILED", queried);
  } finally {
    if (release) {
      try {
        await release();
      } catch {
        // Preserve the original failure, including a Master ID conflict.
        result?.warnings.push("RESEARCH_CLAIM_RELEASE_FAILED");
      }
    }
  }
  return result;
}

async function research(
  identity: IdentityDescriptor,
  initial: KnowledgeCard,
  provider: ResearchProvider,
  options: ResearchOptions,
  signal: AbortSignal,
): Promise<ResearchResult> {
  const maxSources = Math.min(5, Math.max(1, Math.floor(options.maxSources ?? 3)));
  const maxFields = Math.min(30, Math.max(1, Math.floor(options.maxFieldsPerSource ?? 15)));
  const warnings: string[] = [];
  const query = [identity.brand, identity.model, identity.version, identity.manufacturerCode, "especificações tênis"].filter(Boolean).join(" ");
  let hits: ResearchHit[];
  try { hits = await waitFor(provider.search(query, maxSources, signal), signal); }
  catch (error) {
    signal.throwIfAborted();
    const code = failureCode(error, "SEARCH");
    return { card: initial, state: "RESEARCH_FAILED", queried: !code.startsWith("RESEARCH_"), warnings: [code] };
  }
  const evidence: TechnicalEvidence[] = [];
  const seen = new Set<string>();
  let extractionFailed = false;
  for (const hit of hits.slice(0, maxSources)) {
    if (!safeUrl(hit.url) || seen.has(hit.url)) continue;
    seen.add(hit.url);
    try {
      signal.throwIfAborted();
      const extracted = await waitFor(provider.extract(identity, hit, signal), signal);
      for (const item of extracted.slice(0,maxFields)) {
        if (item.sourceUrl === hit.url && item.sourceType === hit.sourceType) evidence.push(item);
        else warnings.push("UNTRUSTED_CITATION");
      }
    } catch (error) {
      signal.throwIfAborted();
      extractionFailed = true;
      const code = failureCode(error, "EXTRACTION");
      warnings.push(code);
      if (code.startsWith("RESEARCH_") || /^EXTRACTION_HTTP_429(?:_|$)/.test(code)) break;
    }
  }
  const card = createSuperCatalogCard(identity,evidence);
  const state = card.sourcesConsulted ? "ENRICHED" : extractionFailed ? "RESEARCH_FAILED" : "NO_EVIDENCE";
  return { card, state, queried: true, warnings };
}
