import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_STORE_LABEL, publicOfferSource } from "./publicDemo";

test("neutraliza marketplace e seller no modo público demonstrativo", () => {
  assert.equal(publicOfferSource("Mercado Livre", "Seller", true), DEMO_STORE_LABEL);
});

test("preserva e identifica claramente a loja fora do modo demonstrativo", () => {
  assert.equal(publicOfferSource("Marketplace", "Seller", false), "Loja: Marketplace · Seller");
  assert.equal(publicOfferSource("Marketplace", "Marketplace", false), "Loja: Marketplace");
});
