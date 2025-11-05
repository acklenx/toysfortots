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
    await seedTestConfig('TEST_PASSCODE');

    // Create and authorize a test user
    const username = `testvolunteer${Date.now()}`;
    const password = 'testpass123';

    testUser = { username, password };

    // Create user account
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();
    await page.waitForTimeout(3000);

    // Get the user's UID from the page context
    const uid = await page.evaluate(() => {
      return new Promise((resolve) => {
        const auth = window.auth;
        if (auth && auth.currentUser) {
          resolve(auth.currentUser.uid);
        } else {
          const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
              resolve(user.uid);
              unsubscribe();
            }
          });
        }
      });
    });

    // Authorize the user
    await authorizeVolunteer(uid, `${username}@toysfortots.mcl1311.com`, username);
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Navigate to dashboard without being logged in
    await page.goto('/dashboard');

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('should display dashboard for authorized user', async ({ page }) => {
    // Sign in
    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Check dashboard elements are visible
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('#volunteer-name')).toBeVisible();
    await expect(page.locator('#sign-out-btn')).toBeVisible();
    await expect(page.locator('#view-filter')).toBeVisible();
  });

  test('should display volunteer name', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    const volunteerName = page.locator('#volunteer-name');
    await expect(volunteerName).toContainText(testUser.username);
  });

  test('should sign out user when sign out button clicked', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Click sign out
    await page.locator('#sign-out-btn').click();
    await page.waitForTimeout(2000);

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display message when no boxes exist', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Should show "no reports" message
    await expect(page.locator('#boxes-container')).toContainText('No reports');
  });

  test('should display boxes with good status', async ({ page }) => {
    // Create a test location
    await createTestLocation('BOX001', {
      label: 'Test Market',
      address: '123 Test St',
      city: 'Atlanta',
      volunteer: testUser.username
    });

    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Wait for boxes to load
    await page.waitForTimeout(3000);

    // Should display the box
    await expect(page.locator('.box-card')).toBeVisible();
    await expect(page.locator('.box-card')).toContainText('Test Market');
    await expect(page.locator('.box-card')).toContainText('Status: Good');
    await expect(page.locator('.box-card')).toContainText('BOX001');
  });

  test('should display boxes with problem status', async ({ page }) => {
    // Create a test location
    await createTestLocation('BOX002', {
      label: 'Test Store',
      address: '456 Test Ave',
      city: 'Atlanta',
      volunteer: testUser.username
    });

    // Create a problem report
    await createTestReport('BOX002', {
      reportType: 'problem_report',
      description: 'Box is damaged',
      status: 'new'
    });

    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Wait for boxes to load
    await page.waitForTimeout(3000);

    // Should display the box with problem status
    await expect(page.locator('.box-card')).toContainText('Test Store');
    await expect(page.locator('.status-problem')).toBeVisible();
    await expect(page.locator('.box-card')).toContainText('problem_report');
    await expect(page.locator('.box-card')).toContainText('Box is damaged');
  });

  test('should display boxes with pickup alert status', async ({ page }) => {
    await createTestLocation('BOX003', {
      label: 'Test Mall',
      volunteer: testUser.username
    });

    await createTestReport('BOX003', {
      reportType: 'pickup_alert',
      description: 'Box is full',
      status: 'new'
    });

    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(3000);

    await expect(page.locator('.box-card')).toContainText('pickup_alert');
    await expect(page.locator('.box-card')).toContainText('Box is full');
  });

  test('should show clear status button for pending reports', async ({ page }) => {
    await createTestLocation('BOX004', {
      label: 'Test Location',
      volunteer: testUser.username
    });

    await createTestReport('BOX004', {
      reportType: 'problem_report',
      description: 'Test problem',
      status: 'new'
    });

    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(3000);

    // Should have clear status button
    await expect(page.locator('.clear-status-btn')).toBeVisible();
    await expect(page.locator('.clear-status-btn')).toContainText('Mark as Cleared');
  });

  test('should have view history link', async ({ page }) => {
    await createTestLocation('BOX005', {
      label: 'Test Box',
      volunteer: testUser.username
    });

    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(3000);

    const historyLink = page.locator('.view-history-btn').first();
    await expect(historyLink).toBeVisible();
    await expect(historyLink).toContainText('View Full History');
    await expect(historyLink).toHaveAttribute('href', /\/status\/\?id=BOX005/);
  });

  test('should filter boxes by volunteer', async ({ page }) => {
    // Create boxes for different volunteers
    await createTestLocation('BOX006', {
      label: 'My Box',
      volunteer: testUser.username
    });

    await createTestLocation('BOX007', {
      label: 'Other Box',
      volunteer: 'Other Volunteer'
    });

    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(3000);

    // Initially should show "My Boxes"
    await expect(page.locator('#boxes-title')).toContainText(`Boxes Assigned to ${testUser.username}`);
    await expect(page.locator('.box-card')).toHaveCount(1);
    await expect(page.locator('.box-card')).toContainText('My Box');

    // Switch to "All Boxes"
    await page.locator('#view-filter').selectOption('all_boxes');
    await page.waitForTimeout(500);

    await expect(page.locator('#boxes-title')).toContainText('All Box Statuses');
    await expect(page.locator('.box-card')).toHaveCount(2);
  });

  test('should display multiple boxes sorted by label', async ({ page }) => {
    await createTestLocation('BOX008', { label: 'Z Store', volunteer: testUser.username });
    await createTestLocation('BOX009', { label: 'A Store', volunteer: testUser.username });
    await createTestLocation('BOX010', { label: 'M Store', volunteer: testUser.username });

    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(3000);

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
    await createTestLocation('BOX011', {
      label: 'Test Location',
      address: '789 Main St',
      city: 'Decatur',
      volunteer: testUser.username
    });

    await page.goto('/login');
    await page.fill('#auth-email', testUser.username);
    await page.fill('#auth-password', testUser.password);
    await page.locator('#email-sign-in-btn').click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await page.waitForTimeout(3000);

    await expect(page.locator('.box-card')).toContainText('789 Main St, Decatur');
  });
});
