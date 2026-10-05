import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { catalogRequestParams, filtersFromSearch } from "../lib/catalogState";

const source = readFileSync(new URL("./CatalogV2.tsx", import.meta.url), "utf8");

test("catálogo operacional pagina e filtra sem baixar lote global", () => {
  const params = catalogRequestParams(filtersFromSearch("marca=Nike&priceMin=200"), "tenis", "menor-preco", 3, 21);
  assert.equal(params.get("limit"), "21");
  assert.equal(params.get("offset"), "42");
  assert.equal(params.get("priceMin"), "200");
  assert.equal(params.get("marca"), "Nike");
  assert.match(source, /catalogRequestParams\(filters, query, sortMode, page, PAGE_SIZE\)/);
  assert.match(source, /response\.serverDriven/);
});

test("fallback demo preserva snapshot local e total operacional vem da API", () => {
  assert.match(source, /const fallback=await fetch\("\/api\/products\?limit=5000"\)/);
  assert.match(source, /data\?\.total\?\?0/);
});
