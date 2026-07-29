import { expect, test } from "@playwright/test";

const COMPARISON_STORAGE_KEY = "beupfree:comparison:v1";
const FAVORITES_STORAGE_KEY = "beupfree:favorites:v1";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(([comparisonKey, favoritesKey]) => {
    window.localStorage.removeItem(comparisonKey);
    window.localStorage.removeItem(favoritesKey);
  }, [COMPARISON_STORAGE_KEY, FAVORITES_STORAGE_KEY]);
});

test("exibe o tray e remove um produto pela barra", async ({ page }) => {
  await page.goto("/catalogo");

  const card = page
    .getByTestId("grid-catalog-products")
    .locator('[data-testid^="card-product-"]')
    .first();
  await expect(card).toBeVisible();

  const button = card.locator('[data-testid^="button-compare-"]');
  const favoriteButton = card.locator('[data-testid^="button-favorite-"]');
  await expect(button).toHaveAccessibleName("Comparar");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(favoriteButton).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("comparison-tray")).toHaveCount(0);

  await button.click();
  await expect(button).toHaveAccessibleName("Remover da comparação");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(favoriteButton).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("comparison-tray")).toBeVisible();
  await expect(page.getByTestId("comparison-tray-count")).toHaveText(
    "Comparando 1 de 3 produtos",
  );
  await expect(page.getByTestId("button-open-comparison")).toBeDisabled();

  await page.locator('[data-testid^="button-remove-comparison-"]').click();
  await expect(button).toHaveAccessibleName("Comparar");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("comparison-tray")).toHaveCount(0);

  await favoriteButton.click();
  await expect(favoriteButton).toHaveAttribute("aria-pressed", "true");
  await expect(button).toHaveAttribute("aria-pressed", "false");
});

test("habilita comparar com dois produtos e permite limpar", async ({ page }) => {
  await page.goto("/catalogo");

  const cards = page
    .getByTestId("grid-catalog-products")
    .locator('[data-testid^="card-product-"]');
  await expect(cards.nth(1)).toBeVisible();

  await cards.nth(0).locator('[data-testid^="button-compare-"]').click();
  await expect(page.getByTestId("button-open-comparison")).toBeDisabled();

  await cards.nth(1).locator('[data-testid^="button-compare-"]').click();
  await expect(page.getByTestId("comparison-tray-count")).toHaveText(
    "Comparando 2 de 3 produtos",
  );
  await expect(page.getByTestId("button-open-comparison")).toBeEnabled();

  await page.getByTestId("button-clear-comparison").click();
  await expect(page.getByTestId("comparison-tray")).toHaveCount(0);
  await expect(
    cards.nth(0).locator('[data-testid^="button-compare-"]'),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    cards.nth(1).locator('[data-testid^="button-compare-"]'),
  ).toHaveAttribute("aria-pressed", "false");
});

test("mantém o quarto produto fora da comparação ao atingir o limite", async ({ page }) => {
  await page.goto("/catalogo");

  const cards = page
    .getByTestId("grid-catalog-products")
    .locator('[data-testid^="card-product-"]');
  await expect(cards.nth(3)).toBeVisible();

  for (let index = 0; index < 3; index += 1) {
    const button = cards.nth(index).locator('[data-testid^="button-compare-"]');
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
  }

  const fourthButton = cards.nth(3).locator('[data-testid^="button-compare-"]');
  await fourthButton.click();
  await expect(fourthButton).toHaveAttribute("aria-pressed", "false");
  await expect(fourthButton).toHaveAccessibleName("Comparar");
});
