import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSourceExecutor, SourceExecutionError } from "./executeSource";
import { providerIsSupported, registerCollector, resolveCollector } from "./collectorResolver";

const base = {
  id: "11111111-1111-4111-8111-111111111111", name: "Fonte genérica", marketplaceId: "22222222-2222-4222-8222-222222222222",
  marketplaceName: "Provider", marketplaceSlug: "supported", url: "https://example.test/items", sourceType: "other" as const,
  status: "active" as const, priority: 0, startsAt: null, endsAt: null, notes: null, createdAt: new Date(), updatedAt: new Date(),
};

function harness(overrides: Record<string, unknown> = {}, collect?: () => Promise<any>) {
  const source = { ...base, ...overrides } as any;
  const runs: any[] = [];
  const repository = {
    async findOperationalById(id: string) { return id === source.id ? source : undefined; },
    async createRun(sourceId: string, triggerType: string) { const run = { id: crypto.randomUUID(), sourceId, triggerType }; runs.push(run); return run; },
    async finishRun(id: string, data: any) { Object.assign(runs.find((run) => run.id === id), data); },
  } as any;
  const collector = { collect: collect ?? (async () => ({ itemsFound: 8, itemsCreated: 3, itemsUpdated: null, itemsIgnored: 5, errors: 0 })) };
  return { source, runs, execute: createSourceExecutor(repository, (slug) => slug === "supported" ? collector : undefined) };
}

async function rejectsCode(promise: Promise<unknown>, code: SourceExecutionError["code"]) {
  await assert.rejects(promise, (error: SourceExecutionError) => error instanceof SourceExecutionError && error.code === code);
}

describe("executeSource", () => {
  it("executes an active supported source and returns only real metrics", async () => {
    const { execute, runs } = harness(); const result = await execute(base.id);
    assert.deepEqual({ found: result.itemsFound, created: result.itemsCreated, updated: result.itemsUpdated, ignored: result.itemsIgnored }, { found: 8, created: 3, updated: null, ignored: 5 });
    assert.equal(runs[0].status, "completed");
  });
  it("rejects inactive and ended sources", async () => {
    await rejectsCode(harness({ status: "inactive" }).execute(base.id), "not_collectable");
    await rejectsCode(harness({ status: "ended" }).execute(base.id), "not_collectable");
  });
  it("rejects missing sources and invalid or absent URLs", async () => {
    await rejectsCode(harness().execute("33333333-3333-4333-8333-333333333333"), "not_found");
    await rejectsCode(harness({ url: "" }).execute(base.id), "invalid_configuration");
  });
  it("distinguishes unsupported providers from invalid configuration", async () => {
    await rejectsCode(harness({ marketplaceSlug: "unknown" }).execute(base.id), "unsupported_provider");
  });
  it("records operational failures without exposing their details", async () => {
    const { execute, runs } = harness({}, async () => { throw new Error("secret stack detail"); });
    await rejectsCode(execute(base.id), "collection_failed"); assert.equal(runs[0].status, "failed"); assert.equal(runs[0].errorMessage, "Falha operacional durante a coleta.");
  });
  it("prevents duplicate execution of the same source", async () => {
    let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
    const { execute } = harness({}, async () => { await gate; return { itemsFound: 0, itemsCreated: 0, itemsUpdated: null, itemsIgnored: 0, errors: 0 }; });
    const first = execute(base.id); await new Promise((resolve) => setImmediate(resolve));
    await rejectsCode(execute(base.id), "already_running"); release(); await first;
  });
});

describe("collector resolver", () => {
  it("resolves Mercado Livre centrally and leaves unknown providers unsupported", () => {
    registerCollector(["mercadolivre", "mercado-livre"], { collect: async () => ({ itemsFound: 0, itemsCreated: 0, itemsUpdated: null, itemsIgnored: 0, errors: 0 }) });
    assert.ok(resolveCollector("mercadolivre")); assert.equal(providerIsSupported("mercado-livre"), true); assert.equal(resolveCollector("amazon"), undefined);
  });
});
