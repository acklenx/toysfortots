import { test, expect } from '@playwright/test';
import {
  clearTestData,
  seedTestConfig,
  createTestLocation
} from '../fixtures/firebase-helpers.js';
import { generateBoxId } from '../fixtures/test-id-generator.js';

/**
 * Smoke Tests - Fast Critical Path Validation
 *
 * Two tranches:
 * - Tranche 1 (Sequential): 4 tests that require sequential execution (1 worker)
 * - Tranche 2 (Parallel): 8 tests that can run in parallel (4 workers)
 *
 * Run with: npx playwright test --grep @smoke
 */

// ============================================================================
// TRANCHE 1: SEQUENTIAL SMOKE TESTS (1 worker)
// ============================================================================

test.describe.configure({ mode: 'serial' });

test.describe('Smoke Tests - Sequential @smoke-sequential', () => {
  test.beforeEach(async () => {
    await seedTestConfig('TEST_PASSCODE');
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test('Sequential 1: Home page loads successfully @smoke', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Page should load without errors
    await expect(page).toHaveURL('/');
  });

  test('Sequential 2: Home displays map with Leaflet @smoke', async ({ page }) => {
    const consoleErrors = [];

    // Monitor console for errors (including CSP violations)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Map element should exist and be visible
    const mapElement = page.locator('#map');
    await expect(mapElement).toBeVisible();

    // CRITICAL: Verify JavaScript actually executed
    // Leaflet creates .leaflet-container when JS runs - if CSP blocks JS, this won't exist
    const leafletContainer = page.locator('.leaflet-container');
    await expect(leafletContainer).toBeVisible({
      timeout: 5000
    });

    // Verify map controls (created by Leaflet JS)
    const zoomControls = page.locator('.leaflet-control-zoom');
    await expect(zoomControls).toBeVisible();

    // Fail test if console errors were detected
    if (consoleErrors.length > 0) {
      console.error('❌ Console errors detected:');
      consoleErrors.forEach(err => console.error('  ', err));
      throw new Error(`Console errors detected: ${consoleErrors.join('; ')}`);
    }
  });

  test('Sequential 3: Box page displays for anonymous users @smoke', async ({ page }) => {
    const boxId = generateBoxId('SMOKE');
    await createTestLocation(boxId, {
      label: 'Smoke Test Location',
      address: '123 Test St',
      city: 'Atlanta'
    });

    await page.goto(`/box?id=${boxId}`);

    // Should display location info
    await expect(page.locator('#location-display')).toContainText('Smoke Test Location');

    // Should have action buttons
    await expect(page.locator('#pickup-btn')).toBeVisible();
    await expect(page.locator('#problem-btn')).toBeVisible();
  });

  test('Sequential 4: Home loads for unauthenticated public visitors @smoke', async ({ page }) => {
    // Homepage uses cache-only (mock cache on localhost, no auth required)
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Homepage should load successfully without authentication
    await expect(page).toHaveURL('/');

    // Map should be visible
    const mapElement = page.locator('#map');
    await expect(mapElement).toBeVisible();

    // Location list container should be visible
    const locationListContainer = page.locator('#location-list-container');
    await expect(locationListContainer).toBeVisible();

    // Should have Leaflet map controls
    const zoomInButton = page.locator('.leaflet-control-zoom-in');
    await expect(zoomInButton).toBeVisible();

    // Page should not redirect to login (homepage is public)
    await expect(page).toHaveURL('/');
  });
});

// ============================================================================
// TRANCHE 2: PARALLEL SMOKE TESTS (4 workers)
// ============================================================================

test.describe('Smoke Tests - Parallel @smoke-parallel', () => {
  test.beforeEach(async () => {
    await seedTestConfig('TEST_PASSCODE');
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test('Parallel 1: Login displays form @smoke', async ({ page }) => {
    const consoleErrors = [];

    // Monitor console for errors (including CSP violations)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/login');

    // CRITICAL: Verify JavaScript executed by checking for header loaded by loader.js
    // If CSP blocks JavaScript, header won't be loaded from _header.html
    // Check for specific element that only exists in the loaded header
    const loadedHeader = page.locator('header img[alt*="Toys for Tots"]');
    await expect(loadedHeader).toBeVisible({ timeout: 5000 });

    // Check that login form elements are visible
    await expect(page.locator('#auth-container h1')).toContainText('Volunteer Access');
    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-password')).toBeVisible();
    await expect(page.locator('#email-sign-in-btn')).toBeVisible();
    await expect(page.locator('#google-login-btn')).toBeVisible();
    await expect(page.locator('#toggle-sign-up-btn')).toBeVisible();

    // Fail test if console errors were detected
    if (consoleErrors.length > 0) {
      console.error('❌ Console errors detected:');
      consoleErrors.forEach(err => console.error('  ', err));
      throw new Error(`Console errors detected: ${consoleErrors.join('; ')}`);
    }
  });

  test('Parallel 2: Login shows error for empty credentials @smoke', async ({ page }) => {
    await page.goto('/login');

    // Wait for auth to be initialized
    await page.waitForFunction(() => window.auth !== undefined);

    // Try to sign in without filling fields
    await page.locator('#email-sign-in-btn').click();

    // Should show error message in the dynamically created #auth-msg element
    await expect(page.locator('#auth-msg')).toContainText('Please enter both username and password');
  });

  test('Parallel 3: Box redirects to login via setup if box does not exist @smoke', async ({ page }) => {
    await page.goto('/box?id=NONEXISTENT_BOX_12345');

    // Should redirect to login with returnUrl pointing to setup
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.url()).toContain('returnUrl');
    await expect(page.url()).toContain('setup');
  });

  test('Parallel 4: Status redirects to login via setup if box does not exist @smoke', async ({ page }) => {
    await page.goto('/status?id=NONEXISTENT_STATUS_12345');

    // Should redirect to login with returnUrl pointing to setup
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.url()).toContain('returnUrl');
    await expect(page.url()).toContain('setup');
  });

  test('Parallel 5: Setup redirects unauthenticated users to login @smoke', async ({ page }) => {
    const boxId = generateBoxId('NEWBOX');

    // Navigate to setup without being logged in
    await page.goto(`/setup?id=${boxId}`);

    // Should redirect to login page with returnUrl
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.url()).toContain('returnUrl');
  });

  test('Parallel 6: Authorize redirects to login if not signed in @smoke', async ({ page }) => {
    // Try to access authorize page without being logged in
    await page.goto('/authorize');

    // Should redirect to login with returnUrl
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.url()).toContain('returnUrl');
  });

  test('Parallel 7: Dashboard redirects unauthenticated users to login @smoke', async ({ page }) => {
    // Navigate to dashboard without being logged in
    await page.goto('/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('Parallel 8: Print page loads without authentication @smoke', async ({ page }) => {
    // Navigate to print page
    await page.goto('/print');

    // Should load successfully (print page is public)
    await expect(page).toHaveURL('/print/');

    // Page should load basic content
    await expect(page.locator('body')).toBeVisible();
  });
});
