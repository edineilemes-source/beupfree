import assert from "node:assert/strict";
import { test } from "node:test";
import { groupCatalogPage, organizerFirstColumnValues } from "./CatalogOrganizer";
import type { CatalogProduct } from "@/lib/catalogFilters";

function product(id: string, brand: string, gender: "MASCULINO" | "FEMININO", size: string): CatalogProduct {
  return {
    id, mainName: `Tênis ${brand} ${size} Br`, mainImageUrl: null,
    primaryColor: null, brand: { name: brand }, category: { name: "Tênis" },
    gender, averageRating: null, totalReviews: 0,
    bestOffer: { currentPrice: "100", originalPrice: "200", discountPercent: 50, affiliateUrl: "#", freeShipping: false },
  };
}
const products = [
  product("1", "Nike", "MASCULINO", "40"),
  product("2", "Adidas", "MASCULINO", "40"),
  product("3", "Nike", "FEMININO", "38"),
];

test("without grouping the existing product order is preserved", () => {
  const rows = groupCatalogPage(products, []);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].products.map(p => p.id), ["1", "2", "3"]);
});
test("all three dimensions create separate groups and retain product order", () => {
  const rows = groupCatalogPage(products, ["genero", "tamanho", "marca"]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row.title), [
    "Feminino › 38 › Nike",
    "Masculino › 40 › Adidas",
    "Masculino › 40 › Nike",
  ]);
  assert.deepEqual(rows.find(row => row.title === "Masculino › 40 › Nike")?.products.map(p => p.id), ["1"]);
});
test("single brand dimension separates cards by brand", () => {
  const rows = groupCatalogPage(products, ["marca"]);
  assert.deepEqual(rows.map(row => row.title), ["Adidas", "Nike"]);
  assert.deepEqual(rows.find(row => row.title === "Nike")?.products.map(p => p.id), ["1", "3"]);
  assert.deepEqual(rows.find(row => row.title === "Adidas")?.products.map(p => p.id), ["2"]);
});
test("two dimensions separate each combination", () => {
  const rows = groupCatalogPage(products, ["marca", "genero"]);
  assert.deepEqual(rows.map(row => row.title), ["Adidas › Masculino", "Nike › Feminino", "Nike › Masculino"]);
});

test("products with unknown grouping attributes are not discarded", () => {
  const unknown = { ...product("4", "Puma", "MASCULINO", "41"), gender: null, mainName: "Tênis Puma" };
  const rows = groupCatalogPage([...products, unknown], ["genero", "marca"]);
  assert.equal(rows.reduce((total, row) => total + row.products.length, 0), 4);
  assert.ok(rows.some(row => row.title.includes("Não identificado")));
});

test("discount buckets sort descending when nested under brand", () => {
  const discounted = [
    { ...product("a", "Nike", "MASCULINO", "40"), bestOffer: { ...product("a", "Nike", "MASCULINO", "40").bestOffer!, discountPercent: 50 } },
    { ...product("b", "Nike", "MASCULINO", "41"), bestOffer: { ...product("b", "Nike", "MASCULINO", "41").bestOffer!, discountPercent: 70 } },
    { ...product("c", "Nike", "MASCULINO", "42"), bestOffer: { ...product("c", "Nike", "MASCULINO", "42").bestOffer!, discountPercent: 60 } },
  ];
  const rows = groupCatalogPage(discounted, ["marca", "desconto"]);
  assert.deepEqual(rows.map(row => row.title), ["Nike › 70%+", "Nike › 60%+", "Nike › 50%+"]);
});
test("discount buckets sort descending as first grouping criterion", () => {
  const rows = groupCatalogPage([
    { ...products[0], bestOffer: { ...products[0].bestOffer!, discountPercent: 30 } },
    { ...products[1], bestOffer: { ...products[1].bestOffer!, discountPercent: 80 } },
  ], ["desconto", "marca"]);
  assert.deepEqual(rows.map(row => row.title), ["80%+ › Adidas", "30%+ › Nike"]);
});


test("selected brands remain visible as columns before their products load", () => {
  const rows = groupCatalogPage([product("1", "Nike", "MASCULINO", "40")], ["marca"]);
  assert.deepEqual(organizerFirstColumnValues(rows, "marca", ["Nike", "Adidas", "Puma"]), ["Adidas", "Nike", "Puma"]);
});

test("selected brand labels do not create duplicate columns when casing differs", () => {
  const rows = groupCatalogPage([product("1", "adidas", "MASCULINO", "40")], ["marca"]);
  assert.deepEqual(organizerFirstColumnValues(rows, "marca", ["Adidas"]), ["Adidas"]);
});
