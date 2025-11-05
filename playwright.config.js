const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run tests sequentially to avoid Firebase conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker to avoid Firebase emulator conflicts
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list']
  ],

  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 3000, // 3 seconds for actions like click, fill, etc.
    navigationTimeout: 3000, // 3 seconds for page navigations
  },

  // Global timeout for each test
  timeout: 30 * 1000, // 30 seconds total per test (reasonable for sequential tests with multiple actions)

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
