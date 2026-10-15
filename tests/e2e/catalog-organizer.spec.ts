import { expect, test } from "@playwright/test";

test("organizador mantém catálogo plano e permite agrupar por filtro ativo", async ({ page }) => {
  await page.goto("/catalogo");
  const organizer = page.getByTestId("catalog-organizer");
  const grid = page.getByTestId("grid-catalog-products");
  await expect(grid).toBeVisible();
  await expect(grid.locator('[data-testid^="card-product-"]').first()).toBeVisible();
  await expect(organizer.getByTestId("organizer-group")).toHaveCount(0);

  await page.getByTestId("button-organize").click();
  await expect(page.getByTestId("panel-organize")).toBeVisible();
  await expect(page.getByTestId("organizer-sort")).toHaveValue("maior-desconto");
  await expect(page.getByTestId("organizer-available")).toContainText("Selecione filtros");

  // Choose a real available brand, preserving the existing filter contract.
  const brandOptions = page.locator('[data-testid^="filter-marca-"]');
  await expect(brandOptions.first()).toBeVisible();
  await brandOptions.first().click();
  await expect(page.getByTestId("organizer-available").getByRole("button", { name: /Marca/ })).toBeVisible();
  await expect(organizer.getByTestId("organizer-group")).toHaveCount(0);

  await page.getByTestId("organizer-available").getByRole("button", { name: /Marca/ }).click();
  await expect(page.getByTestId("organizer-slot-0")).toContainText("Marca");
  await expect(organizer.getByTestId("organizer-group")).toHaveCount(1);
  await expect(organizer.getByTestId("organizer-group").locator('[data-testid^="card-product-"]').first()).toBeVisible();

  await page.getByRole("button", { name: "Limpar grupos" }).click();
  await expect(organizer.getByTestId("organizer-group")).toHaveCount(0);
  await expect(grid).toBeVisible();
});
