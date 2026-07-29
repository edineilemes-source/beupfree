import { expect, test, type Page } from "@playwright/test";

const FAVORITES_STORAGE_KEY = "beupfree:favorites:v1";

async function clearFavorites(page: Page) {
  await page.goto("/");
  await page.evaluate((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, FAVORITES_STORAGE_KEY);
}

async function favoriteFirstProduct(page: Page, gridTestId: string) {
  const grid = page.getByTestId(gridTestId);
  const card = grid.locator('[data-testid^="card-product-"]').first();

  await expect(card).toBeVisible();
  const cardTestId = await card.getAttribute("data-testid");
  const productId = cardTestId?.replace("card-product-", "");
  expect(productId).toBeTruthy();
  const favoriteButton = card.getByTestId(`button-favorite-${productId}`);

  await expect(favoriteButton).toHaveAccessibleName("Adicionar aos Favoritos");
  await favoriteButton.click();
  await expect(favoriteButton).toHaveAttribute("aria-pressed", "true");
  await expect(favoriteButton).toHaveAccessibleName("Remover dos Favoritos");

  return productId!;
}

async function waitForProductsOrEmptyState(page: Page, gridTestId: string) {
  const grid = page.getByTestId(gridTestId);
  const emptyCatalog = page.getByTestId("text-empty-catalog");
  const emptyBrand = page.getByText(/Marca não encontrada|Nenhuma oferta disponível/);

  await expect.poll(async () =>
    await grid.count() + await emptyCatalog.count() + await emptyBrand.count(),
  ).toBeGreaterThan(0);

  return grid;
}

test.beforeEach(async ({ page }) => {
  await clearFavorites(page);
});

test("favorita, persiste e remove um produto pelo drawer", async ({ page }) => {
  await page.goto("/catalogo");

  const productId = await favoriteFirstProduct(page, "grid-catalog-products");
  await expect(page.getByTestId("text-favorites-count")).toHaveText("1");

  await page.getByTestId("item-favoritos").click();
  await expect(page.getByTestId(`favorite-item-${productId}`)).toBeVisible();
  await expect(page.getByTestId(`favorite-missing-${productId}`)).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("1");

  await page.getByTestId("item-favoritos").click();
  await expect(page.getByTestId(`favorite-item-${productId}`)).toBeVisible();
  await expect(page.getByTestId(`favorite-missing-${productId}`)).toHaveCount(0);

  await page.getByTestId(`button-remove-favorite-${productId}`).click();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("0");
  await expect(
    page.getByText("Você ainda não salvou nenhum produto."),
  ).toBeVisible();
});

test("resolve o produto favoritado no catálogo antigo", async ({ page }) => {
  await page.goto("/catalogo-antigo");

  const grid = await waitForProductsOrEmptyState(page, "grid-catalog-products");
  test.skip(await grid.count() === 0, "Catálogo antigo sem produtos disponíveis");

  const productId = await favoriteFirstProduct(page, "grid-catalog-products");
  await page.getByTestId("item-favoritos").click();

  await expect(page.getByTestId(`favorite-item-${productId}`)).toBeVisible();
  await expect(page.getByTestId(`favorite-missing-${productId}`)).toHaveCount(0);
});

test("resolve o produto favoritado em uma rota de marca", async ({ page }) => {
  await page.goto("/marca/nike");

  const grid = await waitForProductsOrEmptyState(page, "grid-brand-products");
  test.skip(await grid.count() === 0, "Rota da marca sem produtos disponíveis");

  const productId = await favoriteFirstProduct(page, "grid-brand-products");
  await page.getByTestId("item-favoritos").click();

  await expect(page.getByTestId(`favorite-item-${productId}`)).toBeVisible();
  await expect(page.getByTestId(`favorite-missing-${productId}`)).toHaveCount(0);
});
