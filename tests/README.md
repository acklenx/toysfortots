# Toys for Tots - E2E Test Suite

Comprehensive end-to-end tests for the Toys for Tots web application using Playwright and Firebase Emulators.

## Overview

This test suite provides full coverage of the application's functionality:

- **Login Page**: Authentication, sign-up/sign-in flows, validation
- **Dashboard**: Volunteer dashboard, box status display, filtering
- **Setup Page**: New location provisioning, form validation
- **Box Action Center**: Public reporting interface
- **Status/History Page**: Report history and status display
- **Home Page**: Location map and anonymous access

## Prerequisites

### System Dependencies (WSL/Linux)

Install Playwright browser dependencies:

```bash
sudo npx playwright install-deps
```

Or install specific libraries:

```bash
sudo apt-get install libnspr4 libnss3 libasound2t64
```

### Firebase CLI

Install Firebase tools globally (if not already installed):

```bash
npm install -g firebase-tools
```

## Installation

Dependencies are already installed, but if needed:

```bash
npm install
```

## Running Tests

### All Tests (Headless)

```bash
npm test
```

### With Browser UI (Headed Mode)

```bash
npm run test:headed
```

### Interactive UI Mode

```bash
npm run test:ui
```

### Debug Mode (Step Through Tests)

```bash
npm run test:debug
```

### View Test Report

After running tests, view the HTML report:

```bash
npm run test:report
```

### Run Specific Test File

```bash
npx playwright test tests/e2e/login.spec.js
```

### Run Tests by Name Pattern

```bash
npx playwright test -g "should display login form"
```

## Test Architecture

### Configuration

- **playwright.config.js**: Main Playwright configuration
- **firebase.json**: Emulator ports and settings
- Uses Firebase emulators automatically (no production data affected)

### Fixtures and Helpers

Located in `tests/fixtures/`:

- **auth.js**: Authentication fixtures for creating test users
- **firebase-helpers.js**: Database seeding, test data creation, cleanup

### Test Files

Located in `tests/e2e/`:

- **login.spec.js** (13 tests): Login page functionality
- **dashboard.spec.js** (12 tests): Volunteer dashboard
- **setup.spec.js** (15 tests): Location setup form
- **box-and-status.spec.js** (23 tests): Box action center and status pages
- **home.spec.js** (15 tests): Home page and location display

**Total: 78+ comprehensive E2E tests**

## Firebase Emulators

Tests automatically start Firebase emulators:

- **Auth**: localhost:9099
- **Firestore**: localhost:8080
- **Functions**: localhost:5001
- **Hosting**: localhost:5000
- **Emulator UI**: localhost:4000

The web app automatically detects localhost and connects to emulators (see `public/js/firebase-init.js`).

## Test Data Management

### Automatic Cleanup

Each test suite:
1. Clears all test data before tests (`beforeEach`)
2. Seeds required configuration (passcodes, etc.)
3. Cleans up after tests complete (`afterEach`)

### Creating Test Data

Use helpers from `firebase-helpers.js`:

```javascript
// Create a test location
await createTestLocation('BOX001', {
  label: 'Test Market',
  address: '123 Main St',
  city: 'Atlanta',
  volunteer: 'Test Volunteer'
});

// Create a test report
await createTestReport('BOX001', {
  reportType: 'problem_report',
  description: 'Box is damaged',
  status: 'new'
});

// Authorize a volunteer
await authorizeVolunteer(uid, email, displayName);
```

## Common Test Patterns

### Creating Authenticated User

```javascript
const username = `testuser${Date.now()}`;
const password = 'testpass123';

await page.goto('/login');
await page.locator('#toggle-sign-up-btn').click();
await page.fill('#auth-email', username);
await page.fill('#auth-password', password);
await page.locator('#email-sign-up-btn').click();
```

### Waiting for Navigation

```javascript
await page.waitForURL(/\/dashboard/, { timeout: 10000 });
```

### Checking Element Content

```javascript
await expect(page.locator('.box-card')).toContainText('Test Market');
```

## Debugging Tips

### View Emulator UI

While tests are running, open http://localhost:4000 to see:
- Firestore data in real-time
- Authentication users
- Cloud Function logs

### Enable Verbose Logging

```bash
DEBUG=pw:api npx playwright test
```

### Screenshots and Videos

Failed tests automatically capture:
- Screenshots (on failure)
- Videos (retained on failure)
- Traces (on first retry)

View in the test report: `npm run test:report`

### Common Issues

**Emulator Won't Start**
```bash
# Kill existing emulator processes
pkill -f firebase
```

**Browser Dependencies Missing**
```bash
sudo npx playwright install-deps chromium
```

**Tests Timing Out**
- Increase timeout in test: `{ timeout: 30000 }`
- Or in config: `timeout: 30 * 1000`

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install chromium

- name: Run tests
  run: npm test

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: test-results/
```

## Test Coverage

### Pages Tested
- ✅ Login (`/login`)
- ✅ Dashboard (`/dashboard`)
- ✅ Setup (`/setup?id=BOXID`)
- ✅ Box Action Center (`/box?id=BOXID`)
- ✅ Status/History (`/status?id=BOXID`)
- ✅ Home (`/`)

### Functionality Tested
- ✅ User authentication (Email, Google OAuth flows)
- ✅ Authorization checks
- ✅ Form validation
- ✅ Box provisioning
- ✅ Report creation and display
- ✅ Status filtering
- ✅ Navigation and redirects
- ✅ Anonymous access
- ✅ Error handling

### Edge Cases Covered
- Missing/invalid box IDs
- Unauthorized users
- Empty states
- Multiple data scenarios
- Invalid input validation
- Existing resource conflicts

## Writing New Tests

### Test Structure

```javascript
const { test, expect } = require('@playwright/test');
const { clearTestData, seedTestConfig } = require('../fixtures/firebase-helpers');

test.describe('Feature Name', () => {
  test.beforeEach(async () => {
    await clearTestData();
    await seedTestConfig('TEST_PASSCODE');
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test('should do something', async ({ page }) => {
    // Arrange
    await page.goto('/page');

    // Act
    await page.click('#button');

    // Assert
    await expect(page.locator('#result')).toBeVisible();
  });
});
```

### Best Practices

1. **Use data-testid attributes** for reliable selectors (future enhancement)
2. **Wait for navigation** before assertions
3. **Clean up test data** in beforeEach/afterEach
4. **Use unique identifiers** (timestamps) for test users/data
5. **Group related tests** in describe blocks
6. **Add descriptive test names** that explain what is being tested

## Maintenance

### Updating Tests After Code Changes

When the app changes:
1. Update selectors if UI elements change
2. Add new test files for new pages
3. Update fixtures if data structure changes
4. Adjust timeouts if performance characteristics change

### Keeping Tests Fast

- Run tests in parallel where possible (current config: 1 worker for Firebase)
- Use `page.waitForTimeout()` sparingly - prefer `waitForSelector()` or `waitForURL()`
- Clean up only what's needed, not the entire database each time

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Best Practices for E2E Testing](https://playwright.dev/docs/best-practices)

## Support

For issues or questions:
1. Check the [GitHub Issues](https://github.com/acklenx/toysfortots/issues)
2. Review test logs: `test-results/` directory
3. Check emulator logs: Firebase console output

---

**Test Suite Version**: 1.0.0
**Last Updated**: 2024-01-05
**Maintained by**: Development Team
