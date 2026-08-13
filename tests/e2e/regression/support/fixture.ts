import { expect, test as base, type Page, type TestInfo } from "@playwright/test";

const knownConsoleErrors = [
  /favicon\.ico.*404/i,
  /^Failed to load resource: the server responded with a status of 401 \(Unauthorized\)$/,
];

function isCriticalConsole(text: string) {
  return !knownConsoleErrors.some((pattern) => pattern.test(text));
}

export const test = base.extend<{ monitoredPage: Page }>({
  monitoredPage: async ({ page }, use, testInfo) => {
    const failures: string[] = [];
    page.on("pageerror", (error) => failures.push(`pageerror: ${error.stack ?? error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error" && isCriticalConsole(message.text())) failures.push(`console.error: ${message.text()}`);
    });
    page.on("response", (response) => {
      if ([500, 502, 503, 504].includes(response.status())) failures.push(`HTTP ${response.status()}: ${response.request().method()} ${response.url()}`);
    });
    await use(page);
    if (failures.length) {
      await testInfo.attach("critical-errors.txt", { body: failures.join("\n"), contentType: "text/plain" });
      expect(failures, `Erros críticos observados:\n${failures.join("\n")}`).toEqual([]);
    }
  },
});

export { expect } from "@playwright/test";
