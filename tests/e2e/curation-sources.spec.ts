import "dotenv/config";
import { expect, test } from "@playwright/test";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const runId = `e2e-curation-${Date.now()}-${crypto.randomUUID()}`;
const sourceName = `E2E Curadoria ${runId}`;
let sourceId: string | undefined;
let marketplaceId: string | undefined;

test.beforeAll(async () => {
  const marketplace = await pool.query<{ id: string }>(
    "INSERT INTO marketplaces(name, slug, base_url) VALUES($1, $2, $3) RETURNING id",
    [`Marketplace ${runId}`, runId, "https://example.test"],
  );
  marketplaceId = marketplace.rows[0].id;
});

test.afterAll(async () => {
  if (sourceId) await pool.query("DELETE FROM curation_sources WHERE id=$1", [sourceId]);
  if (marketplaceId) await pool.query("DELETE FROM curation_sources WHERE marketplace_id=$1", [marketplaceId]);
  if (marketplaceId) await pool.query("DELETE FROM marketplaces WHERE id=$1", [marketplaceId]);
  await pool.end();
});

test("administra uma lista manual e filtra seu status", async ({ page }) => {
  await page.goto("/admin/curadoria/listas");
  await expect(page.getByTestId("text-page-title")).toHaveText("Fontes de Curadoria");
  await page.getByTestId("button-new-source").click();
  await page.getByLabel("Nome").fill(sourceName);
  await page.getByLabel("Marketplace", { exact: true }).click();
  await page.getByRole("option", { name: `Marketplace ${runId}` }).click();
  await page.getByLabel("URL").fill("https://example.test/campanha-e2e");
  await page.getByLabel("Prioridade").fill("77");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("cell", { name: sourceName, exact: true })).toBeVisible();
  sourceId = (await pool.query<{ id: string }>("SELECT id FROM curation_sources WHERE name=$1", [sourceName])).rows[0]?.id;
  await page.getByRole("button", { name: `Editar ${sourceName}` }).click();
  await page.getByLabel("Nome").fill(`${sourceName} editada`);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("cell", { name: `${sourceName} editada`, exact: true })).toBeVisible();
  const unsupported = page.getByRole("button", { name: `Coletar agora ${sourceName} editada` });
  await expect(unsupported).toBeDisabled();
  await expect(unsupported).toHaveAttribute("title", "Coleta ainda não disponível para este provedor");
  await page.getByRole("button", { name: `Desativar ${sourceName} editada` }).click();
  await page.getByTestId("filter-status-inactive").click();
  await expect(page.getByRole("cell", { name: `${sourceName} editada`, exact: true })).toBeVisible();
});

test("executa Coletar agora com estado e resultado determinísticos", async ({ page }) => {
  const ml = await pool.query<{ id: string }>("SELECT id FROM marketplaces WHERE slug='mercadolivre' LIMIT 1");
  test.skip(!ml.rows[0], "Marketplace Mercado Livre não provisionado");
  const inserted = await pool.query<{ id: string }>("INSERT INTO curation_sources(name,marketplace_id,url,source_type,status) VALUES($1,$2,$3,'other','active') RETURNING id", [`${sourceName} coleta`, ml.rows[0].id, "https://example.test/deterministic"]);
  sourceId = inserted.rows[0].id;
  await page.route("**/api/admin/curation-sources", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch(); const body = await response.json();
    body.sources = body.sources.map((source: any) => source.id === sourceId ? { ...source, collectorSupported: true } : source);
    await route.fulfill({ response, json: body });
  });
  await page.route(`**/api/admin/curation-sources/${sourceId}/collect`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "completed", itemsFound: 7, itemsCreated: 2, itemsUpdated: null, itemsIgnored: 5, errors: 0 }) });
  });
  await page.goto("/admin/curadoria/listas");
  const button = page.getByRole("button", { name: `Coletar agora ${sourceName} coleta` });
  await button.click(); await expect(button).toContainText("Coletando...");
  await expect(page.getByText("Coleta concluída")).toBeVisible();
  await expect(page.getByText("Encontrados: 7 · Criados: 2 · Ignorados: 5", { exact: true })).toBeVisible();
});
