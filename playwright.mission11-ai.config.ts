import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
 testDir:"./tests/e2e/ai",testMatch:"**/*.spec.ts",timeout:45000,
 expect:{timeout:10000},workers:1,retries:0,reporter:[["list"],["html",{outputFolder:"playwright-report/mission11-ai",open:"never"}]],
 outputDir:"test-results/mission11-ai",
 use:{baseURL:process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5000",screenshot:"only-on-failure",trace:"retain-on-failure"},
 projects:[{name:"chromium",use:{...devices["Desktop Chrome"]}}],
 webServer:process.env.PLAYWRIGHT_EXTERNAL_SERVER==="true"?undefined:{command:"npm run dev",url:"http://127.0.0.1:5000",reuseExistingServer:!process.env.CI,timeout:120000}
});
