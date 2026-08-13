import { test, expect } from "./support/fixture";
import { clearBrowserState } from "./support/actions";

test.beforeEach(async ({ monitoredPage }) => clearBrowserState(monitoredPage));

test("catálogo, cards, busca dinâmica, limpeza e estado sem resultado", async ({ monitoredPage: page }) => {
  await page.goto("/catalogo");
  const grid = page.getByTestId("grid-catalog-products");
  const cards = grid.locator('[data-testid^="card-product-"]');
  await expect(cards.first()).toBeVisible();
  const first = cards.first();
  await expect(first.locator('[data-testid^="text-product-name-"]')).toBeVisible();
  await expect(first.locator('[data-testid^="text-price-"]')).toBeVisible();
  await expect(first.locator('[data-testid^="img-product-"]')).toBeVisible();

  const name = (await first.locator('[data-testid^="text-product-name-"]').innerText()).trim();
  const query = name.split(/\s+/).find((token) => token.length >= 4) ?? name;
  await page.getByTestId("input-search").fill(query);
  await page.getByTestId("input-search").press("Enter");
  await expect(page.getByTestId("text-catalog-title")).toContainText(query);
  await expect(cards.first()).toContainText(new RegExp(query, "i"));
  await page.getByTestId("button-clear-search").click();
  await expect(page).not.toHaveURL(/busca=/);

  await page.getByTestId("input-search").fill(`qa-sem-resultado-${crypto.randomUUID()}`);
  await page.getByTestId("input-search").press("Enter");
  await expect(page.getByTestId("text-no-results")).toBeVisible();
  await page.getByTestId("button-clear-search").click();
  await expect(cards.first()).toBeVisible();
});

test("aplica e remove um filtro disponível sem quebrar o grid", async ({ monitoredPage: page }) => {
  await page.goto("/catalogo");
  await expect(page.getByTestId("grid-catalog-products")).toBeVisible();
  const option = page.locator('[data-testid^="filter-cor-"]').first();
  await expect(option).toBeVisible();
  const value = (await option.getAttribute("data-testid"))!.replace("filter-cor-", "");
  await option.click();
  await expect.poll(() => new URL(page.url()).searchParams.get("cor")).toBe(value);
  await expect(page.getByTestId("grid-catalog-products")).toBeVisible();
  await page.getByTestId(`chip-cor-${value}`).click();
  await expect.poll(() => new URL(page.url()).searchParams.has("cor")).toBe(false);
});
