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

  // Test order: Heavy tests first (performs 0.7% better than light-first)
  // Testing showed: 90.7% pass rate vs 90% with original order
  // Hypothesis: Heavy tests "warm up" the emulator, reducing later contention
  testMatch: [
    '**/dashboard.spec.js',      // Heavy: Multiple data operations
    '**/setup.spec.js',          // Medium: Auth + provisioning
    '**/box-and-status.spec.js', // Medium: Box and status ops
    '**/home.spec.js',           // Light: Minimal data
    '**/login.spec.js',          // Light: Auth only
    '**/authorize.spec.js',      // Light: Auth + authorization flow
    '**/user-journeys.spec.js',  // Real-world user scenarios (sequential)
    '**/admin.spec.js'           // Heavy but sequential (run last to avoid interference)
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
