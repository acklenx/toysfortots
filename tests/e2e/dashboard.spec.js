const { test, expect } = require('@playwright/test');
const {
  clearTestData,
  seedTestConfig,
  authorizeVolunteer,
  createTestLocation,
  createTestReport
} = require('../fixtures/firebase-helpers');

test.describe('Dashboard Page', () => {
  let testUser = null;

  test.beforeEach(async ({ page }) => {
    await clearTestData();
    await seedTestConfig('semperfi');

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

  test.afterEach(async () => {
    await clearTestData();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // This test doesn't need the user created in beforeEach
    // Clear data first to ensure clean state
    await clearTestData();

    // Navigate to dashboard without being logged in
    await page.goto('/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display dashboard for authorized user', async ({ page }) => {
    // User is already logged in from beforeEach, just navigate to dashboard
    await page.goto('/dashboard/');

    // Check dashboard elements are visible
    await expect(page.locator('#main-content h1')).toContainText('Dashboard');
    await expect(page.locator('#volunteer-name')).toBeVisible();
    await expect(page.locator('#sign-out-btn')).toBeVisible();
    await expect(page.locator('#view-filter')).toBeVisible();
  });

  test('should display volunteer name', async ({ page }) => {
    await page.goto('/dashboard/');

    const volunteerName = page.locator('#volunteer-name');
    await expect(volunteerName).toContainText(testUser.username);
  });

  test('should sign out user when sign out button clicked', async ({ page }) => {
    await page.goto('/dashboard/');

    // Wait for sign-out button to be visible before clicking
    await expect(page.locator('#sign-out-btn')).toBeVisible();
    await page.locator('#sign-out-btn').click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display message when no boxes exist', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for data to load

    // Should show "no reports" message
    await expect(page.locator('#boxes-container')).toContainText('No reports');
  });

  test('should display boxes with good status', async ({ page }) => {
    // Get the displayName that dashboard will use for filtering
    const displayName = await page.evaluate(() => {
      return window.auth.currentUser ? (window.auth.currentUser.displayName || window.auth.currentUser.email) : null;
    });

    await createTestLocation('BOX001', {
      label: 'Test Market',
      address: '123 Test St',
      city: 'Atlanta',
      volunteer: displayName
    });

    await page.goto('/dashboard');

    await expect(page.locator('.box-card')).toBeVisible();
    await expect(page.locator('.box-card')).toContainText('Test Market');
    await expect(page.locator('.box-card')).toContainText('Status: Good');
    await expect(page.locator('.box-card')).toContainText('BOX001');
  });

  test('should display boxes with problem status', async ({ page }) => {
    // Get the displayName that dashboard will use for filtering
    const displayName = await page.evaluate(() => {
      return window.auth.currentUser ? (window.auth.currentUser.displayName || window.auth.currentUser.email) : null;
    });

    // Create a test location
    await createTestLocation('BOX002', {
      label: 'Test Store',
      address: '456 Test Ave',
      city: 'Atlanta',
      volunteer: displayName
    });

    // Create a problem report
    await createTestReport('BOX002', {
      reportType: 'problem_report',
      description: 'Box is damaged',
      status: 'new'
    });

    await page.goto('/dashboard');

    // Wait for boxes to load

    // Should display the box with problem status
    await expect(page.locator('.box-card')).toContainText('Test Store');
    await expect(page.locator('.status-problem')).toBeVisible();
    await expect(page.locator('.box-card')).toContainText('problem report');
    await expect(page.locator('.box-card')).toContainText('Box is damaged');
  });

  test('should display boxes with pickup alert status', async ({ page }) => {
    // Get the displayName that dashboard will use for filtering
    const displayName = await page.evaluate(() => {
      return window.auth.currentUser ? (window.auth.currentUser.displayName || window.auth.currentUser.email) : null;
    });

    await createTestLocation('BOX003', {
      label: 'Test Mall',
      volunteer: displayName
    });

    await createTestReport('BOX003', {
      reportType: 'pickup_alert',
      description: 'Box is full',
      status: 'new'
    });

    await page.goto('/dashboard');

    await expect(page.locator('.box-card')).toContainText('pickup alert');
    await expect(page.locator('.box-card')).toContainText('Box is full');
  });

  test('should show clear status button for pending reports', async ({ page }) => {
    // Get the displayName that dashboard will use for filtering
    const displayName = await page.evaluate(() => {
      return window.auth.currentUser ? (window.auth.currentUser.displayName || window.auth.currentUser.email) : null;
    });

    await createTestLocation('BOX004', {
      label: 'Test Location',
      volunteer: displayName
    });

    await createTestReport('BOX004', {
      reportType: 'problem_report',
      description: 'Test problem',
      status: 'new'
    });

    await page.goto('/dashboard');

    // Should have clear status button
    await expect(page.locator('.clear-status-btn')).toBeVisible();
    await expect(page.locator('.clear-status-btn')).toContainText('Mark as Cleared');
  });

  test('should have view history link', async ({ page }) => {
    // Get the displayName that dashboard will use for filtering
    const displayName = await page.evaluate(() => {
      return window.auth.currentUser ? (window.auth.currentUser.displayName || window.auth.currentUser.email) : null;
    });

    await createTestLocation('BOX005', {
      label: 'Test Box',
      volunteer: displayName
    });

    await page.goto('/dashboard/');

    const historyLink = page.locator('.view-history-btn').first();
    await expect(historyLink).toBeVisible();
    await expect(historyLink).toContainText('View Full History');
    await expect(historyLink).toHaveAttribute('href', /\/status\/\?id=BOX005/);
  });

  test('should filter boxes by volunteer', async ({ page }) => {
    // Get the displayName that dashboard will use for filtering
    const displayName = await page.evaluate(() => {
      return window.auth.currentUser ? (window.auth.currentUser.displayName || window.auth.currentUser.email) : null;
    });

    // Create boxes for different volunteers
    await createTestLocation('BOX006', {
      label: 'My Box',
      volunteer: displayName
    });

    await createTestLocation('BOX007', {
      label: 'Other Box',
      volunteer: 'Other Volunteer'
    });

    await page.goto('/dashboard');

    // Initially should show "My Boxes"
    await expect(page.locator('#boxes-title')).toContainText(`Boxes Assigned to ${displayName}`);
    await expect(page.locator('.box-card')).toHaveCount(1);
    await expect(page.locator('.box-card')).toContainText('My Box');

    // Switch to "All Boxes"
    await page.locator('#view-filter').selectOption('all_boxes');

    await expect(page.locator('#boxes-title')).toContainText('All Box Statuses');
    await expect(page.locator('.box-card')).toHaveCount(2);
  });

  test('should display multiple boxes sorted by label', async ({ page }) => {
    // Get the displayName that dashboard will use for filtering
    const displayName = await page.evaluate(() => {
      return window.auth.currentUser ? (window.auth.currentUser.displayName || window.auth.currentUser.email) : null;
    });

    await createTestLocation('BOX008', { label: 'Z Store', volunteer: displayName });
    await createTestLocation('BOX009', { label: 'A Store', volunteer: displayName });
    await createTestLocation('BOX010', { label: 'M Store', volunteer: displayName });

    await page.goto('/dashboard');

    const boxCards = page.locator('.box-card');
    await expect(boxCards).toHaveCount(3);

    // Check they're sorted alphabetically
    const firstBox = boxCards.nth(0);
    const secondBox = boxCards.nth(1);
    const thirdBox = boxCards.nth(2);

    await expect(firstBox).toContainText('A Store');
    await expect(secondBox).toContainText('M Store');
    await expect(thirdBox).toContainText('Z Store');
  });

  test('should show correct address and city', async ({ page }) => {
    // Get the displayName that dashboard will use for filtering
    const displayName = await page.evaluate(() => {
      return window.auth.currentUser ? (window.auth.currentUser.displayName || window.auth.currentUser.email) : null;
    });

    await createTestLocation('BOX011', {
      label: 'Test Location',
      address: '789 Main St',
      city: 'Decatur',
      volunteer: displayName
    });

    await page.goto('/dashboard');

    await expect(page.locator('.box-card')).toContainText('789 Main St, Decatur');
  });
});
