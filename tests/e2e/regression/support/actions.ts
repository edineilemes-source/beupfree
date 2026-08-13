import { expect, type Page } from "@playwright/test";
import { TEST_EMAIL_PREFIX } from "./environment";

export const PASSWORD = "senha123";
let sequence = 0;
export function persona(label: string) {
  const token = `${Date.now()}-${process.pid}-${sequence++}-${crypto.randomUUID()}`;
  return { name: `QA ${label}`, email: `${TEST_EMAIL_PREFIX}${token}@example.test`, password: PASSWORD };
}

export async function clearBrowserState(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.context().clearCookies();
  await page.reload();
}

export async function register(page: Page, user: ReturnType<typeof persona>) {
  await page.getByTestId("item-entrar").click();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Nome").fill(user.name);
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(user.password);
  await page.getByLabel("Confirmar senha").fill(user.password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByTestId("item-usuario")).toContainText(user.name);
}

export async function login(page: Page, user: ReturnType<typeof persona>) {
  await page.getByTestId("item-entrar").click();
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByTestId("item-usuario")).toContainText(user.name);
}

export async function catalogProductIds(page: Page, count = 2) {
  await page.goto("/catalogo");
  const cards = page.getByTestId("grid-catalog-products").locator('[data-testid^="card-product-"]');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count(), `Catálogo precisa ter ao menos ${count} produtos`).toBeGreaterThanOrEqual(count);
  return Promise.all(Array.from({ length: count }, async (_, index) =>
    (await cards.nth(index).getAttribute("data-testid"))!.replace("card-product-", "")));
}

export async function addFavorite(page: Page, productId: string) {
  const button = page.getByTestId(`button-favorite-${productId}`).last();
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

export async function openFavorites(page: Page) {
  await page.getByTestId("item-favoritos").click();
  await expect(page.getByRole("heading", { name: "Favoritos" })).toBeVisible();
}
