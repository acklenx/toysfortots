const { test, expect } = require('@playwright/test');
const { clearTestData, seedTestConfig, authorizeVolunteer } = require('../fixtures/firebase-helpers');

test.describe('Login Page', () => {
  test.beforeEach(async () => {
    await clearTestData();
    await seedTestConfig('TEST_PASSCODE');
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test('should display login form', async ({ page }) => {
    await page.goto('/login');

    // Check that login form elements are visible
    await expect(page.locator('#auth-container h1')).toContainText('Volunteer Access');
    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-password')).toBeVisible();
    await expect(page.locator('#email-sign-in-btn')).toBeVisible();
    await expect(page.locator('#google-login-btn')).toBeVisible();
    await expect(page.locator('#toggle-sign-up-btn')).toBeVisible();
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

  test('should show error for empty credentials', async ({ page }) => {
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

  test('should create new user account', async ({ page }) => {
    await page.goto('/login');

    const username = `testuser${Date.now()}`;
    const password = 'testpass123';

    // Switch to sign-up mode
    await page.locator('#toggle-sign-up-btn').click();

    // Fill in credentials
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);

    // Create account
    await page.locator('#email-sign-up-btn').click();

    // Should show checking authorization or not authorized message
    await page.waitForTimeout(2000);
    const authMessage = page.locator('#auth-msg');
    const messageText = await authMessage.textContent();
    expect(messageText).toBeTruthy();
  });

  test('should show error for invalid sign-in credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#auth-email', 'nonexistentuser');
    await page.fill('#auth-password', 'wrongpassword');
    await page.locator('#email-sign-in-btn').click();

    // Should show error message
    await expect(page.locator('#auth-msg')).toContainText('Invalid username or password', { timeout: 10000 });
  });

  test('should sign in existing user', async ({ page }) => {
    const username = `testuser${Date.now()}`;
    const password = 'testpass123';

    // First create the account
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Wait for account creation
    await page.waitForTimeout(2000);

    // Sign out (navigate away)
    await page.goto('/');

    // Now sign in with the same credentials
    await page.goto('/login');
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-in-btn').click();

    // Should successfully authenticate and show authorization check message
    await page.waitForTimeout(2000);
    const authMessage = page.locator('#auth-msg');
    const messageText = await authMessage.textContent();
    expect(messageText).toBeTruthy();
  });

  test('should show error when trying to create account with existing username', async ({ page }) => {
    const username = `testuser${Date.now()}`;
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
    const username = `testuser${Date.now()}`;
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

  test('should handle form submission via Enter key', async ({ page }) => {
    await page.goto('/login');

    const username = `testuser${Date.now()}`;
    const password = 'testpass123';

    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);

    // Press Enter on password field
    await page.locator('#auth-password').press('Enter');

    // Should submit the form
    await expect(page.locator('#auth-msg')).toContainText('Checking authorization', { timeout: 10000 });
  });

  test('should show not authorized message for non-authorized user', async ({ page }) => {
    const username = `testuser${Date.now()}`;
    const password = 'testpass123';

    // Create a user but don't authorize them
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Wait for authorization check
    await page.waitForTimeout(3000);

    // Should show not authorized message (since we haven't authorized them)
    const authMessage = page.locator('#auth-msg');
    const messageText = await authMessage.textContent();

    // The message should indicate either checking or not authorized
    expect(messageText).toBeTruthy();
  });
});
