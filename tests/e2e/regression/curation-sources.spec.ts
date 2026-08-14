import "dotenv/config";
import { expect, test } from "@playwright/test";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const runId = `regression-curation-${Date.now()}-${crypto.randomUUID()}`;
const marketplaceName = `Marketplace ${runId}`;
const sourceName = `Lista ${runId}`;
let marketplaceId: string | undefined;
let sourceId: string | undefined;

test.beforeAll(async () => {
  const marketplace = await pool.query<{ id: string }>(
    "INSERT INTO marketplaces(name, slug, base_url) VALUES($1, $2, $3) RETURNING id",
    [marketplaceName, runId, "https://example.test"],
  );
  marketplaceId = marketplace.rows[0].id;
});

test.afterAll(async () => {
  if (marketplaceId) await pool.query("DELETE FROM curation_sources WHERE marketplace_id=$1", [marketplaceId]);
  if (marketplaceId) await pool.query("DELETE FROM marketplaces WHERE id=$1", [marketplaceId]);
  await pool.end();
});

test("protege o cadastro, edição, desativação e filtro de listas de curadoria", async ({ page }) => {
  await page.goto("/admin/curadoria/listas");
  await expect(page.getByTestId("text-page-title")).toHaveText("Listas de Curadoria");

  await page.getByTestId("button-new-source").click();
  await page.getByLabel("Nome").fill(sourceName);
  await page.getByLabel("Marketplace", { exact: true }).click();
  await page.getByRole("option", { name: marketplaceName }).click();
  await page.getByLabel("URL").fill("https://example.test/campanha-regressao");
  await page.getByLabel("Prioridade").fill("88");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("cell", { name: sourceName, exact: true })).toBeVisible();

  sourceId = (await pool.query<{ id: string }>(
    "SELECT id FROM curation_sources WHERE name=$1 AND marketplace_id=$2",
    [sourceName, marketplaceId],
  )).rows[0]?.id;

  await page.getByRole("button", { name: `Editar ${sourceName}` }).click();
  await page.getByLabel("Nome").fill(`${sourceName} editada`);
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByRole("button", { name: `Desativar ${sourceName} editada` }).click();
  await page.getByTestId("filter-status-inactive").click();
  await expect(page.getByRole("cell", { name: `${sourceName} editada`, exact: true })).toBeVisible();
});
