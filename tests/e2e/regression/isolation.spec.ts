import { test, expect } from "./support/fixture";
import { addFavorite, catalogProductIds, clearBrowserState, login, openFavorites, persona, register } from "./support/actions";

test.beforeEach(async ({ monitoredPage }) => clearBrowserState(monitoredPage));

test("usuário B nunca recebe favorito exclusivo nem flash visual do usuário A", async ({ monitoredPage: page }) => {
  const userA = persona("Conta A"), userB = persona("Conta B");
  await register(page, userA);
  const [exclusive] = await catalogProductIds(page, 1);
  await addFavorite(page, exclusive);
  await expect(page.getByTestId("text-favorites-count")).toHaveText("1");
  await page.getByTestId("button-sair").click();
  await register(page, userB);
  await expect(page.getByTestId("text-favorites-count")).toHaveText("0");
  await openFavorites(page);
  await expect(page.getByTestId(`favorite-item-${exclusive}`)).toHaveCount(0);
});

test("novo dispositivo recupera favoritos da conta pelo servidor", async ({ monitoredPage: page, browser }) => {
  const user = persona("Novo Dispositivo");
  await register(page, user);
  const [productId] = await catalogProductIds(page, 1);
  await addFavorite(page, productId);
  const context = await browser.newContext();
  const clean = await context.newPage();
  await clean.goto("/"); await login(clean, user); await openFavorites(clean);
  await expect(clean.getByTestId(`favorite-item-${productId}`)).toBeVisible();
  await context.close();
});

test("computador compartilhado não associa anônimos nem dados de A ao usuário B", async ({ monitoredPage: page }) => {
  const userA = persona("Shared A"), userB = persona("Shared B");
  const [local, exclusiveA] = await catalogProductIds(page, 2);
  await addFavorite(page, local);
  await register(page, userA);
  await page.getByRole("button", { name: "Não adicionar" }).click();
  await addFavorite(page, exclusiveA);
  await page.getByTestId("button-sair").click();
  await register(page, userB);
  await page.getByRole("button", { name: "Não adicionar" }).click();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("0");
  await openFavorites(page);
  await expect(page.getByTestId(`favorite-item-${local}`)).toHaveCount(0);
  await expect(page.getByTestId(`favorite-item-${exclusiveA}`)).toHaveCount(0);
});
