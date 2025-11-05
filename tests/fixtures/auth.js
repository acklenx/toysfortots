const { test as base } = require('@playwright/test');

/**
 * Test fixtures for authentication and common operations
 */
exports.test = base.extend({
  /**
   * Create an authenticated user context with email/username
   */
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login page
    await page.goto('/login');

    // Create a test user account
    const username = `testuser${Date.now()}`;
    const password = 'testpass123';

    // Fill in the username and password
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);

    // Click create account (or sign in if already exists)
    const createButton = page.locator('#email-sign-up-btn');
    if (await createButton.isVisible()) {
      await createButton.click();
    } else {
      await page.locator('#email-sign-in-btn').click();
    }

    // Wait for authentication to complete
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    await use(page);
  },

  /**
   * Create an authorized volunteer context
   */
  authorizedVolunteerPage: async ({ page }, use) => {
    // This would require setting up the volunteer in Firestore
    // For now, we'll use the authenticated page
    await page.goto('/login');

    const username = `volunteer${Date.now()}`;
    const password = 'testpass123';

    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);

    const createButton = page.locator('#email-sign-up-btn');
    if (await createButton.isVisible()) {
      await createButton.click();
    } else {
      await page.locator('#email-sign-in-btn').click();
    }

    await page.waitForTimeout(2000);

    await use(page);
  }
});

/**
 * Helper function to create a test user
 */
exports.createTestUser = async (page, username, password) => {
  await page.goto('/login');
  await page.fill('#auth-email', username);
  await page.fill('#auth-password', password);

  // Switch to create account mode if needed
  const signUpButton = page.locator('#email-sign-up-btn');
  if (!await signUpButton.isVisible()) {
    await page.locator('#toggle-sign-up-btn').click();
  }

  await signUpButton.click();
  await page.waitForTimeout(2000);
};

/**
 * Helper function to sign in
 */
exports.signIn = async (page, username, password) => {
  await page.goto('/login');
  await page.fill('#auth-email', username);
  await page.fill('#auth-password', password);

  // Make sure we're in sign-in mode
  const signInButton = page.locator('#email-sign-in-btn');
  if (!await signInButton.isVisible()) {
    await page.locator('#toggle-sign-up-btn').click();
  }

  await signInButton.click();
  await page.waitForTimeout(2000);
};

/**
 * Helper function to sign out
 */
exports.signOut = async (page) => {
  const signOutButton = page.locator('#sign-out-btn');
  if (await signOutButton.isVisible()) {
    await signOutButton.click();
    await page.waitForTimeout(1000);
  }
};
