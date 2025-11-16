const { defineConfig, devices } = require('@playwright/test');

/**
 * Production End-to-End test configuration
 *
 * Runs comprehensive E2E tests against live production site: https://toysfortots.mcl1311.com
 *
 * IMPORTANT: These tests CREATE TEST DATA in production!
 * - Uses festive North Pole themed test data for clear identification
 * - Single worker for sequential execution and realistic timing
 * - Longer timeouts to account for production latencies
 *
 * Usage:
 *   npm run test:production-e2e
 *   npx playwright test --config=playwright.production-e2e.config.cjs
 */
module.exports = defineConfig({
  testDir: './tests/production',
  testMatch: '**/production-e2e.spec.js', // Only run the E2E test file
  fullyParallel: false, // Force sequential execution
  forbidOnly: true, // No .only in production tests
  retries: 0, // No retries - we don't want duplicate test data
  workers: 1, // Single worker for sequential execution
  reporter: [
    ['html', { outputFolder: 'playwright-report-production-e2e', open: 'on-failure' }],
    ['list'] // Console output
  ],

  use: {
    baseURL: 'https://toysfortots.mcl1311.com',

    // Capture evidence
    trace: 'on', // Always capture trace for production tests
    screenshot: 'on', // Take screenshots for all tests
    video: 'on', // Record video for all tests

    // Longer timeouts for production
    actionTimeout: 15000, // 15 seconds for actions
    navigationTimeout: 30000, // 30 seconds for navigation

    // Realistic browser settings
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: false, // Enforce HTTPS in production

    // User agent to identify test traffic
    userAgent: 'Playwright/ProductionE2ETest ToysForTots/TestSuite',
  },

  // Global timeout for each test
  timeout: 90 * 1000, // 90 seconds per test (production is slower)

  // Timeout for assertions
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },

  projects: [
    {
      name: 'production-e2e',
      use: {
        ...devices['Desktop Chrome'],
        // Add any production-specific browser settings
        launchOptions: {
          slowMo: 100, // Slow down by 100ms to be more realistic
        }
      },
    },
  ],

  // Output folder for test results
  outputDir: './test-results-production-e2e',
});