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
  if (marketplaceId) await pool.query("DELETE FROM curation_sources WHERE marketplace_id=$1", [marketplaceId]);
  if (marketplaceId) await pool.query("DELETE FROM marketplaces WHERE id=$1", [marketplaceId]);
  await pool.end();
});

test("administra uma lista manual e filtra seu status", async ({ page }) => {
  await page.goto("/admin/curadoria/listas");
  await expect(page.getByTestId("text-page-title")).toHaveText("Listas de Curadoria");
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
  await page.getByRole("button", { name: `Desativar ${sourceName} editada` }).click();
  await page.getByTestId("filter-status-inactive").click();
  await expect(page.getByRole("cell", { name: `${sourceName} editada`, exact: true })).toBeVisible();
});
