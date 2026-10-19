import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/game/browser',
  testMatch:'**/*.spec.ts',
  timeout:60000,
  workers:1,
  use:{baseURL:'http://127.0.0.1:4181',viewport:{width:960,height:640},trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'firefox',use:{...devices['Desktop Firefox']}},{name:'webkit',use:{...devices['Desktop Safari']}}],
  webServer:[
    {command:'node scripts/game-build-fixture.mjs && node scripts/game-test-server.mjs',url:'http://127.0.0.1:4181/fixture/',reuseExistingServer:!process.env.CI,timeout:60000},
    {command:'npm run dev:game -- --port 4182',url:'http://127.0.0.1:4182',reuseExistingServer:!process.env.CI,timeout:60000},
  ],
});
