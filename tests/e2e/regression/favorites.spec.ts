import { test, expect } from "./support/fixture";
import { addFavorite, catalogProductIds, clearBrowserState, login, openFavorites, persona, register } from "./support/actions";

test.beforeEach(async ({ monitoredPage }) => clearBrowserState(monitoredPage));

test("anônimo favorita, persiste, abre drawer, remove e vê estado vazio", async ({ monitoredPage: page }) => {
  const [productId] = await catalogProductIds(page, 1);
  await addFavorite(page, productId);
  await expect(page.getByTestId("text-favorites-count")).toHaveText("1");
  await openFavorites(page);
  await expect(page.getByTestId(`favorite-item-${productId}`)).toBeVisible();
  await expect(page.getByTestId("favorites-storage-message")).toContainText("Salvos neste dispositivo");
  await expect(page.getByRole("button", { name: "Criar conta" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("1");
  await openFavorites(page);
  await page.getByTestId(`button-remove-favorite-${productId}`).click();
  await expect(page.getByText("Você ainda não salvou nenhum produto.")).toBeVisible();
});

test("favoritos autenticados persistem e a remoção persiste", async ({ monitoredPage: page }) => {
  const user = persona("Favoritos");
  await register(page, user);
  const [productId] = await catalogProductIds(page, 1);
  await addFavorite(page, productId);
  await page.reload();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("1");
  await openFavorites(page);
  await expect(page.getByTestId("favorites-storage-message")).toContainText("Favoritos salvos na sua conta");
  await page.getByTestId(`button-remove-favorite-${productId}`).click();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("0");
});

test("importação SIM faz merge, sobrevive a reload e novo dispositivo", async ({ monitoredPage: page, browser }) => {
  const user = persona("Importar Sim");
  const [a, b] = await catalogProductIds(page, 2);
  await addFavorite(page, a); await addFavorite(page, b);
  await register(page, user);
  await expect(page.getByTestId("favorites-import-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar à minha conta" }).click();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("2");
  await page.reload();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("2");

  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto("/"); await login(other, user); await openFavorites(other);
  await expect(other.getByTestId(`favorite-item-${a}`)).toBeVisible();
  await expect(other.getByTestId(`favorite-item-${b}`)).toBeVisible();
  await context.close();
});

test("importação NÃO mantém somente a conta e devolve anônimos no logout", async ({ monitoredPage: page }) => {
  const user = persona("Importar Não");
  await register(page, user);
  const [official, localA, localB] = await catalogProductIds(page, 3);
  await addFavorite(page, official);
  await page.getByTestId("button-sair").click();
  await addFavorite(page, localA); await addFavorite(page, localB);
  await login(page, user);
  await expect(page.getByTestId("favorites-import-dialog")).toBeVisible();
  await page.getByRole("button", { name: "Não adicionar" }).click();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("1");
  await openFavorites(page);
  await expect(page.getByTestId(`favorite-item-${official}`)).toBeVisible();
  await expect(page.getByTestId(`favorite-item-${localA}`)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByTestId("button-sair").click();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("2");
});
