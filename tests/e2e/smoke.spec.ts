import { expect, test } from "@playwright/test";

test("carrega a página inicial e navega para o catálogo", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.ok()).toBeTruthy();
  await expect(
    page.getByRole("img", { name: "UpPulse" }),
  ).toBeVisible();

  await page.goto("/catalogo");

  await expect(page).toHaveURL(/\/catalogo$/);
  await expect(
    page.getByRole("heading", { name: "Produtos com desconto" }),
  ).toBeVisible();
});
