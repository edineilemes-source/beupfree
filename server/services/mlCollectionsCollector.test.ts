import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  buildCollectionPageUrl,
  parseCollectionPage,
  scrapeCollectionUrl,
} from "./mlCollectionsCollector";

const filteredListingUrl = "https://lista.mercadolivre.com.br/calcados/tenis/running/novo/tenis_Discount_40-100_AGE*GROUP_6725189_NoIndex_True?sort=price#applied_filter_id%3Ddiscount%26applied_value_results%3D1455";

const productFixture = `
  <html><body>
    <div class="poly-card">
      <span class="poly-component__brand">Marca</span>
      <a href="https://produto.mercadolivre.com.br/MLB-1234567890-tenis-teste"><span class="poly-component__title">Tênis de teste</span></a>
      <img class="poly-component__picture" src="https://http2.mlstatic.com/test.jpg">
      <span class="andes-money-amount--previous"><span class="andes-money-amount__fraction">200</span></span>
      <span class="poly-price__current"><span class="andes-money-amount__fraction">100</span></span>
      <span class="poly-price__disc_label">50% OFF</span>
    </div>
  </body></html>`.padEnd(6000, " ");

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("Mercado Livre collection URL resolution", () => {
  it("preserves path, filters, encoded characters and fragment while placing pagination before the fragment", () => {
    const first = buildCollectionPageUrl(filteredListingUrl, 1);
    const second = buildCollectionPageUrl(filteredListingUrl, 2);
    assert.equal(new URL(first).pathname, new URL(filteredListingUrl).pathname);
    assert.equal(new URL(first).searchParams.get("sort"), "price");
    assert.equal(new URL(first).hash, new URL(filteredListingUrl).hash);
    assert.equal(new URL(second).searchParams.get("page"), "2");
    assert.ok(second.indexOf("page=2") < second.indexOf("#applied_filter"));
  });

  it("parses a listing card without deriving category or collection ids from the source URL", () => {
    const result = parseCollectionPage(productFixture, "Fonte filtrada");
    assert.equal(result.totalCards, 1);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].externalItemId, "MLB1234567890");
    assert.equal(result.items[0].desconto_percent, 50);
  });

  it("requests the supplied listing generically and reports raw and parsed counts", async () => {
    let requested = "";
    globalThis.fetch = async (input) => {
      requested = String(input);
      const response = new Response(productFixture, { status: 200 });
      Object.defineProperty(response, "url", { value: requested.split("#")[0] });
      return response;
    };
    const result = await scrapeCollectionUrl(filteredListingUrl, "Fonte filtrada");
    assert.equal(requested, buildCollectionPageUrl(filteredListingUrl, 1));
    assert.equal(result.rawCardsFound, 1);
    assert.equal(result.items.length, 1);
    assert.deepEqual(result.errors, []);
  });

  it("distinguishes an explicit empty listing from an unrecognized response", async () => {
    globalThis.fetch = async () => {
      const response = new Response("<html><main>Não encontramos produtos</main></html>".padEnd(6000, " "), { status: 200 });
      Object.defineProperty(response, "url", { value: filteredListingUrl.split("#")[0] });
      return response;
    };
    const result = await scrapeCollectionUrl(filteredListingUrl, "Fonte vazia");
    assert.equal(result.items.length, 0);
    assert.deepEqual(result.errors, []);

    globalThis.fetch = async () => {
      const response = new Response("<html><main>Resposta inesperada</main></html>".padEnd(6000, " "), { status: 200 });
      Object.defineProperty(response, "url", { value: filteredListingUrl.split("#")[0] });
      return response;
    };
    const unrecognized = await scrapeCollectionUrl(filteredListingUrl, "Fonte irreconhecível");
    assert.equal(unrecognized.items.length, 0);
    assert.equal(unrecognized.errors.length, 1);
    assert.match(unrecognized.errors[0], /markup não contém cards/);
  });
});
