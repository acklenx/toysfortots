import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Tests within describe blocks run sequentially
  forbidOnly: !!process.env.CI,
  retries: 1, // Retry once with 4 workers before custom sequential retry
  workers: 4, // Run tests with 4 parallel workers

  // Global setup/teardown for one-time data clearing
  globalSetup: './tests/global-setup.js',
  globalTeardown: './tests/global-teardown.js',

  // Run all e2e tests
  testMatch: [
    '**/e2e-full-journey.spec.js', // Comprehensive E2E journey tests (14 tests)
    '**/admin.spec.js',            // Admin panel tests (2 tests)
    '**/xss-security.spec.js'      // XSS security tests (4 tests)
  ],
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['./flakiness-reporter.js']
  ],

  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true // Full page screenshots for better debugging
    },
    video: 'retain-on-failure',
    actionTimeout: 3000, // 3 seconds for actions
    navigationTimeout: 3000, // 3 seconds for page navigations
  },

  // Global timeout for each test
  timeout: 15 * 1000, // 15 seconds total per test

  // Timeout for assertions (expect calls)
  expect: {
    timeout: 3000, // 3 seconds for assertions
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // webServer commented out - start Firebase emulators manually before running tests
  // Run: npx firebase emulators:start --only hosting,auth,firestore,functions
  webServer: process.env.CI ? {
    command: 'npx firebase emulators:start --only hosting,auth,firestore,functions',
    url: 'http://localhost:5000',
    timeout: 120 * 1000,
  } : undefined,
});
