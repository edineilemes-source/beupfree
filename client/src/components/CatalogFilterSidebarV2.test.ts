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

test("seleções zeradas da API continuam como controles e chips removíveis", () => {
  const html = render("marca=Asics&cor=preto&tamanho=40&genero=Masculino&modalidade=Corrida");
  for (const label of ["Preto", "40", "Masculino", "Corrida", "Asics"]) {
    assert.ok(html.toLowerCase().includes(label.toLowerCase()), label);
  }
  assert.ok(html.includes('data-testid="chip-cor-preto"'));
  assert.ok(html.includes('data-testid="button-limpar-todos"'));
});


test("vitrine inicia com todos os grupos recolhidos, incluindo Cor, Tamanho e Preço",()=>{
 const html=render("cor=preto&tamanho=40&marca=Nike&priceMin=200");
 const buttons=html.match(/<button\b[^>]*data-testid="section-[^"]+"[^>]*>/g)??[];
 assert.ok(buttons.length>=5,"deve haver seções de filtros para recolher");
 assert.ok(buttons.every(button=>button.includes('aria-expanded="false"')),
   "nenhuma seção pode iniciar expandida");
 for(const section of ["marca","cor","tamanho","preço","desconto","frete grátis"]){
  assert.ok(buttons.some(button=>button.includes('data-testid="section-'+section+'"')),
   "seção não encontrada: "+section);
 }
 const panels=html.match(/<div\b[^>]*\bhidden=""/g)??[];
 assert.equal(panels.length,buttons.length,"cada grupo precisa ter conteúdo oculto no carregamento");
 assert.ok(input(html,"input-price-min").includes('value="200"'),
   "recolher o preço não pode apagar filtros vindos da URL");
 assert.ok(html.includes('data-testid="chip-cor-preto"'),
   "chips selecionados devem continuar visíveis mesmo com a lista fechada");
 assert.ok(html.includes('data-testid="chip-tamanho-40"'));
});
