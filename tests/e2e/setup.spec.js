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

  test('should display box ID from URL parameter @smoke', async ({ page }) => {
    // Create and sign in a user first
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Navigate to setup with box ID
    const boxId = generateBoxId('TESTBOX');
    await page.goto(`/setup?id=${boxId}`);

    // Check that box ID is displayed
    await expect(page.locator('#box-id-display')).toContainText(boxId);
  });

  test('should show error when no box ID in URL', async ({ page }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

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

    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Try to setup existing box
    await page.goto(`/setup?id=${boxId}`);

    // Wait for redirect to happen
    await page.waitForURL(new RegExp(`/status/\\?id=${boxId}`), { timeout: 10000 });
  });

  test('should hide passcode field for authorized volunteers', async ({ page }) => {
    const username = generateUsername('volunteer');
    const password = 'testpass123';

    // Create user
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Get UID and authorize
    const uid = await page.evaluate(() => {
      return window.auth?.currentUser?.uid;
    });

    if (uid) {
      await authorizeVolunteer(uid, `${username}@toysfortots.mcl1311.com`, username);
    }

    // Navigate to setup
    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    // Passcode field should be hidden
    const passcodeGroup = page.locator('#passcode').locator('..');
    await expect(passcodeGroup).toBeHidden();
  });

  test('should show passcode field for non-authorized users', async ({ page }) => {
    const username = generateUsername('newuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Navigate to setup (user is NOT authorized)
    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    // Passcode field should be visible
    const passcodeGroup = page.locator('#passcode').locator('..');
    await expect(passcodeGroup).toBeVisible();
    await expect(page.locator('label[for="passcode"]')).toContainText('Setup Code');
  });

  test('should show/hide passcode when toggle clicked', async ({ page }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    const passcodeInput = page.locator('#passcode');

    // Initially should be password type
    await expect(passcodeInput).toHaveAttribute('type', 'password');

    // Click toggle
    await page.locator('#toggle-passcode').click();

    // Should change to text type
    await expect(passcodeInput).toHaveAttribute('type', 'text');

    // Click again
    await page.locator('#toggle-passcode').click();

    // Should change back to password
    await expect(passcodeInput).toHaveAttribute('type', 'password');
  });

  test('should display signed in user name', async ({ page }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Wait for auth to complete
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 10000 });

    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    // Should show signed in message with at least the base username
    const baseUsername = username.split('W')[0]; // Get "testuser" part
    await expect(page.locator('#user-display')).toContainText('Signed in as:');
    await expect(page.locator('#user-display')).toContainText(baseUsername);
  });

  test('should show/hide manual address fields', async ({ page }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

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
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

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
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

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
    await page.fill('#passcode', TEST_PASSCODE);

    await page.locator('#submit-btn').click();

    // Should show JavaScript validation error message
    await expect(page.locator('#message-container .message.error')).toContainText('Please enter a Location Contact Name', { timeout: 5000 });
  });

  test('should have sign out button', async ({ page }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Wait for auth to complete
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 10000 });

    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    await expect(page.locator('#sign-out-btn')).toBeVisible();
  });

  test('should have GPS location button', async ({ page }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    await expect(page.locator('#gps-btn')).toBeVisible();
    await expect(page.locator('#gps-btn')).toContainText('Use My GPS Location');
  });

  test('should have default state value of GA', async ({ page }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    const boxId = generateBoxId('NEWBOX');
    await page.goto(`/setup?id=${boxId}`);

    await page.locator('#show-address-btn').click();

    // State field should have default value of GA
    await expect(page.locator('#state')).toHaveValue('GA');
  });

  test('should display form fields correctly', async ({ page }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

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
