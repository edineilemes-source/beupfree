import { expect, test } from "@playwright/test";

test("filtra o catálogo por uma cor disponível e remove o filtro", async ({
  page,
}) => {
  await page.goto("/catalogo");

  await expect(
    page.getByRole("heading", { name: "Produtos com desconto" }),
  ).toBeVisible();

  const productGrid = page.getByTestId("grid-catalog-products");
  await expect(productGrid).toBeVisible();

  const productCards = productGrid.locator('[data-testid^="card-product-"]');
  await expect(productCards.first()).toBeVisible();
  expect(await productCards.count()).toBeGreaterThan(0);

  const firstCard = productCards.first();
  await expect(
    firstCard.locator('[data-testid^="text-product-name-"]'),
  ).toBeVisible();
  await expect(
    firstCard.locator('[data-testid^="text-price-"]'),
  ).toBeVisible();
  await expect(
    firstCard.getByRole("button", { name: "Adicionar aos Favoritos" }),
  ).toBeVisible();
  await expect(
    firstCard.getByRole("button", { name: "Ver oferta" }),
  ).toBeVisible();

  await expect(page.getByText("Filtros", { exact: true })).toBeVisible();
  await expect(page.getByTestId("button-limpar-todos")).toBeVisible();

  const colorSection = page.getByTestId("section-cor");
  expect(
    await colorSection.count(),
    "A seção Cor não foi exibida porque os produtos retornados pela API não possuem opções de cor.",
  ).toBeGreaterThan(0);
  await expect(colorSection).toBeVisible();

  const colorOptions = page.locator('[data-testid^="filter-cor-"]');
  expect(
    await colorOptions.count(),
    "A seção Cor está visível, mas a API não retornou nenhuma opção de cor.",
  ).toBeGreaterThan(0);

  const firstColorOption = colorOptions.first();
  const colorTestId = await firstColorOption.getAttribute("data-testid");
  const colorValue = colorTestId?.replace("filter-cor-", "");
  expect(colorValue, "Não foi possível identificar a cor disponível.").toBeTruthy();

  await firstColorOption.click();

  await expect
    .poll(() => new URL(page.url()).searchParams.get("cor"))
    .toBe(colorValue);
  await expect(productGrid).toBeVisible();
  await expect(productCards.first()).toBeVisible();
  expect(await productCards.count()).toBeGreaterThan(0);

  await page.getByTestId(`chip-cor-${colorValue}`).click();

  await expect
    .poll(() => new URL(page.url()).searchParams.has("cor"))
    .toBe(false);
  await expect(productCards.first()).toBeVisible();
});
