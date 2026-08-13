import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/regression",
  testMatch: "**/*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report/regression", open: "never" }]],
  globalSetup: "./tests/e2e/regression/global-setup.ts",
  globalTeardown: "./tests/e2e/regression/global-teardown.ts",
  outputDir: "test-results/regression",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev:e2e",
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
