import {defineConfig} from '@playwright/test';
process.env.PLAYWRIGHT_BROWSERS_PATH??='/tmp/uppulse-missao8-browsers';
export default defineConfig({testDir:'./tests/e2e/missao7',timeout:60000,expect:{timeout:15000},workers:1,retries:0,
 reporter:[['list'],['json',{outputFile:'../playwright-missao7.json'}]],outputDir:'../playwright-artifacts',
 use:{baseURL:'http://127.0.0.1:5019',browserName:'chromium',trace:'retain-on-failure',screenshot:'only-on-failure'},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]});
