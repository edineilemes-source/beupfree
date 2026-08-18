import { expect, test } from "@playwright/test";

test("jornada pública demonstrativa e bloqueios", async ({ page, request }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("home-title")).toContainText("Encontre melhores oportunidades");
  await expect(page.getByTestId("hero-institutional-id")).toHaveText(/UPPULSE.*BY BEUPFREE/);

  const heroCards = page.getByTestId("hero-paths").locator("article");
  await expect(heroCards).toHaveCount(3);
  await expect(heroCards).toHaveText([
    /EXPLORE PREÇOS E OPORTUNIDADES.*Explorar produtos/,
    /CONHEÇA O UPPULSE.*Conhecer o UpPulse/,
    /DA DESCOBERTA À DECISÃO.*Como funciona/,
  ]);

  const cardBoxes = await heroCards.evaluateAll((cards) =>
    cards.map((card) => {
      const { x, y, width, height } = card.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
  expect(cardBoxes.every(({ width, height }) => width > 0 && height > 0)).toBeTruthy();
  if (testInfo.project.name === "desktop") {
    expect(Math.max(...cardBoxes.map(({ y }) => y)) - Math.min(...cardBoxes.map(({ y }) => y))).toBeLessThanOrEqual(1);
    expect(Math.max(...cardBoxes.map(({ height }) => height)) - Math.min(...cardBoxes.map(({ height }) => height))).toBeLessThanOrEqual(1);
  } else {
    expect(cardBoxes[0].y).toBeLessThan(cardBoxes[1].y);
    expect(cardBoxes[1].y).toBeLessThan(cardBoxes[2].y);
  }

  await expect(page.getByTestId("button-explore-products")).toHaveAttribute("href", "/catalogo");
  await expect(page.getByTestId("button-know-uppulse")).toHaveAttribute("href", "/sobre");
  await expect(page.getByTestId("button-how-it-works")).toHaveAttribute("href", "/como-funciona");
  await expect(page.getByRole("heading", { level: 2, name: "Conheça o UpPulse", exact: true })).toBeVisible();
  await expect(page.getByTestId("link-curadoria")).toHaveCount(0);

  await page.getByTestId("button-explore-products").click();
  await expect(page).toHaveURL(/\/catalogo$/);
  await expect(page.getByTestId("demo-price-notice")).toBeVisible();

  const card = page.locator('[data-testid^="card-product-"]').first();
  await expect(card).toBeVisible();
  await expect(card.locator('[data-testid^="badge-demo-"]')).toHaveText("Produto demonstrativo");
  const discount = card.locator('[data-testid^="text-discount-"]');
  if (await discount.count()) {
    for (const value of ["-1%", "-10%", "-100%"]) {
      await discount.evaluate((element, text) => { element.textContent = text; }, value);
      const discountBox = await discount.boundingBox();
      const labelBox = await card.locator('[data-testid^="demo-label-area-"]').boundingBox();
      expect(discountBox && labelBox && discountBox.y + discountBox.height <= labelBox.y, value).toBeTruthy();
    }
  }
  await expect(card).toContainText("Loja demonstrativa");
  await expect(page.getByText(/Mercado Livre/i)).toHaveCount(0);
  await expect(page.locator('a[href*="mercadolivre" i]')).toHaveCount(0);

  await card.getByRole("button", { name: "Adicionar aos Favoritos" }).click();
  await expect(page.getByTestId("text-favorites-count")).toHaveText("1");
  await card.getByRole("button", { name: "Ver referência" }).click();
  await expect(page.getByTestId("demo-product-dialog")).toBeVisible();
  await expect(page.getByTestId("demo-product-dialog").getByRole("link", { name: "Visitar loja" })).toHaveCount(0);
  await page.getByTestId("demo-product-dialog").getByRole("button", { name: "Entendi" }).click();

  for (const [path, heading] of [
    ["/sobre", "Sobre o BeUpFree e o UpPulse"],
    ["/como-funciona", "Como funciona"],
    ["/politica-de-privacidade", "Política de Privacidade"],
    ["/termos-de-uso", "Termos de Uso"],
    ["/contato", "Contato"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }

  await page.goto("/admin/triagem");
  await expect(page.getByText("Página não encontrada")).toBeVisible();
  await expect(page.getByTestId("link-curadoria")).toHaveCount(0);

  for (const path of ["/api/admin/triage", "/api/admin/reset-catalog", "/api/ml/scrape-ofertas", "/api/init", "/api/click/example"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});

test("links institucionais do Footer iniciam a nova rota no topo", async ({ page }) => {
  const navigateFromFooter = async (from: string, testId: string, expectedPath: RegExp) => {
    await page.goto(from);
    await page.getByTestId("footer").scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.getByTestId(testId).click();
    await expect(page).toHaveURL(expectedPath);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
  };

  await navigateFromFooter("/politica-de-privacidade", "footer-link-sobre", /\/sobre$/);
  await navigateFromFooter("/sobre", "footer-link-como-funciona", /\/como-funciona$/);
  await navigateFromFooter("/como-funciona", "footer-link-termos-de-uso", /\/termos-de-uso$/);
});

test("página Sobre apresenta a narrativa institucional de forma responsiva", async ({ page }) => {
  await page.goto("/como-funciona");
  await page.getByTestId("footer").scrollIntoViewIfNeeded();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByTestId("footer-link-sobre").click();

  await expect(page).toHaveURL(/\/sobre$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("heading", { level: 1, name: "Sobre o BeUpFree e o UpPulse" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Uma nova forma de encontrar boas oportunidades" })).toBeVisible();
  await expect(page.getByText("Nossa visão", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "O BeUpFree parte de uma ideia simples:" })).toBeVisible();
  await expect(page.getByText("Primeiro vem a necessidade do usuário; depois, as lojas e oportunidades capazes de atendê-la.")).toBeVisible();
  await expect(page.getByTestId("about-filter-example")).toBeVisible();
  await expect(page.getByTestId("about-journey").locator("li")).toHaveCount(6);
  await expect(page.getByRole("link", { name: /Entenda a jornada/ })).toHaveAttribute("href", "/como-funciona");
  await expect(page.getByRole("link", { name: "Explorar produtos" })).toHaveAttribute("href", "/catalogo");
  await expect(page.getByTestId("link-logo")).toBeVisible();
  await expect(page.getByTestId("footer")).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
});
