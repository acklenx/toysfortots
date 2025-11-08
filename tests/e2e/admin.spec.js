import { test, expect } from '@playwright/test';
import {
  clearTestData,
  seedTestConfig,
  authorizeVolunteer,
  createTestLocation,
  createTestReport
} from '../fixtures/firebase-helpers.js';
import { generateUsername, generateBoxId } from '../fixtures/test-id-generator.js';

test.describe.configure({ mode: 'serial' }); // Run admin tests sequentially

test.describe('Admin Panel', () => {
  let testUser = null;

  test.beforeEach(async ({ page }) => {
    await seedTestConfig('semperfi');

    const username = generateUsername('admin');
    const password = 'testpass123';

    testUser = { username, password };

    // Create user account
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Wait for authentication to complete
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 10000 });

    // Get user UID and authorize
    const userRecord = await page.evaluate(async () => {
      const auth = window.auth;
      const user = auth.currentUser;
      return { uid: user.uid, email: user.email };
    });

    await authorizeVolunteer(userRecord.uid, userRecord.email, username);
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test('should load admin panel for authorized users @smoke', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('/admin');

    // Should show admin panel heading (use main to avoid header h1)
    await expect(page.locator('main h1')).toContainText('Admin Panel');

    // Should show all three management sections
    await expect(page.locator('h2:has-text("Box Management")')).toBeVisible();
    await expect(page.locator('h2:has-text("Report Management")')).toBeVisible();
    await expect(page.locator('h2:has-text("Volunteer Management")')).toBeVisible();

    // Should show search inputs for filtering
    await expect(page.locator('#boxes-search')).toBeVisible();
    await expect(page.locator('#reports-search')).toBeVisible();
    await expect(page.locator('#volunteers-search')).toBeVisible();
  });

  test('should display data in all three tables when items exist @smoke', async ({ page }) => {
    // Create test data
    const boxId = generateBoxId('ADMIN_TEST');

    // Ensure auth is ready before getting user info
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 10000 });

    // Get current user info
    const userRecord = await page.evaluate(async () => {
      const auth = window.auth;
      const user = auth.currentUser;
      return { uid: user.uid, email: user.email };
    });

    // Create a test box
    await createTestLocation(boxId, {
      label: 'Admin Test Location',
      address: '123 Test St',
      city: 'Atlanta',
      state: 'GA',
      volunteerEmail: userRecord.email,
      volunteer: testUser.username
    });

    // Create a test report
    await createTestReport(boxId, {
      reportType: 'pickup_alert',
      status: 'new',
      description: 'Test pickup needed'
    });

    // Navigate to admin panel
    await page.goto('/admin');

    // Wait for tables to load (admin page loads data async)
    await page.waitForSelector('#admin-content[style*="block"]', { timeout: 5000 });

    // Box Management should show the test box
    const boxContainer = page.locator('#boxes-container');
    await expect(boxContainer).toContainText(boxId, { timeout: 5000 });
    await expect(boxContainer).toContainText('Admin Test Location');

    // Report Management should show the test report
    const reportContainer = page.locator('#reports-container');
    await expect(reportContainer).toContainText(boxId);
    await expect(reportContainer).toContainText('pickup_alert');

    // Volunteer Management should show current user
    const volunteerContainer = page.locator('#volunteers-container');
    await expect(volunteerContainer).toContainText(userRecord.email);
  });
});
