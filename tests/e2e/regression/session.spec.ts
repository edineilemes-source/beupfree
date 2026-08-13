import { test, expect } from "./support/fixture";
import { clearBrowserState, persona, register } from "./support/actions";

test.beforeEach(async ({ monitoredPage }) => clearBrowserState(monitoredPage));

test("sessão persiste, /api/auth/me responde e logout sobrevive ao reload", async ({ monitoredPage: page }) => {
  const user = persona("Sessão");
  await register(page, user);
  const me = await page.request.get("/api/auth/me");
  expect(me.ok()).toBeTruthy();
  expect((await me.json()).user.email).toBe(user.email);
  await page.reload();
  await expect(page.getByTestId("item-usuario")).toContainText(user.name);
  await page.getByTestId("button-sair").click();
  await expect(page.getByTestId("item-entrar")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("item-entrar")).toBeVisible();
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
});
