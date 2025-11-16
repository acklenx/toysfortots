import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke test configuration - Fast, reliable tests for critical functionality
 * Run with: npx playwright test --config=playwright.smoke.config.js
 */
export default defineConfig({
  testDir: './tests/smoke', // Smoke tests in dedicated directory
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 1, // One retry for transient failures
  workers: 4, // Parallel workers for speed
  reporter: 'html',
  timeout: 5000, // 5 seconds per test - NEVER INCREASE THIS!
  globalSetup: './tests/global-setup.js',
  globalTeardown: './tests/global-teardown.js',

  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true // Full page screenshots for better debugging
    },
    actionTimeout: 3000,
    navigationTimeout: 3000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Only run smoke tests
  grep: /@smoke/,
});
