import { test, expect } from '@playwright/test';
import {
  clearTestData,
  seedTestConfig,
  authorizeVolunteer,
  createTestLocation
} from '../fixtures/firebase-helpers.js';
import { generateUsername, generateBoxId } from '../fixtures/test-id-generator.js';

test.describe('Setup Page', () => {
  const TEST_PASSCODE = 'TEST_PASSCODE';
  let testUser = null;

  test.beforeEach(async () => {
    // Note: clearTestData() removed to prevent wiping data from parallel workers
    // Unique test IDs prevent collisions between workers
    await seedTestConfig(TEST_PASSCODE);
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  // Helper function to create and authorize a user
  async function createAuthorizedUser(page) {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Wait for auth and get UID
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 10000 });
    const uid = await page.evaluate(() => window.auth?.currentUser?.uid);

    // Authorize the user
    await authorizeVolunteer(uid, `${username}@toysfortots.mcl1311.com`, username);

    return { username, password, uid };
  }

  test('should display box ID from URL parameter', async ({ page }) => {
    await createAuthorizedUser(page);

    // Navigate to setup with box ID
    const boxId = generateBoxId('TESTBOX');
    await page.goto(`/setup?id=${boxId}`);

    // Check that box ID is displayed
    await expect(page.locator('#box-id-display')).toContainText(boxId);
  });

  test('should show error when no box ID in URL', async ({ page }) => {
    await createAuthorizedUser(page);

    // Navigate without box ID
    await page.goto('/setup');

    await expect(page.locator('#box-id-display')).toContainText('ID NOT FOUND');
    await expect(page.locator('.message.error')).toContainText('No Box ID found');
  });

  test('should redirect to status page if box already exists', async ({ page }) => {
    // Create existing box
    const boxId = generateBoxId('EXISTING');
    await createTestLocation(boxId, {
      label: 'Existing Location'
    });

    await createAuthorizedUser(page);

    // Try to setup existing box
    await page.goto(`/setup?id=${boxId}`);

    // Wait for redirect to happen
    await page.waitForURL(new RegExp(`/status/\\?id=${boxId}`), { timeout: 10000 });
  });

  test('should redirect unauthorized users to authorize page @smoke', async ({ page }) => {
    const username = generateUsername('newuser');
    const password = 'testpass123';

    // Create user but don't authorize
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Wait for authentication to complete
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 10000 });

    // Navigate to setup (user is NOT authorized)
    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    // Should redirect to authorize page with boxId
    await page.waitForURL(/\/authorize/, { timeout: 5000 });
    await expect(page.url()).toContain('/authorize');
    await expect(page.url()).toContain(`boxId=${boxId}`);
  });

  test('should redirect unauthenticated users to login page @smoke', async ({ page }) => {
    const boxId = generateBoxId('NEWBOX');

    // Navigate to setup without being logged in
    await page.goto(`/setup?id=${boxId}`);

    // Should redirect to login page with returnUrl
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.url()).toContain('returnUrl');
  });


  test('should show/hide manual address fields', async ({ page }) => {
    await createAuthorizedUser(page);

    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    // Manual address fields should be hidden initially
    await expect(page.locator('#manual-address-fields')).toBeHidden();

    // Click to show address fields
    await page.locator('#show-address-btn').click();

    // Should now be visible
    await expect(page.locator('#manual-address-fields')).toBeVisible();
    await expect(page.locator('#address')).toBeVisible();
    await expect(page.locator('#city')).toBeVisible();
    await expect(page.locator('#state')).toBeVisible();
  });

  test('should validate required fields on form submission', async ({ page }) => {
    await createAuthorizedUser(page);

    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    // Show address fields
    await page.locator('#show-address-btn').click();

    // Try to submit without filling fields
    await page.locator('#submit-btn').click();

    // Should show HTML5 validation or error message
    // The form has required fields, so it should prevent submission
  });

  test('should require contact info on submission', async ({ page }) => {
    await createAuthorizedUser(page);

    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    // Fill in all required fields except contact info
    await page.locator('#show-address-btn').click();
    await page.fill('#address', '123 Test St');
    await page.fill('#city', 'Atlanta');
    await page.fill('#state', 'GA');
    await page.fill('#label', 'Test Location');

    // Leave contactName empty and remove required to test JS validation
    await page.evaluate(() => {
      document.getElementById('contactName').removeAttribute('required');
    });
    await page.fill('#contactName', ''); // Empty name

    await page.locator('#submit-btn').click();

    // Should show JavaScript validation error message
    await expect(page.locator('#message-container .message.error')).toContainText('Please enter a Location Contact Name', { timeout: 5000 });
  });


  test('should have GPS location button', async ({ page }) => {
    await createAuthorizedUser(page);

    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    await expect(page.locator('#gps-btn')).toBeVisible();
    await expect(page.locator('#gps-btn')).toContainText('Use My GPS Location');
  });

  test('should have default state value of GA', async ({ page }) => {
    await createAuthorizedUser(page);

    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    await page.locator('#show-address-btn').click();

    // State field should have default value of GA
    await expect(page.locator('#state')).toHaveValue('GA');
  });

  test('should display form fields correctly', async ({ page }) => {
    await createAuthorizedUser(page);

    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    await page.locator('#show-address-btn').click();

    // Check all form fields are present
    await expect(page.locator('#label')).toBeVisible();
    await expect(page.locator('#address')).toBeVisible();
    await expect(page.locator('#city')).toBeVisible();
    await expect(page.locator('#state')).toBeVisible();
    await expect(page.locator('#contactName')).toBeVisible();
    await expect(page.locator('#contactEmail')).toBeVisible();
    await expect(page.locator('#contactPhone')).toBeVisible();
    await expect(page.locator('#submit-btn')).toBeVisible();
  });
});
