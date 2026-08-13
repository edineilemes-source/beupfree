import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

const runId = `${Date.now()}-${crypto.randomUUID()}`;
const prefix = `e2e-favorites-${runId}`;
const password = "senha123";
const databaseUrl = process.env.DATABASE_URL;
let emailCounter = 0;
const email = () => `${prefix}-${emailCounter++}@example.test`;

async function products(page: Page, count = 3) {
  await page.goto("/catalogo");
  const cards = page.locator('[data-testid^="card-product-"]');
  await expect(cards.first()).toBeVisible();
  test.skip(await cards.count() < count, `Catálogo precisa ter ${count} produtos`);
  return Promise.all(Array.from({ length: count }, async (_, index) =>
    (await cards.nth(index).getAttribute("data-testid"))!.replace("card-product-", "")));
}
async function favorite(page: Page, id: string) {
  const button = page.getByTestId(`button-favorite-${id}`);
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}
async function register(page: Page, address: string, name: string) {
  await page.getByTestId("item-entrar").click();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByLabel("Nome").fill(name); await page.getByLabel("E-mail").fill(address);
  await page.getByLabel("Senha", { exact: true }).fill(password); await page.getByLabel("Confirmar senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByTestId("item-usuario")).toContainText(name);
}
async function login(page: Page, address: string, name: string) {
  await page.getByTestId("item-entrar").click(); await page.getByLabel("E-mail").fill(address);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByTestId("item-usuario")).toContainText(name);
}
const importDialog = (page: Page) => page.getByTestId("favorites-import-dialog");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test.afterAll(async () => {
  if (!databaseUrl) return;
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query<{ id: string }>("SELECT id FROM users WHERE email LIKE $1", [`${prefix}-%`]);
    const ids = result.rows.map(({ id }) => id);
    if (ids.length) {
      await pool.query("DELETE FROM session WHERE sess->>'userId' = ANY($1::text[])", [ids]);
      await pool.query("DELETE FROM users WHERE id = ANY($1::varchar[])", [ids]);
    }
  } finally { await pool.end(); }
});

test("cenário A: não importa e logout restaura os anônimos", async ({ page }) => {
  const [a, b] = await products(page, 2); await favorite(page, a); await favorite(page, b);
  await register(page, email(), "Não Importar");
  await expect(importDialog(page)).toContainText("Encontramos 2 produtos salvos neste dispositivo");
  await page.getByRole("button", { name: "Não adicionar" }).click();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("0");
  await page.getByTestId("button-sair").click();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("2");
  await page.getByTestId("item-favoritos").click();
  await expect(page.getByTestId(`favorite-item-${a}`)).toBeVisible();
  await expect(page.getByTestId(`favorite-item-${b}`)).toBeVisible();
});

test("cenário B: importa, persiste no reload e aparece em outro dispositivo", async ({ page, browser }) => {
  const address = email(); const [a, b] = await products(page, 2); await favorite(page, a); await favorite(page, b);
  await register(page, address, "Importar"); await expect(importDialog(page)).toBeVisible();
  await page.getByRole("button", { name: "Adicionar à minha conta" }).click();
  await expect(importDialog(page)).toBeHidden(); await expect(page.getByTestId("text-favorites-count")).toHaveText("2");
  await page.reload(); await expect(page.getByTestId("text-favorites-count")).toHaveText("2"); await expect(importDialog(page)).toHaveCount(0);

  const context = await browser.newContext(); const other = await context.newPage();
  await other.goto("/"); await login(other, address, "Importar");
  await expect(importDialog(other)).toHaveCount(0); await expect(other.getByTestId("text-favorites-count")).toHaveText("2");
  await context.close();
});

test("cenário C: conta B recusa locais e nunca vê favorito exclusivo da conta A", async ({ page }) => {
  const addressA = email(), addressB = email(); const [local, exclusive] = await products(page, 2);
  await favorite(page, local); await register(page, addressA, "Conta A");
  await page.getByRole("button", { name: "Adicionar à minha conta" }).click();
  await favorite(page, exclusive); await expect(page.getByTestId("text-favorites-count")).toHaveText("2");
  await page.getByTestId("button-sair").click(); await expect(page.getByTestId("text-favorites-count")).toHaveText("1");
  await register(page, addressB, "Conta B"); await page.getByRole("button", { name: "Não adicionar" }).click();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("0");
  await page.getByTestId("item-favoritos").click();
  await expect(page.getByTestId(`favorite-item-${exclusive}`)).toHaveCount(0);
});

test("cenário D SIM: cadastro pergunta e importa", async ({ page }) => {
  const [a] = await products(page, 1); await favorite(page, a); await register(page, email(), "Cadastro Sim");
  await expect(importDialog(page)).toBeVisible(); await page.getByRole("button", { name: "Adicionar à minha conta" }).click();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("1");
});

test("cenário D NÃO: cadastro pergunta, não importa e preserva local", async ({ page }) => {
  const [a] = await products(page, 1); await favorite(page, a); await register(page, email(), "Cadastro Não");
  await expect(importDialog(page)).toBeVisible(); await page.getByRole("button", { name: "Não adicionar" }).click();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("0");
  await page.getByTestId("button-sair").click(); await expect(page.getByTestId("text-favorites-count")).toHaveText("1");
});
