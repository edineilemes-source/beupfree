import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_STORE_LABEL, publicOfferSource } from "./publicDemo";

test("neutraliza marketplace e seller no modo público demonstrativo", () => {
  assert.equal(publicOfferSource("Mercado Livre", "Seller", true), DEMO_STORE_LABEL);
});

test("preserva o comportamento normal fora do modo demonstrativo", () => {
  assert.equal(publicOfferSource("Marketplace", "Seller", false), "Marketplace · Seller");
});
