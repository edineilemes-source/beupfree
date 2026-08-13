import { test, expect } from "./support/fixture";
import { clearBrowserState, persona, register } from "./support/actions";

test.beforeEach(async ({ monitoredPage }) => clearBrowserState(monitoredPage));

test("cadastro valida campos, fecha/reabre em login e autentica automaticamente", async ({ monitoredPage: page }) => {
  const user = persona("Cadastro");
  await page.getByTestId("item-entrar").click();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Informe seu nome.")).toBeVisible();
  await expect(page.getByText("Informe seu e-mail.")).toBeVisible();
  await page.getByLabel("E-mail").fill("email-invalido");
  await page.getByLabel("Senha", { exact: true }).fill("1234567");
  await page.getByLabel("Confirmar senha").fill("1234567");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
  await expect(page.getByText("A senha deve ter no mínimo 8 caracteres.")).toBeVisible();
  await page.getByLabel("Senha", { exact: true }).fill(user.password);
  await page.getByLabel("Confirmar senha").fill("senha456");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByText("As senhas devem ser iguais.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("auth-dialog")).toBeHidden();
  await page.getByTestId("item-entrar").click();
  await expect(page.getByRole("heading", { name: "Entrar no UpPulse" })).toBeVisible();
  await page.keyboard.press("Escape");
  await register(page, user);
  await expect(page.getByTestId("item-entrar")).toHaveCount(0);
});

test("login inválido usa mensagem genérica e login válido atualiza Header", async ({ monitoredPage: page }) => {
  const user = persona("Login");
  await register(page, user);
  await page.getByTestId("button-sair").click();
  await page.getByTestId("item-entrar").click();
  await page.getByLabel("E-mail").fill(`inexistente-${crypto.randomUUID()}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos.");
  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-incorreta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos.");
  await page.getByLabel("Senha", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByTestId("item-usuario")).toContainText(user.name);
});
