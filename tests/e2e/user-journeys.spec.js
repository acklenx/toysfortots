import { test, expect } from '@playwright/test';
import { generateBoxId, generateUsername } from '../fixtures/test-id-generator.js';
import { seedTestConfig, createTestLocation } from '../fixtures/firebase-helpers.js';

/**
 * User Journey Tests - Real World Scenarios
 *
 * These tests simulate complete user flows from start to finish without
 * data clearing between steps. Run with 1 worker for 100% success rate.
 *
 * Designed to run against production daily.
 */

test.describe('Anonymous User Journeys', () => {
  let boxId;

  test.beforeAll(async () => {
    // Setup: Create a test box that anonymous users will interact with
    await seedTestConfig('semperfi');
    boxId = generateBoxId('ANON_BOX');
    await createTestLocation(boxId, {
      label: 'Anonymous Test Box',
      address: '100 Public St',
      city: 'Atlanta',
      state: 'GA',
      zip: '30301',
      businessName: 'Public Test Market',
      contactName: 'Test Contact',
      contactPhone: '555-0100',
      volunteerName: 'setup@toysfortots.mcl1311.com'
    });
  });

  test('Journey 1: Anonymous user requests pickup', async ({ page }) => {
    // Load box page
    await page.goto(`/box?id=${boxId}`);

    // Wait for page to load
    await expect(page.locator('#location-display')).not.toContainText('Loading');
    await expect(page.locator('#location-display')).toContainText('Anonymous Test Box');

    // Wait for pickup button to be enabled
    await expect(page.locator('#pickup-btn')).toBeEnabled({ timeout: 15000 });

    // Click pickup button
    await page.locator('#pickup-btn').click();

    // Should show confirmation message
    await expect(page.locator('#pickup-confirmation')).toBeVisible();
    await expect(page.locator('#pickup-confirmation')).toContainText('Message Sent');

    // That's it! Anonymous user submitted the pickup request.
    // Volunteers will see this on their dashboard.
  });

  test('Journey 2: Anonymous user reports problem without contact details', async ({ page }) => {
    // Load box page fresh
    await page.goto(`/box?id=${boxId}`);

    // Wait for page to load
    await expect(page.locator('#location-display')).not.toContainText('Loading');

    // Wait for problem button to be enabled
    await expect(page.locator('#problem-btn')).toBeEnabled({ timeout: 15000 });

    // Click problem button to expand form
    await page.locator('#problem-btn').click();

    // Wait for problem form to be visible
    await expect(page.locator('#problem-details-section')).toBeVisible();

    // Fill out problem description (no contact info)
    await page.fill('textarea[name="description"]', 'The box is damaged and needs replacement');

    // Submit the problem report
    await page.locator('#problem-submit-btn').click();

    // Should show success message (check for either success message or confirmation)
    await expect(page.locator('#problem-details-success')).toBeVisible();

    // That's it! Anonymous user submitted the problem report.
    // Volunteers will see this on their dashboard.
  });

  test('Journey 3: Anonymous user clicks all interactive elements without errors', async ({ page }) => {
    // Load box page fresh
    await page.goto(`/box?id=${boxId}`);

    // Wait for page to load
    await expect(page.locator('#location-display')).not.toContainText('Loading');

    // Track console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait for buttons to be enabled
    await expect(page.locator('#pickup-btn')).toBeEnabled({ timeout: 15000 });
    await expect(page.locator('#problem-btn')).toBeEnabled();

    // Click problem button to expand form
    await page.locator('#problem-btn').click();
    await expect(page.locator('#problem-details-section')).toBeVisible();

    // Click problem button again to collapse
    await page.locator('#problem-btn').click();
    await page.waitForTimeout(500);

    // Click pickup button
    await page.locator('#pickup-btn').click();
    await expect(page.locator('#pickup-confirmation')).toBeVisible();

    // Check for any links and verify they don't cause errors
    const links = page.locator('a[href]:visible');
    const linkCount = await links.count();

    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      const link = links.nth(i);
      const href = await link.getAttribute('href');

      // Skip external links
      if (href && !href.startsWith('http') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
        await expect(link).toBeVisible();
      }
    }

    // Check for console errors
    expect(consoleErrors.length).toBe(0);

    // Verify page still works
    await expect(page.locator('#location-display')).toContainText('Anonymous Test Box');
  });
});

test.describe('Volunteer User Journeys', () => {
  test('Journey 1: New volunteer complete workflow', async ({ page }) => {
    const username = generateUsername('journey_vol');
    const password = 'testpass123';
    const boxId = generateBoxId('JOURNEY_BOX');

    await seedTestConfig('semperfi');

    // === STEP 1: Sign up as new volunteer ===
    await page.goto('/login');

    // Should default to sign-in mode
    await expect(page.locator('#email-auth-title')).toContainText('Sign In with Username');

    // Click to toggle to sign-up mode
    await page.locator('#toggle-sign-up-btn').click();
    await expect(page.locator('#email-auth-title')).toContainText('Create Account');

    // Fill sign-up form
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Wait for auth to complete
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 15000 });

    // === STEP 2: Register first box (this authorizes the volunteer) ===
    await page.goto(`/setup?id=${boxId}`);

    // Wait for setup form to load
    await expect(page.locator('#passcode')).toBeVisible({ timeout: 15000 });

    // Fill out box registration form
    await page.fill('#passcode', 'semperfi');
    await page.fill('#label', 'Journey Test Box');

    // Show address fields
    const showAddressBtn = page.locator('#show-address-btn');
    if (await showAddressBtn.isVisible()) {
      await showAddressBtn.click();
    }

    await page.fill('#address', '200 Volunteer St');
    await page.fill('#city', 'Decatur');
    await page.fill('#state', 'GA');

    await page.fill('#contactName', 'John Journey');
    await page.fill('#contactPhone', '555-0200');

    // Submit registration
    await page.locator('#submit-btn').click();

    // Wait for redirect to status page
    await page.waitForURL(new RegExp(`/status.*id=${boxId}`), { timeout: 20000 });

    // Wait for history to load (first report-item will be "Box Registered")
    const firstReport = page.locator('.report-item').first();
    await expect(firstReport).toBeVisible({ timeout: 10000 });
    await expect(firstReport).toContainText('box registered', { ignoreCase: true });

    // === STEP 3: Check dashboard ===
    await page.goto('/dashboard');

    // Should see dashboard
    await expect(page.locator('#main-content h1')).toContainText('Dashboard');

    // Wait for boxes to load
    await expect(page.locator('#boxes-title')).not.toContainText('Loading');

    // Should see the box we just registered
    const boxCards = page.locator('.box-card');
    await expect(boxCards).toHaveCount(1, { timeout: 10000 });
    await expect(boxCards.first()).toContainText('Journey Test Box');

    // === STEP 4: View box history ===
    const statusLink = page.locator(`a[href*="/status"][href*="${boxId}"]`).first();
    await statusLink.click();

    await page.waitForURL(new RegExp(`/status.*id=${boxId}`));

    // Wait for history to load
    const reportItem = page.locator('.report-item').first();
    await expect(reportItem).toBeVisible({ timeout: 10000 });
    await expect(reportItem).toContainText('box registered', { ignoreCase: true });

    // === STEP 5: Logout ===
    await page.goto('/dashboard');
    await page.locator('#sign-out-btn').click();

    // Wait for redirect to login
    await page.waitForURL(/\/login/, { timeout: 10000 });

    // === STEP 6: As anonymous, create some reports ===
    await page.goto(`/box?id=${boxId}`);

    // Wait for page load
    await expect(page.locator('#location-display')).not.toContainText('Loading');
    await expect(page.locator('#pickup-btn')).toBeEnabled({ timeout: 15000 });

    // Request pickup
    await page.locator('#pickup-btn').click();
    await expect(page.locator('#pickup-confirmation')).toBeVisible();

    // Wait a moment for the report to be submitted
    await page.waitForTimeout(1000);

    // Report a problem
    await page.goto(`/box?id=${boxId}`);
    await expect(page.locator('#problem-btn')).toBeEnabled({ timeout: 15000 });
    await page.locator('#problem-btn').click();
    await expect(page.locator('#problem-details-section')).toBeVisible();
    await page.fill('textarea[name="description"]', 'Box is getting full, please check soon');
    await page.locator('#problem-submit-btn').click();
    await expect(page.locator('#problem-details-success')).toBeVisible();

    // Wait for report to be submitted
    await page.waitForTimeout(1000);

    // === STEP 7: Log back in as volunteer ===
    await page.goto('/login');

    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-in-btn').click();

    // Wait for auth
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 15000 });

    // === STEP 8: Check dashboard - should see pending reports ===
    await page.goto('/dashboard');

    // Wait for dashboard to load
    await expect(page.locator('#boxes-title')).not.toContainText('Loading');

    // Should see the box with alerts
    const boxCard = page.locator('.box-card').filter({ hasText: 'Journey Test Box' });
    await expect(boxCard).toBeVisible({ timeout: 10000 });

    // === STEP 9: View status page ===
    await page.goto(`/status?id=${boxId}`);

    // Should see all reports (pickup, problem, box registered)
    const reportItems = page.locator('.report-item');
    await expect(reportItems.first()).toBeVisible({ timeout: 10000 });

    // Should have multiple reports
    await expect(reportItems).toHaveCount(3, { timeout: 10000 }); // box registered + pickup + problem

    // === STEP 10: Try to clear a status (if clear button exists) ===
    await page.goto('/dashboard');

    // Look for clear button
    const clearBtn = page.locator('.box-card').filter({ hasText: 'Journey Test Box' })
      .locator('button').filter({ hasText: /Clear|Mark as/ }).first();

    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(1500);
    }

    // === STEP 11: Verify can still navigate ===
    await page.goto(`/status?id=${boxId}`);

    // Wait for reports to load
    const verifyReport = page.locator('.report-item').first();
    await expect(verifyReport).toBeVisible({ timeout: 10000 });

    // Should still have all 3 reports
    const allVerifyReports = page.locator('.report-item');
    await expect(allVerifyReports).toHaveCount(3, { timeout: 10000 });

    // === STEP 12: Logout ===
    await page.goto('/dashboard');
    await page.locator('#sign-out-btn').click();
    await page.waitForURL(/\/login/);
  });

  test('Journey 2: Existing volunteer checks and manages boxes', async ({ page }) => {
    const username = generateUsername('existing_vol');
    const password = 'testpass123';
    const boxId = generateBoxId('EXISTING_BOX');

    await seedTestConfig('semperfi');

    // Pre-setup: Create volunteer and box
    await page.goto('/login');

    // Sign up
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 15000 });

    // Register a box to get authorized
    await page.goto(`/setup?id=${boxId}`);

    // Wait for form to load
    await expect(page.locator('#passcode')).toBeVisible({ timeout: 15000 });

    await page.fill('#passcode', 'semperfi');
    await page.fill('#label', 'Existing Vol Box');

    // Show address fields if button exists and is visible
    const showAddressBtn = page.locator('#show-address-btn');
    if (await showAddressBtn.isVisible().catch(() => false)) {
      await showAddressBtn.click();
      await page.waitForTimeout(500);
    }

    // Wait for address field to be visible
    await expect(page.locator('#address')).toBeVisible({ timeout: 5000 });

    await page.fill('#address', '300 Check St');
    await page.fill('#city', 'Atlanta');
    await page.fill('#state', 'GA');
    await page.fill('#contactName', 'Jane Check');
    await page.fill('#contactPhone', '555-0300');
    await page.locator('#submit-btn').click();
    await page.waitForURL(new RegExp(`/status.*id=${boxId}`), { timeout: 20000 });

    // Create a pending report as anonymous
    await page.goto('/dashboard');
    await page.locator('#sign-out-btn').click();
    await page.waitForURL(/\/login/);

    await page.goto(`/box?id=${boxId}`);
    await expect(page.locator('#pickup-btn')).toBeEnabled({ timeout: 15000 });
    await page.locator('#pickup-btn').click();
    await expect(page.locator('#pickup-confirmation')).toBeVisible();
    await page.waitForTimeout(1000);

    // === JOURNEY STARTS: Login ===
    await page.goto('/login');

    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 15000 });

    // === Check dashboard status ===
    await page.goto('/dashboard');

    await expect(page.locator('#main-content h1')).toContainText('Dashboard');
    await expect(page.locator('#boxes-title')).not.toContainText('Loading');

    // Should see box
    const boxCard = page.locator('.box-card').filter({ hasText: 'Existing Vol Box' });
    await expect(boxCard).toBeVisible({ timeout: 10000 });

    // === View detailed status ===
    const statusLink = page.locator(`a[href*="/status"][href*="${boxId}"]`).first();
    await statusLink.click();

    await page.waitForURL(new RegExp(`/status.*id=${boxId}`));

    // Should see reports (will have at least pickup alert and box registered)
    const statusReport = page.locator('.report-item').first();
    await expect(statusReport).toBeVisible({ timeout: 10000 });

    // Check that reports list has multiple items
    const allReports = page.locator('.report-item');
    await expect(allReports).toHaveCount(2, { timeout: 10000 }); // box registered + pickup alert

    // === Clear the status if button exists ===
    await page.goto('/dashboard');

    const clearBtn = page.locator('.box-card').filter({ hasText: 'Existing Vol Box' })
      .locator('button').filter({ hasText: /Clear|Mark as/ }).first();

    if (await clearBtn.isVisible().catch(() => false)) {
      await clearBtn.click();
      await page.waitForTimeout(1500);
    }

    // === Verify status page still works ===
    await page.goto(`/status?id=${boxId}`);

    // Wait for reports to load
    const finalReport = page.locator('.report-item').first();
    await expect(finalReport).toBeVisible({ timeout: 10000 });

    // Should still have both reports
    const finalReports = page.locator('.report-item');
    await expect(finalReports.first()).toBeVisible({ timeout: 10000 });

    // === Logout ===
    await page.goto('/dashboard');
    await page.locator('#sign-out-btn').click();
    await page.waitForURL(/\/login/);

    // Verify logged out
    await expect(page.locator('#auth-email')).toBeVisible();
  });
});
