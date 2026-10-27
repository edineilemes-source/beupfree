import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.UPPULSE_UX_BASE_URL ?? "http://127.0.0.1:5001";

export default defineConfig({
  testDir: "./tests/ux-audit",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/ux-audit", open: "never" }]],
  outputDir: "test-results/ux-audit",
  use: {
    baseURL,
    screenshot: "on",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-1920", use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "notebook-1366", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
