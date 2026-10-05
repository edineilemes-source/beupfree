import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CatalogResults from "./CatalogResults";
import CatalogFilterSidebar from "./CatalogFilterSidebarV2";
import { computeFacets } from "../lib/catalogFilters";
import { filtersFromSearch, catalogEmptyState, toggleFilterSearch, clearFiltersSearch } from "../lib/catalogState";

function render(search: string, query = "", demonstrative = false, total = 0, isLoading = false, isError = false) {
  const filters = filtersFromSearch(search);
  const sidebar = createElement(CatalogFilterSidebar, {
    facets: computeFacets([]), filters,
    onToggle() {}, onPriceChange() {}, onClearAll() {},
  });
  return renderToStaticMarkup(createElement(CatalogResults, {
    sidebar, isLoading, isError, demonstrative,
    emptyState: catalogEmptyState(total, filters, query),
    children: createElement("div", { "data-testid": "fixture-grid" }, "Produto fixture"),
  }));
}

test("T01 vazio operacional conserva sidebar, chip individual, limpar e controles", () => {
  const search = "marca=marca-inexistente&priceMin=200&priceMax=500";
  const html = render(search);
  for (const id of ["active-filters", "chip-marca-marca-inexistente", "chip-price", "button-limpar-todos", "input-price-min", "input-price-max", "filter-marca-Nike", "section-desconto"]) {
    assert.ok(html.includes(`data-testid="${id}"`), id);
  }
  assert.ok(html.includes("text-no-results"));
  assert.equal(html.includes("Nenhum produto disponível ainda"), false);
  const removed = toggleFilterSearch(search, "marca", "marca-inexistente");
  assert.deepEqual(filtersFromSearch(removed).marca, []);
  assert.deepEqual(filtersFromSearch(removed).price, [200, 500]);
  assert.equal(render(clearFiltersSearch(search)).includes("active-filters"), false);
});

test("T02 render distingue busca/filtro vazio de consulta base vazia em ambos os modos", () => {
  for (const demo of [false, true]) {
    for (const [search, query] of [["marca=inexistente", ""], ["", "inexistente"], ["priceMax=0", ""]]) {
      const html = render(search, query, demo);
      assert.ok(html.includes('data-testid="text-no-results"'));
      assert.equal(html.includes('data-testid="text-empty-catalog"'), false);
      assert.ok(html.includes('data-testid="button-limpar-todos"'));
    }
    const base = render("", "", demo);
    assert.ok(base.includes('data-testid="text-empty-catalog"'));
    assert.equal(base.includes('data-testid="text-no-results"'), false);
  }
});

test("loading e erro mantêm recuperação e não exibem uma mensagem vazia falsa", () => {
  for (const [loading, error] of [[true, false], [false, true]]) {
    const html = render("marca=inexistente", "", false, 0, loading, error);
    assert.ok(html.includes('data-testid="chip-marca-inexistente"'));
    assert.ok(html.includes('data-testid="button-limpar-todos"'));
    assert.equal(html.includes('data-testid="text-empty-catalog"'), false);
    assert.equal(html.includes('data-testid="text-no-results"'), false);
  }
});

test("resultados positivos continuam mostrando children/grid", () => {
  const html = render("marca=Nike", "", false, 3);
  assert.ok(html.includes('data-testid="fixture-grid"'));
  assert.equal(html.includes('data-testid="text-no-results"'), false);
  assert.ok(html.includes('data-testid="chip-marca-Nike"'));
});
