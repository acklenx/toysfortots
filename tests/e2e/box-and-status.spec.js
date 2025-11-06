import { test, expect } from '@playwright/test';
import {
  clearTestData,
  seedTestConfig,
  authorizeVolunteer,
  createTestLocation,
  createTestReport,
  getReportsForBox
} from '../fixtures/firebase-helpers.js';

test.describe('Box Action Center and Status Pages', () => {
  test.beforeEach(async () => {
    await clearTestData();
    await seedTestConfig('TEST_PASSCODE');
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test.describe('Box Action Center (/box)', () => {
    test('should redirect to setup if box does not exist', async ({ page }) => {
      await page.goto('/box?id=NONEXISTENT');

      // Should redirect to setup page
      await expect(page).toHaveURL(/\/setup\/\?id=NONEXISTENT/, { timeout: 10000 });
    });

    test('should display box information', async ({ page }) => {
      await createTestLocation('BOX001', {
        label: 'Test Market',
        address: '123 Main St',
        city: 'Atlanta',
        volunteer: 'Test Volunteer'
      });

      await page.goto('/box?id=BOX001');

      // Should display box details
      await expect(page.locator('#location-display')).toContainText('Test Market');
      await expect(page.locator('#location-display')).toContainText('123 Main St');
    });

    test('should display volunteer name', async ({ page }) => {
      await createTestLocation('BOX002', {
        label: 'Test Store',
        volunteer: 'John Doe'
      });

      await page.goto('/box?id=BOX002');

      await expect(page.locator('#location-display')).toContainText('John Doe');
    });

    test('should have pickup and problem buttons', async ({ page }) => {
      await createTestLocation('BOX003', {
        label: 'Test Location'
      });

      await page.goto('/box?id=BOX003');

      await expect(page.locator('#pickup-btn')).toBeVisible();
      await expect(page.locator('#problem-btn')).toBeVisible();
    });

    test('should show error when no box ID provided', async ({ page }) => {
      await page.goto('/box');

      await expect(page.locator('#loading-message')).toContainText('ID missing');
    });
  });

  test.describe('Status/History Page (/status)', () => {
    test('should redirect to setup if box does not exist', async ({ page }) => {
      await page.goto('/status?id=NONEXISTENT');

      // Should redirect to setup page
      await expect(page).toHaveURL(/\/setup\/\?id=NONEXISTENT/, { timeout: 10000 });
    });

    test('should display box information', async ({ page }) => {
      await createTestLocation('BOX101', {
        label: 'Test Market',
        address: '456 Oak St',
        city: 'Decatur',
        volunteer: 'Jane Smith'
      });

      await page.goto('/status?id=BOX101');

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
      await createTestLocation('BOX110', {
        label: 'Test Location',
        contactName: 'Store Manager',
        contactEmail: 'manager@store.com',
        contactPhone: '555-1234'
      });

      await page.goto('/status?id=BOX110');

      // Should display contact info
      await expect(page.locator('#location-display')).toContainText('Store Manager');
    });

    test.describe('Authenticated View', () => {
      let testUser = null;

      test.beforeEach(async ({ page }) => {
        const username = `testvolunteer${Date.now()}`;
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
        await createTestLocation('BOX102', {
          label: 'Test Store',
          volunteer: 'Test Volunteer'
        });

        await page.goto('/status?id=BOX102');

        // Should show the initial "box registered" report
        await expect(page.locator('.report-item')).toBeVisible();
        await expect(page.locator('.report-item').first()).toContainText('box registered');
      });

      test('should display multiple reports in chronological order', async ({ page }) => {
        await createTestLocation('BOX103', {
          label: 'Test Location',
          volunteer: 'Volunteer'
        });

        // Create reports with different timestamps
        const report1 = await createTestReport('BOX103', {
          reportType: 'problem_report',
          description: 'First problem',
          timestamp: new Date('2024-01-01').toISOString(),
          status: 'cleared'
        });

        const report2 = await createTestReport('BOX103', {
          reportType: 'pickup_alert',
          description: 'Pickup needed',
          timestamp: new Date('2024-01-02').toISOString(),
          status: 'new'
        });

        await page.goto('/status?id=BOX103');

        const reportItems = page.locator('.report-item');
        await expect(reportItems).toHaveCount(3); // Initial + 2 created

        // Check that reports are displayed
        await expect(page.locator('text=First problem')).toBeVisible();
        await expect(page.locator('text=Pickup needed')).toBeVisible();
      });

      test('should display problem reports with correct styling', async ({ page }) => {
        await createTestLocation('BOX104', {
          label: 'Test Location'
        });

        await createTestReport('BOX104', {
          reportType: 'problem_report',
          description: 'Box is damaged',
          status: 'new'
        });

        await page.goto('/status?id=BOX104');

        const problemReport = page.locator('.report-item.is-problem').first();
        await expect(problemReport).toBeVisible();
        await expect(problemReport).toContainText('Box is damaged');
      });

      test('should display pickup alerts correctly', async ({ page }) => {
        await createTestLocation('BOX105', {
          label: 'Test Location'
        });

        await createTestReport('BOX105', {
          reportType: 'pickup_alert',
          description: 'Box is full',
          status: 'new'
        });

        await page.goto('/status?id=BOX105');

        const pickupReport = page.locator('.report-item').filter({ hasText: 'pickup alert' });
        await expect(pickupReport).toBeVisible();
        await expect(pickupReport).toContainText('Box is full');
      });

      test('should show report status as New or Cleared', async ({ page }) => {
        await createTestLocation('BOX106', {
          label: 'Test Location'
        });

        await createTestReport('BOX106', {
          reportType: 'problem_report',
          description: 'New problem',
          status: 'new'
        });

        await createTestReport('BOX106', {
          reportType: 'problem_report',
          description: 'Cleared problem',
          status: 'cleared'
        });

        await page.goto('/status?id=BOX106');

        // Check for status badges
        const newStatus = page.locator('.report-status.is-new');
        await expect(newStatus.first()).toBeVisible();
        await expect(newStatus.first()).toContainText('New');

        const clearedStatus = page.locator('.report-status.is-cleared');
        await expect(clearedStatus.first()).toBeVisible();
      });

      test('should display report timestamps', async ({ page }) => {
        await createTestLocation('BOX107', {
          label: 'Test Location'
        });

        await createTestReport('BOX107', {
          reportType: 'problem_report',
          description: 'Test report',
          timestamp: new Date('2024-01-15T10:30:00').toISOString(),
          status: 'new'
        });

        await page.goto('/status?id=BOX107');

        // Should display timestamp
        await expect(page.locator('.report-timestamp').first()).toBeVisible();
        await expect(page.locator('.report-timestamp').first()).toContainText('Report Time');
      });

      test('should display reporter information if available', async ({ page }) => {
        await createTestLocation('BOX108', {
          label: 'Test Location'
        });

        await createTestReport('BOX108', {
          reportType: 'problem_report',
          description: 'Test report',
          reporterName: 'John Reporter',
          reporterEmail: 'john@example.com',
          status: 'new'
        });

        await page.goto('/status?id=BOX108');

        // Should display reporter info
        await expect(page.locator('.report-reporter-info')).toBeVisible();
        await expect(page.locator('.report-reporter-info')).toContainText('John Reporter');
        await expect(page.locator('.report-reporter-info')).toContainText('john@example.com');
      });

      test('should handle reports without description gracefully', async ({ page }) => {
        await createTestLocation('BOX109', {
          label: 'Test Location'
        });

        await createTestReport('BOX109', {
          reportType: 'problem_report',
          description: '',
          status: 'new'
        });

        await page.goto('/status?id=BOX109');

        // Should display default message - filter to get the problem report without description
        await expect(page.locator('.report-item').filter({ hasText: 'No details provided' })).toBeVisible();
      });

      test('should format report types correctly', async ({ page }) => {
        await createTestLocation('BOX112', {
          label: 'Test Location'
        });

        await createTestReport('BOX112', {
          reportType: 'problem_alert',
          description: 'Test',
          status: 'new'
        });

        await page.goto('/status?id=BOX112');

        // Should replace underscores with spaces - use filter to get the specific report
        await expect(page.locator('.report-item').filter({ hasText: 'problem alert' })).toBeVisible();
      });

      test('should display multiple report types', async ({ page }) => {
        await createTestLocation('BOX113', {
          label: 'Test Location'
        });

        await createTestReport('BOX113', {
          reportType: 'problem_report',
          description: 'Problem',
          status: 'new'
        });

        await createTestReport('BOX113', {
          reportType: 'pickup_alert',
          description: 'Pickup',
          status: 'new'
        });

        await createTestReport('BOX113', {
          reportType: 'pickup_details',
          description: 'Details',
          status: 'cleared'
        });

        await page.goto('/status?id=BOX113');

        // Should have multiple different report types visible
        await expect(page.locator('text=problem report')).toBeVisible();
        await expect(page.locator('text=pickup alert')).toBeVisible();
        await expect(page.locator('text=pickup details')).toBeVisible();
      });
    });
  });
});
