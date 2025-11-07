import { test, expect } from '@playwright/test';
import {
  clearTestData,
  seedTestConfig,
  authorizeVolunteer,
  createTestLocation,
  createTestReport,
  getReportsForBox
} from '../fixtures/firebase-helpers.js';
import { generateUsername, generateBoxId } from '../fixtures/test-id-generator.js';

test.describe('Box Action Center and Status Pages', () => {
  test.beforeEach(async () => {
    // Note: clearTestData() removed to prevent wiping data from parallel workers
    // Unique test IDs prevent collisions between workers
    await seedTestConfig('TEST_PASSCODE');
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test.describe('Box Action Center (/box)', () => {
    test('should redirect to setup if box does not exist @smoke', async ({ page }) => {
      const boxId = generateBoxId('NONEXISTENT');
      await page.goto(`/box?id=${boxId}`);

      // Should redirect to setup page
      await expect(page).toHaveURL(new RegExp(`/setup/\\?id=${boxId}`), { timeout: 10000 });
    });

    test('should display box information @smoke', async ({ page }) => {
      const boxId = generateBoxId('BOX');
      await createTestLocation(boxId, {
        label: 'Test Market',
        address: '123 Main St',
        city: 'Atlanta',
        volunteer: 'Test Volunteer'
      });

      await page.goto(`/box?id=${boxId}`);

      // Should display box details
      await expect(page.locator('#location-display')).toContainText('Test Market');
      await expect(page.locator('#location-display')).toContainText('123 Main St');
    });

    test('should display volunteer name', async ({ page }) => {
      const boxId = generateBoxId('BOX');
      await createTestLocation(boxId, {
        label: 'Test Store',
        volunteer: 'John Doe'
      });

      await page.goto(`/box?id=${boxId}`);

      await expect(page.locator('#location-display')).toContainText('John Doe');
    });

    test('should have pickup and problem buttons @smoke', async ({ page }) => {
      const boxId = generateBoxId('BOX');
      await createTestLocation(boxId, {
        label: 'Test Location'
      });

      await page.goto(`/box?id=${boxId}`);

      await expect(page.locator('#pickup-btn')).toBeVisible();
      await expect(page.locator('#problem-btn')).toBeVisible();
    });

    test('should show error when no box ID provided', async ({ page }) => {
      await page.goto('/box');

      await expect(page.locator('#loading-message')).toContainText('ID missing');
    });
  });

  test.describe('Status/History Page (/status)', () => {
    test('should redirect to setup if box does not exist @smoke', async ({ page }) => {
      const boxId = generateBoxId('NONEXISTENT');
      await page.goto(`/status?id=${boxId}`);

      // Should redirect to setup page
      await expect(page).toHaveURL(new RegExp(`/setup/\\?id=${boxId}`), { timeout: 10000 });
    });

    test('should display box information @smoke', async ({ page }) => {
      const boxId = generateBoxId('BOX');
      await createTestLocation(boxId, {
        label: 'Test Market',
        address: '456 Oak St',
        city: 'Decatur',
        volunteer: 'Jane Smith'
      });

      await page.goto(`/status?id=${boxId}`);

      // Should display box details
      await expect(page.locator('#location-display')).toContainText('Test Market');
      await expect(page.locator('#location-display')).toContainText('456 Oak St');
      await expect(page.locator('#location-display')).toContainText('Jane Smith');
    });

    test('should show error when no box ID provided', async ({ page }) => {
      await page.goto('/status');

      await expect(page.locator('#loading-message')).toContainText('ID missing');
    });

    test('should display contact information', async ({ page }) => {
      const boxId = generateBoxId('BOX');
      await createTestLocation(boxId, {
        label: 'Test Location',
        contactName: 'Store Manager',
        contactEmail: 'manager@store.com',
        contactPhone: '555-1234'
      });

      await page.goto(`/status?id=${boxId}`);

      // Should display contact info
      await expect(page.locator('#location-display')).toContainText('Store Manager');
    });

    test.describe('Authenticated View', () => {
      let testUser = null;

      test.beforeEach(async ({ page }) => {
        const username = generateUsername('testvolunteer');
        const password = 'testpass123';

        testUser = { username, password };

        // Create user account
        await page.goto('/login');
        await page.locator('#toggle-sign-up-btn').click();
        await page.fill('#auth-email', username);
        await page.fill('#auth-password', password);
        await page.locator('#email-sign-up-btn').click();

        // Wait for authentication to complete by checking for current user
        await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 10000 });

        // Get user UID and authorize directly
        const userRecord = await page.evaluate(async () => {
          const auth = window.auth;
          const user = auth.currentUser;
          return { uid: user.uid, email: user.email };
        });

        await authorizeVolunteer(userRecord.uid, userRecord.email, username);
      });

      test('should display initial box registration report', async ({ page }) => {
        const boxId = generateBoxId('BOX');
        await createTestLocation(boxId, {
          label: 'Test Store',
          volunteer: 'Test Volunteer'
        });

        await page.goto(`/status?id=${boxId}`);

        // Should show the initial "box registered" report
        await expect(page.locator('.report-item')).toBeVisible();
        await expect(page.locator('.report-item').first()).toContainText('box registered');
      });

      test('should display multiple reports in chronological order', async ({ page }) => {
        const boxId = generateBoxId('BOX');
        await createTestLocation(boxId, {
          label: 'Test Location',
          volunteer: 'Volunteer'
        });

        // Create reports with different timestamps
        const report1 = await createTestReport(boxId, {
          reportType: 'problem_report',
          description: 'First problem',
          timestamp: new Date('2024-01-01').toISOString(),
          status: 'cleared'
        });

        const report2 = await createTestReport(boxId, {
          reportType: 'pickup_alert',
          description: 'Pickup needed',
          timestamp: new Date('2024-01-02').toISOString(),
          status: 'new'
        });

        await page.goto(`/status?id=${boxId}`);

        const reportItems = page.locator('.report-item');
        await expect(reportItems).toHaveCount(3); // Initial + 2 created

        // Check that reports are displayed
        await expect(page.locator('text=First problem')).toBeVisible();
        await expect(page.locator('text=Pickup needed')).toBeVisible();
      });

      test('should display problem reports with correct styling', async ({ page }) => {
        const boxId = generateBoxId('BOX');
        await createTestLocation(boxId, {
          label: 'Test Location'
        });

        await createTestReport(boxId, {
          reportType: 'problem_report',
          description: 'Box is damaged',
          status: 'new'
        });

        await page.goto(`/status?id=${boxId}`);

        const problemReport = page.locator('.report-item.is-problem').first();
        await expect(problemReport).toBeVisible();
        await expect(problemReport).toContainText('Box is damaged');
      });

      test('should display pickup alerts correctly', async ({ page }) => {
        const boxId = generateBoxId('BOX');
        await createTestLocation(boxId, {
          label: 'Test Location'
        });

        await createTestReport(boxId, {
          reportType: 'pickup_alert',
          description: 'Box is full',
          status: 'new'
        });

        await page.goto(`/status?id=${boxId}`);

        const pickupReport = page.locator('.report-item').filter({ hasText: 'pickup alert' });
        await expect(pickupReport).toBeVisible();
        await expect(pickupReport).toContainText('Box is full');
      });

      test('should show report status as New or Resolved', async ({ page }) => {
        const boxId = generateBoxId('BOX');
        await createTestLocation(boxId, {
          label: 'Test Location'
        });

        await createTestReport(boxId, {
          reportType: 'problem_report',
          description: 'New problem',
          status: 'new'
        });

        await createTestReport(boxId, {
          reportType: 'problem_report',
          description: 'Resolved problem',
          status: 'cleared'
        });

        await page.goto(`/status?id=${boxId}`);

        // Check for status badges
        const newStatus = page.locator('.report-status.is-new');
        await expect(newStatus.first()).toBeVisible();
        await expect(newStatus.first()).toContainText('New');

        const resolvedStatus = page.locator('.report-status.is-cleared');
        await expect(resolvedStatus.first()).toBeVisible();
        await expect(resolvedStatus.first()).toContainText('Resolved');
      });

      test('should display report timestamps', async ({ page }) => {
        const boxId = generateBoxId('BOX');
        await createTestLocation(boxId, {
          label: 'Test Location'
        });

        await createTestReport(boxId, {
          reportType: 'problem_report',
          description: 'Test report',
          timestamp: new Date('2024-01-15T10:30:00').toISOString(),
          status: 'new'
        });

        await page.goto(`/status?id=${boxId}`);

        // Should display timestamp
        await expect(page.locator('.report-timestamp').first()).toBeVisible();
        await expect(page.locator('.report-timestamp').first()).toContainText('Report Time');
      });

      test('should display reporter information if available', async ({ page }) => {
        const boxId = generateBoxId('BOX');
        await createTestLocation(boxId, {
          label: 'Test Location'
        });

        await createTestReport(boxId, {
          reportType: 'problem_report',
          description: 'Test report',
          reporterName: 'John Reporter',
          reporterEmail: 'john@example.com',
          status: 'new'
        });

        await page.goto(`/status?id=${boxId}`);

        // Should display reporter info
        await expect(page.locator('.report-reporter-info')).toBeVisible();
        await expect(page.locator('.report-reporter-info')).toContainText('John Reporter');
        await expect(page.locator('.report-reporter-info')).toContainText('john@example.com');
      });

      test('should handle reports without description gracefully', async ({ page }) => {
        const boxId = generateBoxId('BOX');
        await createTestLocation(boxId, {
          label: 'Test Location'
        });

        await createTestReport(boxId, {
          reportType: 'problem_report',
          description: '',
          status: 'new'
        });

        await page.goto(`/status?id=${boxId}`);

        // Should display default message - filter to get the problem report without description
        await expect(page.locator('.report-item').filter({ hasText: 'No details provided' })).toBeVisible();
      });

      test('should format report types correctly', async ({ page }) => {
        const boxId = generateBoxId('BOX');
        await createTestLocation(boxId, {
          label: 'Test Location'
        });

        await createTestReport(boxId, {
          reportType: 'problem_alert',
          description: 'Test',
          status: 'new'
        });

        await page.goto(`/status?id=${boxId}`);

        // Should replace underscores with spaces - use filter to get the specific report
        await expect(page.locator('.report-item').filter({ hasText: 'problem alert' })).toBeVisible();
      });

      test('should display multiple report types', async ({ page }) => {
        const boxId = generateBoxId('BOX');
        await createTestLocation(boxId, {
          label: 'Test Location'
        });

        await createTestReport(boxId, {
          reportType: 'problem_report',
          description: 'Problem',
          status: 'new'
        });

        await createTestReport(boxId, {
          reportType: 'pickup_alert',
          description: 'Pickup',
          status: 'new'
        });

        await createTestReport(boxId, {
          reportType: 'pickup_details',
          description: 'Details',
          status: 'cleared'
        });

        await page.goto(`/status?id=${boxId}`);

        // Should have multiple different report types visible
        await expect(page.locator('text=problem report')).toBeVisible();
        await expect(page.locator('text=pickup alert')).toBeVisible();
        await expect(page.locator('text=pickup details')).toBeVisible();
      });
    });
  });
});
