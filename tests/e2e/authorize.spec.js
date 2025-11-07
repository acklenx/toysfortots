import { test, expect } from '@playwright/test';
import {
  clearTestData,
  seedTestConfig,
  authorizeVolunteer
} from '../fixtures/firebase-helpers.js';
import { generateUsername } from '../fixtures/test-id-generator.js';

test.describe('Authorization Page', () => {
  const TEST_PASSCODE = 'TEST_PASSCODE';
  let testUsername;
  let testPassword;

  test.beforeEach(async ({ page }) => {
    await seedTestConfig(TEST_PASSCODE);

    testUsername = generateUsername('authorize');
    testPassword = 'testpass123';

    // Create a test user account (not yet authorized)
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', testUsername);
    await page.fill('#auth-password', testPassword);
    await page.locator('#email-sign-up-btn').click();

    // Wait for redirect to authorize page
    await page.waitForURL(/\/authorize/, { timeout: 10000 });
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test('should display authorization page after new user signup', async ({ page }) => {
    // Already on authorize page from beforeEach
    await expect(page).toHaveURL(/\/authorize/);

    // Check page elements (use more specific selector for h1 to avoid header conflict)
    await expect(page.locator('#auth-container h1')).toContainText('Volunteer Authorization');
    await expect(page.locator('#auth-code')).toBeVisible();
    await expect(page.locator('#authorize-btn')).toBeVisible();
  });

  test('should show authorization code input field @smoke', async ({ page }) => {
    const codeInput = page.locator('#auth-code');
    await expect(codeInput).toBeVisible();
    await expect(codeInput).toHaveAttribute('type', 'password');
    await expect(codeInput).toHaveAttribute('placeholder', 'Enter shared code');
  });

  test('should have show/hide code toggle', async ({ page }) => {
    const toggleCode = page.locator('#toggle-code');
    const codeInput = page.locator('#auth-code');

    await expect(toggleCode).toBeVisible();
    await expect(toggleCode).toContainText('Show code');

    // Test toggle functionality
    await toggleCode.click();
    await expect(codeInput).toHaveAttribute('type', 'text');
    await expect(toggleCode).toContainText('Hide code');

    // Toggle back
    await toggleCode.click();
    await expect(codeInput).toHaveAttribute('type', 'password');
    await expect(toggleCode).toContainText('Show code');
  });

  test('should show error when submitting empty code', async ({ page }) => {
    await page.locator('#authorize-btn').click();

    const errorMsg = page.locator('#auth-msg .message');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText('Please enter the authorization code');
  });

  test('should show error for invalid authorization code', async ({ page }) => {
    await page.fill('#auth-code', 'WRONG_CODE');
    await page.locator('#authorize-btn').click();

    // Wait for the function to respond
    await page.waitForTimeout(2000);

    const errorMsg = page.locator('#auth-msg .message');
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText(/Invalid authorization code|check the code/i);
  });

  test('should authorize user with valid code and redirect to dashboard', async ({ page }) => {
    await page.fill('#auth-code', TEST_PASSCODE);
    await page.locator('#authorize-btn').click();

    // Wait for success message
    const successMsg = page.locator('#auth-msg .message');
    await expect(successMsg).toContainText(/Authorization successful/i);

    // Should redirect to dashboard (default when no returnUrl)
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should preserve boxId through authorization flow', async ({ page }) => {
    // Navigate to authorize with boxId parameter
    await page.goto('/authorize?boxId=TEST_BOX_001');

    await page.fill('#auth-code', TEST_PASSCODE);
    await page.locator('#authorize-btn').click();

    // Should redirect to setup page with boxId
    await page.waitForURL(/\/setup\?id=TEST_BOX_001/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/setup\?id=TEST_BOX_001/);
  });

  test('should preserve returnUrl through authorization flow', async ({ page }) => {
    // Navigate to authorize with returnUrl parameter
    const returnUrl = encodeURIComponent('/dashboard');
    await page.goto(`/authorize?returnUrl=${returnUrl}`);

    await page.fill('#auth-code', TEST_PASSCODE);
    await page.locator('#authorize-btn').click();

    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('should redirect already authorized user to destination', async ({ page, context }) => {
    // First authorize the user
    await page.fill('#auth-code', TEST_PASSCODE);
    await page.locator('#authorize-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Now try to access authorize page again
    await page.goto('/authorize?returnUrl=%2Fdashboard');

    // Should immediately redirect (already authorized message)
    await page.waitForTimeout(2000);

    // Should show success message or redirect
    const successMsg = page.locator('#auth-msg .message');
    const hasSuccessMsg = await successMsg.isVisible().catch(() => false);

    if (hasSuccessMsg) {
      await expect(successMsg).toContainText(/already authorized/i);
    }

    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });

  test('should redirect to login if not signed in', async ({ page, context }) => {
    // Sign out the current user
    await page.evaluate(async () => {
      if (window.auth && window.auth.currentUser) {
        const { signOut } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
        await signOut(window.auth);
      }
    });

    // Clear cookies/storage
    await context.clearCookies();

    // Try to access authorize page
    await page.goto('/authorize');

    // Should redirect to login with returnUrl
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.url()).toContain('returnUrl');
  });

  test('should disable submit button while authorizing', async ({ page }) => {
    const authorizeBtn = page.locator('#authorize-btn');

    await page.fill('#auth-code', TEST_PASSCODE);

    // Click and immediately check button state
    await authorizeBtn.click();

    // Button should be disabled
    await expect(authorizeBtn).toBeDisabled();
    await expect(authorizeBtn).toContainText('Authorizing...');
  });

  test('should clear error message when user starts typing', async ({ page }) => {
    // Generate error by submitting empty form
    await page.locator('#authorize-btn').click();

    const errorMsg = page.locator('#auth-msg .message');
    await expect(errorMsg).toBeVisible();

    // Start typing in code field
    await page.fill('#auth-code', 'T');

    // Error should be cleared
    await expect(errorMsg).not.toBeVisible();
  });

  test('should have proper page title', async ({ page }) => {
    await expect(page).toHaveTitle(/Volunteer Authorization.*Toys for Tots/i);
  });

  test('should have header and footer', async ({ page }) => {
    await page.waitForTimeout(1000); // Wait for header/footer to load

    await expect(page.locator('#header-placeholder')).toBeVisible();
    await expect(page.locator('#footer-placeholder')).toBeVisible();
  });

  test('should show help text about getting authorization code', async ({ page }) => {
    const helpText = page.locator('text=/Don\'t have an authorization code/i');
    await expect(helpText).toBeVisible();
    await expect(helpText).toContainText(/Contact your local coordinator/i);
  });

  test('should work with form submission via Enter key', async ({ page }) => {
    await page.fill('#auth-code', TEST_PASSCODE);
    await page.press('#auth-code', 'Enter');

    // Wait for success message
    const successMsg = page.locator('#auth-msg .message');
    await expect(successMsg).toContainText(/Authorization successful/i);

    // Should redirect
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
  });
});
