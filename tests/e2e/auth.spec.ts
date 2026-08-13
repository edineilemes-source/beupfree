import "dotenv/config";
import { expect, test } from "@playwright/test";
import pg from "pg";

const runId = `${Date.now()}-${crypto.randomUUID()}`;
const emailPrefix = `e2e-auth-${runId}`;
const email = `${emailPrefix}@example.test`;
const password = "senha123";
const name = "Pessoa E2E";
const databaseUrl = process.env.DATABASE_URL;

test.afterAll(async () => {
  if (!databaseUrl) return;
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query<{ id: string }>(
      "SELECT id FROM users WHERE email LIKE $1",
      [`${emailPrefix}%`],
    );
    const userIds = result.rows.map(({ id }) => id);
    if (userIds.length > 0) {
      await pool.query("DELETE FROM session WHERE sess->>'userId' = ANY($1::text[])", [userIds]);
      await pool.query("DELETE FROM users WHERE id = ANY($1::varchar[])", [userIds]);
    }
  } finally {
    await pool.end();
  }
});

test("cadastro, sessão persistente, logout e novo login", async ({ page }) => {
  await page.goto("/");

  const enterAction = page.getByTestId("item-entrar");
  await expect(enterAction).toBeVisible();
  await expect(enterAction).toContainText("Entrar");
  await enterAction.click();

  await expect(page.getByRole("heading", { name: "Entrar no UpPulse" })).toBeVisible();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByRole("heading", { name: "Criar conta" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("auth-dialog")).toBeHidden();
  await enterAction.click();
  await expect(page.getByRole("heading", { name: "Entrar no UpPulse" })).toBeVisible();
  await page.getByRole("button", { name: "Criar conta" }).click();

  await page.getByLabel("Nome").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("1234567");
  await page.getByLabel("Confirmar senha").fill("1234567");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("A senha deve ter no mínimo 8 caracteres.")).toBeVisible();

  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByLabel("Confirmar senha").fill("senha-diferente-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("As senhas devem ser iguais.")).toBeVisible();

  await page.getByLabel("Confirmar senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();

  const userAction = page.getByTestId("item-usuario");
  await expect(page.getByTestId("auth-dialog")).toBeHidden();
  await expect(userAction).toContainText(`Olá, ${name}`);

  await page.reload();
  await expect(userAction).toContainText(`Olá, ${name}`);
  await expect(page.getByTestId("item-entrar")).toHaveCount(0);

  await page.getByTestId("button-sair").click();
  await expect(page.getByTestId("item-entrar")).toBeVisible();

  await page.getByTestId("item-entrar").click();
  await expect(page.getByRole("heading", { name: "Entrar no UpPulse" })).toBeVisible();
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("credencial-invalida");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos.");
  await expect(page.getByRole("heading", { name: "Entrar no UpPulse" })).toBeVisible();

  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(userAction).toContainText(`Olá, ${name}`);
});
