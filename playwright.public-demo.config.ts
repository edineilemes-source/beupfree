import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e/public-demo",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5000",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "tablet", use: { ...devices["iPad (gen 7)"], browserName: "chromium" } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: "PUBLIC_DEMO_MODE=true npm run dev:e2e",
    url: "http://127.0.0.1:5000/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
