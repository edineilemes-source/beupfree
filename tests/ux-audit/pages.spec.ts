import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const pages = [
  { name: "inicio", route: "/" },
  { name: "catalogo", route: "/catalogo" },
  { name: "catalogo-v2", route: "/catalogo-v2" },
];

for (const target of pages) {
  test(`auditoria visual: ${target.name}`, async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    page.on("pageerror", error => pageErrors.push(error.message));

    const response = await page.goto(target.route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const screenshot = await page.screenshot({ fullPage: true, animations: "disabled" });
    await testInfo.attach(`${target.name}-screenshot`, { body: screenshot, contentType: "image/png" });

    const diagnostics = await page.evaluate(() => {
      const body = document.body;
      const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
      const overflow = all.filter(el => el.getBoundingClientRect().right > window.innerWidth + 3 && getComputedStyle(el).position !== "fixed")
        .slice(0, 20).map(el => ({ tag: el.tagName, className: String(el.className).slice(0, 120) }));
      const images = Array.from(document.images).map(img => ({ src: img.currentSrc, alt: img.alt, loaded: img.complete && img.naturalWidth > 0 }));
      return {
        title: document.title,
        width: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyTextLength: body?.innerText.length ?? 0,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 3,
        overflowingElements: overflow,
        imageCount: images.length,
        brokenImages: images.filter(img => !img.loaded).slice(0, 30),
        headingCount: document.querySelectorAll("h1").length,
        unlabeledButtons: Array.from(document.querySelectorAll("button")).filter(b => !((b.innerText || b.getAttribute("aria-label") || b.getAttribute("title") || "").trim())).length,
      };
    });

    const report = {
      route: target.route,
      project: testInfo.project.name,
      status: response?.status() ?? null,
      url: page.url(),
      ...diagnostics,
      consoleErrors,
      pageErrors,
    };
    const output = path.join("test-results", "ux-audit", "diagnostics", testInfo.project.name);
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, `${target.name}.json`), JSON.stringify(report, null, 2));
    await testInfo.attach(`${target.name}-diagnostics`, { body: JSON.stringify(report, null, 2), contentType: "application/json" });

    expect(response, "A rota deve responder").not.toBeNull();
    expect(response!.status(), "A rota não deve retornar erro HTTP").toBeLessThan(400);
    expect(diagnostics.bodyTextLength, "A página deve apresentar conteúdo").toBeGreaterThan(0);
  });
}
