import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileResearchCache } from "./fileCache";
import { enrichProduct, type ResearchProvider } from "./research";

test("persistent cache survives a new instance and prevents a second API search", async () => {
  const directory = await mkdtemp(join(tmpdir(), "uppulse-research-"));
  try {
    let searches = 0;
    const provider: ResearchProvider = {
      search: async () => { searches++; return [{ url: "https://example.org/specs", title: "Specs", snippet: "Upper: mesh", sourceType: "RETAILER" }]; },
      extract: async (_identity, hit) => [{ field: "cabedal", value: "Mesh", sourceUrl: hit.url, sourceType: hit.sourceType, observedAt: "2026-11-09" }],
    };
    const identity = { masterId: "master-1", brand: "Adidas", model: "Adios Pro", version: "4" };
    const first = await enrichProduct(identity, provider, createFileResearchCache(directory));
    const second = await enrichProduct(identity, provider, createFileResearchCache(directory));
    assert.equal(first.state, "ENRICHED");
    assert.equal(first.queried, true);
    assert.equal(second.queried, false);
    assert.equal(second.card.superHash, first.card.superHash);
    assert.equal(searches, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("cache rejects unsafe keys", async () => {
  await assert.rejects(() => createFileResearchCache("/tmp").get("../../secrets"), /INVALID_CACHE_KEY/);
});
