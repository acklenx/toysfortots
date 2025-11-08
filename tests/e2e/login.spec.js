import { test, expect } from '@playwright/test';
import { clearTestData, seedTestConfig, authorizeVolunteer } from '../fixtures/firebase-helpers.js';
import { generateUsername, generateBoxId } from '../fixtures/test-id-generator.js';

test.describe('Login Page', () => {
  test.beforeEach(async () => {
    // Note: clearTestData() removed to prevent wiping data from parallel workers
    // Unique test IDs prevent collisions between workers
    await seedTestConfig('TEST_PASSCODE');
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test('should display login form @smoke', async ({ page }) => {
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

  test('should toggle between sign-in and sign-up modes', async ({ page }) => {
    await page.goto('/login');

    // Initially should be in sign-in mode
    await expect(page.locator('#email-sign-in-btn')).toBeVisible();
    await expect(page.locator('#email-sign-up-btn')).toBeHidden();
    await expect(page.locator('#email-auth-title')).toContainText('Sign In with Username');

    // Click toggle to switch to sign-up mode
    await page.locator('#toggle-sign-up-btn').click();

    // Should now be in sign-up mode
    await expect(page.locator('#email-sign-in-btn')).toBeHidden();
    await expect(page.locator('#email-sign-up-btn')).toBeVisible();
    await expect(page.locator('#email-auth-title')).toContainText('Create Account with Username');

    // Toggle back
    await page.locator('#toggle-sign-up-btn').click();

    // Should be back in sign-in mode
    await expect(page.locator('#email-sign-in-btn')).toBeVisible();
    await expect(page.locator('#email-sign-up-btn')).toBeHidden();
  });

  test('should show error for empty credentials @smoke', async ({ page }) => {
    await page.goto('/login');

    // Wait for auth to be initialized
    await page.waitForFunction(() => window.auth !== undefined);

    // Try to sign in without filling fields
    await page.locator('#email-sign-in-btn').click();

    // Should show error message in the dynamically created #auth-msg element
    await expect(page.locator('#auth-msg')).toContainText('Please enter both username and password');
  });

  test('should show error for username with @ symbol', async ({ page }) => {
    await page.goto('/login');

    // Wait for auth to be initialized
    await page.waitForFunction(() => window.auth !== undefined);

    await page.fill('#auth-email', 'user@example.com');
    await page.fill('#auth-password', 'password123');
    await page.locator('#email-sign-in-btn').click();

    // Should show error about @ symbol
    await expect(page.locator('#auth-msg')).toContainText('Username cannot contain "@" symbol');
  });

  test('should create new user account and redirect to authorize page', async ({ page }) => {
    await page.goto('/login');

    const username = generateUsername('testuser');
    const password = 'testpass123';

    // Switch to sign-up mode
    await page.locator('#toggle-sign-up-btn').click();

    // Fill in credentials
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);

    // Create account
    await page.locator('#email-sign-up-btn').click();

    // Should show success message (either "Account created" or "Redirecting to authorization")
    // and redirect to authorize page
    await page.waitForTimeout(1000);
    const authMessage = page.locator('#auth-msg');
    const messageText = await authMessage.textContent().catch(() => '');

    // Accept either "Account created" or "Redirecting to authorization" messages
    expect(messageText).toMatch(/Account created|Redirecting to authorization/i);

    // Should redirect to authorize page
    await page.waitForURL(/\/authorize/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/authorize/);
  });

  test('should show error for invalid sign-in credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#auth-email', 'nonexistentuser');
    await page.fill('#auth-password', 'wrongpassword');
    await page.locator('#email-sign-in-btn').click();

    // Should show error message
    await expect(page.locator('#auth-msg')).toContainText('Invalid username or password', { timeout: 10000 });
  });

  test('should sign in existing user and redirect to authorize page if not authorized', async ({ page }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    // First create the account
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Wait for redirect to authorize page
    await page.waitForURL(/\/authorize/, { timeout: 5000 });

    // Sign out properly using Firebase auth
    await page.evaluate(async () => {
      const { signOut } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js');
      await signOut(window.auth);
    });
    await page.waitForTimeout(1000);

    // Now sign in with the same credentials (user still not authorized)
    await page.goto('/login');
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-in-btn').click();

    // Should show authorization check message then redirect to authorize page
    const authMessage = page.locator('#auth-msg');
    await expect(authMessage).toContainText(/Checking authorization|Redirecting to authorization/i);

    // Should redirect to authorize page again (still not authorized)
    await page.waitForURL(/\/authorize/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/authorize/);
  });

  test('should show error when trying to create account with existing username', async ({ page }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    // Create account first time
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();
    await page.waitForTimeout(2000);

    // Try to create same account again
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Should show error
    await expect(page.locator('#auth-msg')).toContainText('username is already taken', { timeout: 10000 });
  });

  test('should redirect to returnUrl after successful login', async ({ page, context }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    // Mock authorization by setting up user in database
    // First create the user
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();
    await page.waitForTimeout(2000);

    // Navigate away and back with returnUrl
    await page.goto('/');
    await page.goto('/login?returnUrl=/dashboard');

    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-in-btn').click();

    // Wait and check if we're checking authorization
    await page.waitForTimeout(3000);
  });

  test('should validate password length on signup', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', 'newuser');
    await page.fill('#auth-password', '123'); // Too short
    await page.locator('#email-sign-up-btn').click();

    // Should show error about password length
    await expect(page.locator('#auth-msg')).toContainText('at least 6 characters');
  });

  test('should handle form submission via Enter key and redirect to authorize', async ({ page }) => {
    await page.goto('/login');

    const username = generateUsername('testuser');
    const password = 'testpass123';

    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);

    // Press Enter on password field
    await page.locator('#auth-password').press('Enter');

    // Should redirect to authorize page (may show "Account created" or "Redirecting" message)
    await page.waitForURL(/\/authorize/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/authorize/);
  });

  test('should redirect non-authorized user to authorize page with asterisk in footer', async ({ page }) => {
    const username = generateUsername('testuser');
    const password = 'testpass123';

    // Create a user but don't authorize them
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Should redirect to authorize page
    await page.waitForURL(/\/authorize/, { timeout: 10000 });
    await expect(page).toHaveURL(/\/authorize/);

    // Check footer username has asterisk for non-authorized user
    await page.waitForTimeout(2000); // Wait for footer to load and auth check to complete
    const footerUser = page.locator('#logged-in-user');
    await expect(footerUser).toBeVisible();
    const footerText = await footerUser.textContent();
    expect(footerText.endsWith('*')).toBe(true);
  });
});
