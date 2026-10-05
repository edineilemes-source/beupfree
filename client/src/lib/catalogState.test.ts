import assert from "node:assert/strict";
import test from "node:test";
import { applyFilters, computeCrossFacets, type CatalogProduct } from "./catalogFilters";
import {
  URL_FILTER_KEYS, filtersFromSearch, priceSearch, toggleFilterSearch,
  querySearch, queryFromSearch, clearFiltersSearch, catalogLocation,
  catalogRequestParams, localCatalogFilters, catalogScope, catalogPage,
  catalogEmptyState, catalogPriceControls, changeCatalogPrice,
  type CatalogPrice, type CatalogSortMode,
} from "./catalogState";

const combination = "marca=nike&priceMin=200&priceMax=500&desconto=30%25+-+39%25";
const price = (search: string) => filtersFromSearch(search).price;

for (const [name, search, expected] of [
  ["T03 somente priceMin", "priceMin=200", [200, null]],
  ["T04 somente priceMax", "priceMax=500", [null, 500]],
  ["T05 ambos os limites", "priceMin=200&priceMax=500", [200, 500]],
] as const) {
  test(name, () => {
    const filters = filtersFromSearch(search);
    assert.deepEqual(filters.price, expected);
    const request = catalogRequestParams(filters, "", "maior-desconto", 1, 21);
    assert.equal(request.get("priceMin"), expected[0] === null ? null : String(expected[0]));
    assert.equal(request.get("priceMax"), expected[1] === null ? null : String(expected[1]));
    assert.equal(request.has("price"), false);
  });
}

test("preço zero e decimal são válidos; inválidos não viram zero ou Infinity", () => {
  assert.deepEqual(price("priceMin=0&priceMax=500.25"), [0, 500.25]);
  for (const raw of ["", "NaN", "Infinity", "abc", "-1", " "]) {
    assert.deepEqual(price(`priceMin=${encodeURIComponent(raw)}&priceMax=500`), [null, 500]);
  }
  assert.equal(price("priceMin=abc&priceMax="), null);
  // Don't invent a new backend range policy: an inverted URL remains reconstructible.
  assert.deepEqual(price("priceMin=500&priceMax=200"), [500, 200]);
});

test("T06 definir preço preserva multi-select, busca e parâmetros não relacionados", () => {
  const updated = priceSearch("marca=Nike,Adidas&genero=Masculino&busca=tenis&extra=keep", [200, 500]);
  const params = new URLSearchParams(updated);
  assert.deepEqual(price(updated), [200, 500]);
  assert.deepEqual(filtersFromSearch(updated).marca, ["Nike", "Adidas"]);
  assert.equal(params.get("busca"), "tenis");
  assert.equal(params.get("extra"), "keep");
  assert.equal(params.get("genero"), "Masculino");
  assert.equal(catalogLocation(updated), `/catalogo?${updated}`);
});

for (const [key, value] of [
  ["marca", "Adidas"], ["desconto", "50% ou mais"], ["cor", "preto"],
  ["tamanho", "40"], ["genero", "Masculino"], ["idade", "Adulto"],
  ["modalidade", "Corrida"], ["tipo", "Calçados"], ["frete", "Não"],
  ["avaliacao", "4 estrelas ou mais"],
] as const) {
  test(`T07/T08/T09 toggle ${key} preserva preço e demais dimensões`, () => {
    const updated = toggleFilterSearch(combination, key, value);
    assert.deepEqual(price(updated), [200, 500]);
    assert.ok(filtersFromSearch(updated)[key].includes(value));
    if (key !== "marca") assert.deepEqual(filtersFromSearch(updated).marca, ["nike"]);
    if (key !== "desconto") assert.deepEqual(filtersFromSearch(updated).desconto, ["30% - 39%"]);
    assert.deepEqual(price(toggleFilterSearch(updated, key, value)), [200, 500]);
  });
}

test("T10 busca pelo mesmo helper do Header preserva preço e filtros", () => {
  const updated = querySearch(`${combination}&q=antiga`, "  tênis azul  ");
  assert.equal(queryFromSearch(updated), "tênis azul");
  assert.equal(new URLSearchParams(updated).has("q"), false);
  assert.deepEqual(price(updated), [200, 500]);
  assert.deepEqual(filtersFromSearch(updated).marca, ["nike"]);
  assert.deepEqual(filtersFromSearch(updated).desconto, ["30% - 39%"]);
});

test("T11 limpar SOMENTE busca mantém preço e demais filtros", () => {
  const updated = querySearch(`${combination}&q=alias&busca=tenis`, "");
  assert.equal(queryFromSearch(updated), "");
  assert.deepEqual(price(updated), [200, 500]);
  assert.deepEqual(filtersFromSearch(updated).marca, ["nike"]);
  assert.deepEqual(filtersFromSearch(updated).desconto, ["30% - 39%"]);
  assert.equal(new URLSearchParams(updated).has("busca"), false);
  assert.equal(new URLSearchParams(updated).has("q"), false);
});

test("T12 remover preço remove apenas priceMin/priceMax", () => {
  const updated = priceSearch(`${combination}&busca=tenis`, null);
  assert.equal(price(updated), null);
  assert.deepEqual(filtersFromSearch(updated).marca, ["nike"]);
  assert.deepEqual(filtersFromSearch(updated).desconto, ["30% - 39%"]);
  assert.equal(queryFromSearch(updated), "tenis");
  assert.equal(new URLSearchParams(updated).has("priceMin"), false);
  assert.equal(new URLSearchParams(updated).has("priceMax"), false);
});

test("T13 limpar filtros remove todos os multi-select e preço, conservando busca", () => {
  const params = new URLSearchParams(combination);
  URL_FILTER_KEYS.forEach(key => params.set(key, key === "cor" ? "preto" : "valor"));
  params.set("busca", "tenis");
  params.set("extra", "keep");
  const updated = clearFiltersSearch(params.toString());
  const parsed = filtersFromSearch(updated);
  assert.equal(parsed.price, null);
  URL_FILTER_KEYS.forEach(key => assert.deepEqual(parsed[key], []));
  assert.equal(queryFromSearch(updated), "tenis");
  assert.equal(new URLSearchParams(updated).get("extra"), "keep");
  assert.equal(catalogLocation(clearFiltersSearch(combination)), "/catalogo");
});

test("T14 refresh reconstrói preço sem depender de estado anterior", () => {
  const saved = priceSearch("marca=Nike&busca=tenis", [200, 500]);
  const original = filtersFromSearch(saved);
  original.marca.push("Outro");
  original.price![0] = 1;
  const refreshed = filtersFromSearch(saved);
  assert.deepEqual(refreshed.price, [200, 500]);
  assert.deepEqual(refreshed.marca, ["Nike"]);
});

test("T15 back/forward reconstroem URLs com limites completos, parciais e removidos", () => {
  const history = ["priceMin=200", "priceMin=200&priceMax=500", "priceMax=300", ""];
  const expected = [[200, null], [200, 500], [null, 300], null];
  for (const index of [0, 1, 2, 3, 2, 1, 0, 1, 2, 3]) {
    assert.deepEqual(price(history[index]), expected[index]);
  }
});

const initialFilters = filtersFromSearch(combination);
const initialScope = catalogScope(initialFilters, "", "maior-desconto");
for (const [name, nextSearch, nextQuery, nextSort] of [
  ["T16 filtro", toggleFilterSearch(combination, "marca", "Adidas"), "", "maior-desconto"],
  ["T17 preço", priceSearch(combination, [250, 500]), "", "maior-desconto"],
  ["T18 busca", combination, "tenis", "maior-desconto"],
  ["T19 ordenação", combination, "", "menor-preco"],
] as const) {
  test(`${name} alterado usa página 1 e offset 0 já na primeira consulta`, () => {
    const oldPage = { scope: initialScope, page: 4 };
    const filters = filtersFromSearch(nextSearch);
    const scope = catalogScope(filters, nextQuery, nextSort);
    const page = catalogPage(oldPage, scope);
    assert.equal(page, 1);
    assert.equal(catalogRequestParams(filters, nextQuery, nextSort, page, 21).get("offset"), "0");
    // Once the component commits that reset, returning to the old URL is also page 1.
    assert.equal(catalogPage({ scope, page: 1 }, initialScope), 1);
  });
}

test("paginação normal e os quatro sorts existentes permanecem disponíveis", () => {
  assert.equal(catalogPage({ scope: initialScope, page: 4 }, initialScope), 4);
  for (const [sort, expected] of Object.entries({
    "maior-desconto": "discount-desc", relevantes: "recommended", "menor-preco": "price-asc", recentes: "recent-desc",
  })) {
    const params = catalogRequestParams(initialFilters, "Tênis azul", sort as CatalogSortMode, 4, 21);
    assert.equal(params.get("offset"), "63");
    assert.equal(params.get("limit"), "21");
    assert.equal(params.get("sort"), expected);
    assert.equal(params.get("q"), "Tênis azul");
  }
});

test("T20 marca + preço + desconto mantém cada valor após alterar cor", () => {
  const updated = toggleFilterSearch(combination, "cor", "preto");
  const parsed = filtersFromSearch(updated);
  const request = catalogRequestParams(parsed, "", "maior-desconto", 1, 21);
  for (const [key, expected] of Object.entries({ marca: "nike", priceMin: "200", priceMax: "500", desconto: "30% - 39%", cor: "preto" })) {
    assert.equal(request.get(key), expected);
  }
});

test("facet estreita ou vazia não apaga nem substitui valor selecionado", () => {
  for (const [min, max] of [[250, 400], [0, 0]]) {
    const selected: CatalogPrice = [200, 500];
    const controls = catalogPriceControls(selected, min, max);
    assert.deepEqual(controls.values, selected);
    assert.ok(controls.min <= 200);
    assert.ok(controls.max >= 500);
    assert.deepEqual(selected, [200, 500]);
  }
  assert.deepEqual(catalogPriceControls([200, null], 250, 400).values, [200, 400]);
  assert.deepEqual(catalogPriceControls([null, 500], 250, 400).values, [250, 500]);
});

test("editar ou limpar um extremo não transforma limite aberto em valor da facet", () => {
  const bounds = { min: 0, max: 1000 };
  assert.deepEqual(changeCatalogPrice(null, 0, "200", bounds), [200, null]);
  assert.deepEqual(changeCatalogPrice(null, 1, "500", bounds), [null, 500]);
  assert.deepEqual(changeCatalogPrice([200, 500], 0, "", bounds), [null, 500]);
  assert.equal(changeCatalogPrice([null, 500], 1, "", bounds), null);
});

test("modo demo filtra limites parciais e combina filtros sem mudar facets cruzadas", () => {
  const makeProduct = (id: string, value: string): CatalogProduct => ({
    id, mainName: "Tênis Nike Masculino 40 Br", mainImageUrl: null, primaryColor: "preto",
    brand: { name: "nike" }, category: null, averageRating: null, totalReviews: 0,
    bestOffer: { currentPrice: value, originalPrice: "800", discountPercent: 35, affiliateUrl: "#", freeShipping: false },
  });
  const products = [makeProduct("baixo", "100"), makeProduct("meio", "300"), makeProduct("alto", "600")];
  assert.deepEqual(applyFilters(products, localCatalogFilters(filtersFromSearch("priceMin=200"))).map(p => p.id), ["meio", "alto"]);
  assert.deepEqual(applyFilters(products, localCatalogFilters(filtersFromSearch("priceMax=500"))).map(p => p.id), ["baixo", "meio"]);
  const filters = localCatalogFilters(filtersFromSearch(combination));
  assert.deepEqual(applyFilters(products, filters).map(p => p.id), ["meio"]);
  const facets = computeCrossFacets(products, filters);
  assert.equal(facets.priceMin, 100);
  assert.equal(facets.priceMax, 600);
});

test("T02 zero com busca/filtro é consulta filtrada; somente base vazia usa base", () => {
  assert.equal(catalogEmptyState(0, filtersFromSearch(""), ""), "base");
  assert.equal(catalogEmptyState(0, filtersFromSearch(""), "inexistente"), "filtered");
  assert.equal(catalogEmptyState(0, filtersFromSearch(combination), ""), "filtered");
  assert.equal(catalogEmptyState(0, filtersFromSearch("priceMin=200"), ""), "filtered");
  assert.equal(catalogEmptyState(1, filtersFromSearch(combination), ""), null);
});
