import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./CatalogV2.tsx", import.meta.url), "utf8");

test("catálogo operacional pagina e filtra sem baixar lote global", () => {
  assert.match(source, /limit:String\(PAGE_SIZE\)/);
  assert.match(source, /offset:String\(\(page-1\)\*PAGE_SIZE\)/);
  assert.match(source, /response\.serverDriven/);
});

test("fallback demo preserva snapshot local e total operacional vem da API", () => {
  assert.match(source, /const fallback=await fetch\("\/api\/products\?limit=5000"\)/);
  assert.match(source, /data\?\.total\?\?0/);
});
