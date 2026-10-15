import assert from "node:assert/strict";
import { test } from "node:test";
import { groupCatalogPage } from "./CatalogOrganizer";
import type { CatalogProduct } from "@/lib/catalogFilters";

function product(id: string, brand: string, gender: "masculino" | "feminino", size: string): CatalogProduct {
  return {
    id, mainName: `Tênis ${brand} ${size} Br`, mainImageUrl: null,
    primaryColor: null, brand: { name: brand }, category: { name: "Tênis" },
    gender, averageRating: null, totalReviews: 0,
    bestOffer: { currentPrice: "100", originalPrice: "200", discountPercent: 50, affiliateUrl: "#", freeShipping: false },
  };
}
const products = [
  product("1", "Nike", "masculino", "40"),
  product("2", "Adidas", "masculino", "40"),
  product("3", "Nike", "feminino", "38"),
];

test("without grouping the existing product order is preserved", () => {
  const rows = groupCatalogPage(products, []);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].products.map(p => p.id), ["1", "2", "3"]);
});
test("last dimension combines brands alphabetically and preserves card order", () => {
  const rows = groupCatalogPage(products, ["genero", "tamanho", "marca"]);
  assert.equal(rows.length, 2);
  const male = rows.find(row => row.title.includes("Masculino"));
  assert.ok(male);
  assert.match(male.title, /40 › Adidas, Nike/);
  assert.deepEqual(male.products.map(p => p.id), ["1", "2"]);
});
test("single dimension combines all its values in one row", () => {
  const rows = groupCatalogPage(products, ["marca"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Adidas, Nike");
  assert.equal(rows[0].products.length, 3);
});
