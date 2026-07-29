import { expect, test, type Page } from "@playwright/test";

const COMPARISON_STORAGE_KEY = "beupfree:comparison:v1";

async function resetComparison(page: Page) {
  await page.goto("/");
  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, COMPARISON_STORAGE_KEY);
}

async function openCatalogCards(page: Page) {
  await page.goto("/catalogo");
  const cards = page
    .getByTestId("grid-catalog-products")
    .locator('[data-testid^="card-product-"]');
  await expect(cards.nth(1)).toBeVisible();
  return cards;
}

test.beforeEach(async ({ page }) => {
  await resetComparison(page);
});

test("mostra estado vazio e volta ao catálogo", async ({ page }) => {
  await page.goto("/comparar");

  await expect(
    page.getByText("Nenhum produto selecionado para comparação."),
  ).toBeVisible();
  await page.getByTestId("button-back-to-catalog").click();
  await expect(page).toHaveURL(/\/catalogo$/);
});

test("orienta selecionar outro produto e permite continuar comprando", async ({ page }) => {
  const cards = await openCatalogCards(page);
  await cards.nth(0).locator('[data-testid^="button-compare-"]').click();

  await page.goto("/comparar");
  await expect(
    page.getByText("Selecione mais um produto para comparar."),
  ).toBeVisible();
  await page.getByTestId("button-continue-shopping").click();
  await expect(page).toHaveURL(/\/catalogo$/);
});

test("navega pelo tray, mostra dois produtos e permite remover", async ({ page }) => {
  const cards = await openCatalogCards(page);
  await cards.nth(0).locator('[data-testid^="button-compare-"]').click();
  await cards.nth(1).locator('[data-testid^="button-compare-"]').click();

  await page.getByTestId("button-open-comparison").click();
  await expect(page).toHaveURL(/\/comparar$/);
  await expect(page.getByTestId("comparison-page-title")).toBeVisible();
  await expect(page.getByTestId("comparison-products-grid")).toBeVisible();
  await expect(
    page.locator('[data-testid^="comparison-page-card-"]'),
  ).toHaveCount(2);

  await page.locator('[data-testid^="button-remove-comparison-page-"]').first().click();
  await expect(
    page.getByText("Selecione mais um produto para comparar."),
  ).toBeVisible();
});

test("limpa a comparação pela página", async ({ page }) => {
  const cards = await openCatalogCards(page);
  await cards.nth(0).locator('[data-testid^="button-compare-"]').click();
  await cards.nth(1).locator('[data-testid^="button-compare-"]').click();
  await page.getByTestId("button-open-comparison").click();

  await page.getByTestId("button-clear-comparison-page").click();
  await expect(
    page.getByText("Nenhum produto selecionado para comparação."),
  ).toBeVisible();
  await expect(page.getByTestId("comparison-tray")).toHaveCount(0);
});
