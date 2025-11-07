import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke test configuration - Fast, reliable tests for critical functionality
 * Run with: npx playwright test --config=playwright.smoke.config.js
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run sequentially to avoid emulator contention
  forbidOnly: !!process.env.CI,
  retries: 1, // One retry for transient failures
  workers: 1, // Single worker for stability
  reporter: 'html',
  timeout: 15000, // 15 seconds per test

  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
