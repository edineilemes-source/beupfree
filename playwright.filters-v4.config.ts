import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e/filters-v4',testMatch:'*.spec.ts',workers:1,timeout:30000,
 reporter:'list',outputDir:'/tmp/uppulse-filters-v4-playwright',
 use:{baseURL:'http://127.0.0.1:5178',trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 5']}}],
});
