import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Sidebar from "./CatalogFilterSidebarV2";
import { computeFacets } from "../lib/catalogFilters";
import { filtersFromSearch } from "../lib/catalogState";

function render(search: string, priceMin = 250, priceMax = 400) {
  return renderToStaticMarkup(createElement(Sidebar, {
    facets: { ...computeFacets([]), priceMin, priceMax }, filters: filtersFromSearch(search),
    onToggle() {}, onPriceChange() {}, onClearAll() {},
  }));
}

function input(html: string, id: string): string {
  const tag = html.match(new RegExp(`<input[^>]*data-testid="${id}"[^>]*>`));
  assert.ok(tag, id);
  return tag[0];
}

test("URL com dois extremos é exibida sem ser substituída por facets estreitas/vazias", () => {
  for (const [min, max] of [[250, 400], [0, 0]]) {
    const html = render("priceMin=200&priceMax=500", min, max);
    assert.ok(html.includes("R$ 200 – R$ 500"));
    assert.ok(input(html, "input-price-min").includes('value="200"'));
    assert.ok(input(html, "input-price-max").includes('value="500"'));
    assert.ok(input(html, "range-price-min").includes('min="200"') || min === 0);
    assert.ok(input(html, "range-price-max").includes('max="500"'));
  }
});

test("apenas mínimo tem chip explícito e não apresenta máximo sugerido como selecionado", () => {
  const html = render("priceMin=200");
  assert.ok(html.includes("A partir de R$ 200"));
  assert.ok(input(html, "input-price-min").includes('value="200"'));
  assert.ok(input(html, "input-price-max").includes('value=""'));
  assert.ok(input(html, "input-price-max").includes('placeholder="400"'));
});

test("apenas máximo tem chip explícito e mantém mínimo em aberto", () => {
  const html = render("priceMax=500");
  assert.ok(html.includes("Até R$ 500"));
  assert.ok(input(html, "input-price-min").includes('value=""'));
  assert.ok(input(html, "input-price-max").includes('value="500"'));
});

test("sem preço não cria chip de preço ou limites selecionados", () => {
  const html = render("");
  assert.equal(html.includes('data-testid="chip-price"'), false);
  assert.ok(input(html, "input-price-min").includes('value=""'));
  assert.ok(input(html, "input-price-max").includes('value=""'));
});
