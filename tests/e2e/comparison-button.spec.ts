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

test("adiciona e remove um produto da comparação pelo card", async ({ page }) => {
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

  await button.click();
  await expect(button).toHaveAccessibleName("Remover da comparação");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(favoriteButton).toHaveAttribute("aria-pressed", "false");

  await button.click();
  await expect(button).toHaveAccessibleName("Comparar");
  await expect(button).toHaveAttribute("aria-pressed", "false");

  await favoriteButton.click();
  await expect(favoriteButton).toHaveAttribute("aria-pressed", "true");
  await expect(button).toHaveAttribute("aria-pressed", "false");
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
