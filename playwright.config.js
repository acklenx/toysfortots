import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Tests within describe blocks run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 4, // Run tests with 4 parallel workers

  // Reorder tests to reduce contention (login/home first, then spread heavy tests)
  testMatch: [
    '**/login.spec.js',
    '**/home.spec.js',
    '**/box-and-status.spec.js',
    '**/setup.spec.js',
    '**/dashboard.spec.js'
  ],
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['./flakiness-reporter.js']
  ],

  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000, // 10 seconds for actions (increased for parallel execution)
    navigationTimeout: 10000, // 10 seconds for page navigations (increased for parallel execution)
  },

  // Global timeout for each test
  timeout: 30 * 1000, // 30 seconds total per test (increased for parallel execution)

  // Timeout for assertions (expect calls)
  expect: {
    timeout: 10000, // 10 seconds for assertions (increased for parallel execution)
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
