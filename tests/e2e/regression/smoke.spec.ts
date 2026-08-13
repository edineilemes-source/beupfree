import { test, expect } from "./support/fixture";

test("smoke global das páginas e ações principais", async ({ monitoredPage: page }) => {
  const home = await page.goto("/");
  expect(home?.status()).toBeLessThan(500);
  await expect(page.getByRole("img", { name: /UpPulse/ })).toBeVisible();
  await expect(page.getByTestId("input-search")).toBeVisible();
  await expect(page.getByTestId("item-favoritos")).toBeVisible();
  await expect(page.getByTestId("item-entrar")).toBeVisible();

  await page.getByTestId("link-ofertas").click();
  await expect(page).toHaveURL(/\/catalogo/);
  await expect(page.getByTestId("grid-catalog-products")).toBeVisible();
});
