const { defineConfig, devices } = require('@playwright/test');

/**
 * Production smoke test configuration
 *
 * Runs against live production site: https://toysfortots.mcl1311.com
 *
 * Usage:
 *   npx playwright test --config=playwright.production.config.js
 *
 * These tests are READ-ONLY and safe to run against production.
 * They verify critical user paths work without creating test data.
 */
module.exports = defineConfig({
  testDir: './tests/production',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2,
  reporter: 'html',

  use: {
    baseURL: 'https://toysfortots.mcl1311.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No global setup/teardown - production tests are read-only
});
