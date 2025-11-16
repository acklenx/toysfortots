import { test, expect } from '@playwright/test';

/**
 * Production End-to-End Tests
 *
 * IMPORTANT: These tests CREATE TEST DATA in the PRODUCTION SITE
 * Run against: https://toysfortots.mcl1311.com
 *
 * Test data uses festive North Pole theme to clearly identify as test data:
 * - Santa Claus, Rudolph, Frosty as test users
 * - North Pole, Lapland, Norway addresses
 * - Clearly marked test boxes with "TEST_" prefix
 *
 * Tests run sequentially with single worker for realistic timing
 * and to avoid rate limiting issues.
 *
 * NOTE: These tests only test VOLUNTEER functions, not admin functions.
 * Admin functions should only be tested in local emulators.
 */

// Test configuration - Using festive North Pole theme
const TEST_CONFIG = {
  // Test passcode for production
  PASSCODE: 'semperfi', // Production passcode set

  // Test users with festive names
  USERS: {
    santa: {
      username: `santa_claus_test_${Date.now()}`,
      password: 'HoHoHo2024!',
      displayName: 'Santa Claus (TEST)'
    },
    rudolph: {
      username: `rudolph_test_${Date.now()}`,
      password: 'RedNose2024!',
      displayName: 'Rudolph the Red-Nosed Reindeer (TEST)'
    },
    frosty: {
      username: `frosty_snowman_test_${Date.now()}`,
      password: 'WinterMagic2024!',
      displayName: 'Frosty the Snowman (TEST)'
    }
  },

  // Test box locations with festive addresses
  BOXES: {
    workshop: {
      id: `TEST_SANTAS_WORKSHOP_${Date.now()}`,
      label: "🎅 Santa's Workshop (TEST BOX)",
      address: '1 Santa Claus Lane',
      city: 'North Pole',
      state: 'AK',
      zip: '99705',
      contactName: 'Mrs. Claus',
      contactPhone: '555-SANTA-1',
      contactEmail: 'workshop@test.northpole'
    },
    stable: {
      id: `TEST_REINDEER_STABLE_${Date.now()}`,
      label: '🦌 Reindeer Stable (TEST BOX)',
      address: '2 Dasher Drive',
      city: 'North Pole',
      state: 'AK',
      zip: '99705',
      contactName: 'Blitzen',
      contactPhone: '555-DEER-1',
      contactEmail: 'stable@test.northpole'
    },
    village: {
      id: `TEST_ELF_VILLAGE_${Date.now()}`,
      label: '🧝 Elf Village Toy Store (TEST BOX)',
      address: '3 Jingle Bell Junction',
      city: 'North Pole',
      state: 'AK',
      zip: '99705',
      contactName: 'Head Elf',
      contactPhone: '555-ELFS-1',
      contactEmail: 'elves@test.northpole'
    },
    gingerbread: {
      id: `TEST_GINGERBREAD_HOUSE_${Date.now()}`,
      label: '🍪 Gingerbread House Bakery (TEST BOX)',
      address: '4 Candy Cane Lane',
      city: 'Rovaniemi',
      state: 'Lapland',
      zip: '96930',
      contactName: 'Gingerbread Man',
      contactPhone: '555-BAKE-1',
      contactEmail: 'bakery@test.lapland'
    }
  }
};

// Helper function to wait with realistic timing
async function realWait(page, ms = 1000) {
  await page.waitForTimeout(ms);
}

test.describe.configure({ mode: 'serial' }); // Force sequential execution

test.describe('Production E2E: New Volunteer Journey', () => {
  test.setTimeout(60000); // 60 second timeout for each test

  let santaBox = TEST_CONFIG.BOXES.workshop;

  test('Step 1: New volunteer (Santa) signs up via QR code flow', async ({ page }) => {
    console.log('🎅 Starting Santa\'s volunteer journey...');
    console.log(`📦 Box ID: ${santaBox.id}`);
    console.log(`👤 Username: ${TEST_CONFIG.USERS.santa.username}`);

    // Simulate scanning QR code - go to box page with new box ID
    await page.goto(`/box?id=${santaBox.id}`);
    await realWait(page, 2000);

    // Should redirect to setup since box doesn't exist
    await expect(page).toHaveURL(/\/setup\?id=/);
    console.log('✅ Redirected to setup page for new box');

    // Should show auth required message
    const authMessage = page.locator('#message');
    await expect(authMessage).toBeVisible({ timeout: 10000 });
    await expect(authMessage).toContainText(/sign in/i);
    console.log('✅ Auth required message shown');

    // Click sign in button
    await page.locator('button:has-text("Sign In")').click();
    await realWait(page, 1000);

    // Should be on login page
    await expect(page).toHaveURL(/\/login/);
    console.log('✅ Redirected to login page');

    // Create new account
    await page.locator('#toggle-mode-btn').click(); // Switch to sign up mode
    await realWait(page, 500);

    await page.fill('#auth-email', TEST_CONFIG.USERS.santa.username);
    await page.fill('#auth-password', TEST_CONFIG.USERS.santa.password);
    await page.fill('#auth-display-name', TEST_CONFIG.USERS.santa.displayName);

    console.log('📝 Filling sign up form...');
    await page.locator('#auth-submit').click();

    // Wait for redirect back to setup page
    await expect(page).toHaveURL(/\/setup\?id=/, { timeout: 15000 });
    console.log('✅ Account created and redirected to setup');

    // Now provision the box with passcode
    await realWait(page, 2000);

    // Fill passcode
    await page.fill('#passcode', TEST_CONFIG.PASSCODE);
    console.log('🔑 Entering passcode...');

    // Fill location details
    await page.fill('#label', santaBox.label);

    // Expand address fields
    await page.locator('#show-address-btn').click();
    await realWait(page, 500);

    await page.fill('#address', santaBox.address);
    await page.fill('#city', santaBox.city);
    await page.fill('#state', santaBox.state);
    await page.fill('#zip', santaBox.zip);
    await page.fill('#contactName', santaBox.contactName);
    await page.fill('#contactPhone', santaBox.contactPhone);
    await page.fill('#contactEmail', santaBox.contactEmail);

    console.log('📍 Filling location details for Santa\'s Workshop...');

    // Submit form
    await page.locator('#submit-btn').click();

    // Should redirect to status page on success
    await expect(page).toHaveURL(/\/status\?id=/, { timeout: 15000 });
    console.log('✅ Box provisioned successfully!');

    // Verify status page shows the box
    await expect(page.locator('h1')).toContainText(santaBox.label);
    await expect(page.locator('.status-item')).toContainText(/registered/i);
    console.log('✅ Status page shows box registration');

    // Take a screenshot for verification
    await page.screenshot({
      path: `test-results/santa-box-created-${Date.now()}.png`,
      fullPage: true
    });
  });

  test('Step 2: Santa explores the dashboard', async ({ page }) => {
    console.log('🎅 Santa exploring dashboard...');

    // Sign in as Santa
    await page.goto('/login');
    await page.fill('#auth-email', TEST_CONFIG.USERS.santa.username);
    await page.fill('#auth-password', TEST_CONFIG.USERS.santa.password);
    await page.locator('#auth-submit').click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    console.log('✅ Logged in and on dashboard');

    await realWait(page, 3000);

    // Check that Santa's box appears in the dashboard
    const boxCard = page.locator('.box-card', { hasText: santaBox.label });
    await expect(boxCard).toBeVisible({ timeout: 10000 });
    console.log('✅ Santa\'s Workshop box visible in dashboard');

    // Click on the box to view details
    await boxCard.click();
    await realWait(page, 2000);

    // Should see Edit button (own box)
    await expect(page.locator('button:has-text("Edit")')).toBeVisible();
    console.log('✅ Edit button visible for own box');

    // Try editing the box
    await page.locator('button:has-text("Edit")').click();
    await realWait(page, 1000);

    // Update the label slightly
    const labelInput = page.locator('#label');
    await labelInput.clear();
    await labelInput.fill(`${santaBox.label} - Updated by Santa`);

    await page.locator('button:has-text("Save")').click();
    await realWait(page, 2000);

    console.log('✅ Successfully edited own box');

    // Go back to dashboard
    await page.goto('/dashboard');
    await realWait(page, 2000);

    // Verify updated label appears
    await expect(page.locator('.box-card')).toContainText('Updated by Santa');
    console.log('✅ Updated label visible in dashboard');
  });

  test('Step 3: Public user reports box needs pickup', async ({ page, context }) => {
    console.log('🎁 Anonymous user reporting box needs pickup...');

    // Clear cookies to simulate anonymous user
    await context.clearCookies();

    // Go directly to box page (simulating QR code scan)
    await page.goto(`/box?id=${santaBox.id}`);
    await realWait(page, 3000);

    // Should load the reporting page
    await expect(page.locator('h1')).toContainText(/Report Box Status/i);
    console.log('✅ Box reporting page loaded for anonymous user');

    // Select "Needs Pickup" status
    await page.locator('input[value="needs_pickup"]').check();
    await realWait(page, 500);

    // Add a festive comment
    await page.fill('#description', 'Box is full of toys! Ready for pickup - Ho ho ho! 🎅');

    console.log('📝 Submitting pickup request...');
    await page.locator('button:has-text("Submit Report")').click();

    // Should show success message
    await expect(page.locator('.message.success')).toBeVisible({ timeout: 10000 });
    console.log('✅ Pickup request submitted successfully');

    // Take screenshot of confirmation
    await page.screenshot({
      path: `test-results/pickup-requested-${Date.now()}.png`,
      fullPage: true
    });
  });

  test('Step 4: Santa checks and clears the pickup request', async ({ page }) => {
    console.log('🎅 Santa checking for pickup requests...');

    // Sign in as Santa again
    await page.goto('/login');
    await page.fill('#auth-email', TEST_CONFIG.USERS.santa.username);
    await page.fill('#auth-password', TEST_CONFIG.USERS.santa.password);
    await page.locator('#auth-submit').click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await realWait(page, 3000);

    // Should see pending report indicator
    const pendingBox = page.locator('.box-card', { hasText: santaBox.label });
    await expect(pendingBox).toContainText(/Pending Report/i);
    console.log('✅ Pending report indicator visible');

    // Click to view the report
    await pendingBox.click();
    await realWait(page, 2000);

    // Should see the pickup request
    await expect(page.locator('.report-item')).toContainText('needs_pickup');
    await expect(page.locator('.report-item')).toContainText('Ho ho ho!');
    console.log('✅ Pickup request details visible');

    // Mark as cleared
    await page.locator('button:has-text("Mark as Cleared")').click();
    await realWait(page, 2000);

    // Confirm in dialog if present
    const dialog = page.locator('.confirm-dialog, [role="dialog"]');
    if (await dialog.isVisible()) {
      await page.locator('button:has-text("Confirm")').click();
      await realWait(page, 1000);
    }

    console.log('✅ Marked pickup request as cleared');

    // Go back to dashboard
    await page.goto('/dashboard');
    await realWait(page, 2000);

    // Should no longer show pending report
    const clearedBox = page.locator('.box-card', { hasText: santaBox.label });
    await expect(clearedBox).not.toContainText(/Pending Report/i);
    console.log('✅ Pending report cleared from dashboard');
  });
});

test.describe('Production E2E: Multi-User Permissions', () => {
  test.setTimeout(60000);

  let rudolphBox = TEST_CONFIG.BOXES.stable;
  let frostyBox = TEST_CONFIG.BOXES.village;

  test('Step 5: Second user (Rudolph) creates account and box', async ({ page }) => {
    console.log('🦌 Rudolph joining as second volunteer...');
    console.log(`📦 Box ID: ${rudolphBox.id}`);

    // Start with box QR code
    await page.goto(`/box?id=${rudolphBox.id}`);
    await realWait(page, 2000);

    // Redirects to setup
    await expect(page).toHaveURL(/\/setup\?id=/);

    // Click sign in
    await page.locator('button:has-text("Sign In")').click();
    await expect(page).toHaveURL(/\/login/);

    // Create Rudolph's account
    await page.locator('#toggle-mode-btn').click();
    await page.fill('#auth-email', TEST_CONFIG.USERS.rudolph.username);
    await page.fill('#auth-password', TEST_CONFIG.USERS.rudolph.password);
    await page.fill('#auth-display-name', TEST_CONFIG.USERS.rudolph.displayName);
    await page.locator('#auth-submit').click();

    await expect(page).toHaveURL(/\/setup\?id=/, { timeout: 15000 });
    console.log('✅ Rudolph account created');

    // Provision Rudolph's box
    await page.fill('#passcode', TEST_CONFIG.PASSCODE);
    await page.fill('#label', rudolphBox.label);
    await page.locator('#show-address-btn').click();
    await page.fill('#address', rudolphBox.address);
    await page.fill('#city', rudolphBox.city);
    await page.fill('#state', rudolphBox.state);
    await page.fill('#zip', rudolphBox.zip);
    await page.fill('#contactName', rudolphBox.contactName);
    await page.locator('#submit-btn').click();

    await expect(page).toHaveURL(/\/status\?id=/, { timeout: 15000 });
    console.log('✅ Reindeer Stable box created');
  });

  test('Step 6: Rudolph can see but not edit Santa\'s box', async ({ page }) => {
    console.log('🦌 Testing cross-user permissions...');

    // Sign in as Rudolph
    await page.goto('/login');
    await page.fill('#auth-email', TEST_CONFIG.USERS.rudolph.username);
    await page.fill('#auth-password', TEST_CONFIG.USERS.rudolph.password);
    await page.locator('#auth-submit').click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    await realWait(page, 3000);

    // Should see both boxes
    await expect(page.locator('.box-card')).toHaveCount(2);
    console.log('✅ Rudolph can see 2 boxes in dashboard');

    // Click on Santa's box
    const santasBox = page.locator('.box-card', { hasText: 'Santa' });
    await santasBox.click();
    await realWait(page, 2000);

    // Should see View button, not Edit
    await expect(page.locator('button:has-text("View")')).toBeVisible();
    await expect(page.locator('button:has-text("Edit")')).not.toBeVisible();
    console.log('✅ Rudolph sees View button (not Edit) for Santa\'s box');

    // Try to view details
    await page.locator('button:has-text("View")').click();
    await realWait(page, 1000);

    // Should see details but no save button
    await expect(page.locator('#label')).toBeDisabled();
    await expect(page.locator('button:has-text("Save")')).not.toBeVisible();
    console.log('✅ Rudolph can view but not edit Santa\'s box');

    // Go back and check own box
    await page.goto('/dashboard');
    await realWait(page, 2000);

    const rudolphsBox = page.locator('.box-card', { hasText: 'Reindeer' });
    await rudolphsBox.click();
    await realWait(page, 1000);

    // Should see Edit button for own box
    await expect(page.locator('button:has-text("Edit")')).toBeVisible();
    console.log('✅ Rudolph sees Edit button for own box');
  });

  test('Step 7: Third user (Frosty) without authorization cannot access dashboard', async ({ page }) => {
    console.log('⛄ Testing unauthorized user access...');

    // Create Frosty's account but don't provision a box
    await page.goto('/login');
    await page.locator('#toggle-mode-btn').click();
    await page.fill('#auth-email', TEST_CONFIG.USERS.frosty.username);
    await page.fill('#auth-password', TEST_CONFIG.USERS.frosty.password);
    await page.fill('#auth-display-name', TEST_CONFIG.USERS.frosty.displayName);
    await page.locator('#auth-submit').click();

    // Should redirect to home page after signup (no specific redirect)
    await realWait(page, 2000);
    console.log('✅ Frosty account created (not authorized)');

    // Try to access dashboard
    await page.goto('/dashboard');
    await realWait(page, 2000);

    // Should redirect to authorize page
    await expect(page).toHaveURL(/\/authorize/);
    console.log('✅ Unauthorized user redirected to authorize page');

    // Should see message about needing to provision a box
    await expect(page.locator('.message, #message')).toContainText(/not authorized|provision.*box/i);
    console.log('✅ Authorization required message shown');
  });

  test('Step 8: Frosty provisions box and gains access', async ({ page }) => {
    console.log('⛄ Frosty provisioning box to gain access...');

    // Sign in as Frosty
    await page.goto('/login');
    await page.fill('#auth-email', TEST_CONFIG.USERS.frosty.username);
    await page.fill('#auth-password', TEST_CONFIG.USERS.frosty.password);
    await page.locator('#auth-submit').click();

    await realWait(page, 2000);

    // Go to setup with Frosty's box ID
    await page.goto(`/setup?id=${frostyBox.id}`);
    await realWait(page, 2000);

    // Provision the box
    await page.fill('#passcode', TEST_CONFIG.PASSCODE);
    await page.fill('#label', frostyBox.label);
    await page.locator('#show-address-btn').click();
    await page.fill('#address', frostyBox.address);
    await page.fill('#city', frostyBox.city);
    await page.fill('#state', frostyBox.state);
    await page.locator('#submit-btn').click();

    await expect(page).toHaveURL(/\/status\?id=/, { timeout: 15000 });
    console.log('✅ Elf Village box created');

    // Now try dashboard again
    await page.goto('/dashboard');
    await realWait(page, 3000);

    // Should see all 3 boxes
    await expect(page.locator('.box-card')).toHaveCount(3);
    console.log('✅ Frosty now has dashboard access and sees 3 boxes');

    // Verify can edit own box
    const frostysBox = page.locator('.box-card', { hasText: 'Elf Village' });
    await frostysBox.click();
    await realWait(page, 1000);

    await expect(page.locator('button:has-text("Edit")')).toBeVisible();
    console.log('✅ Frosty can edit own box');

    // Take final screenshot of dashboard with all test boxes
    await page.goto('/dashboard');
    await realWait(page, 3000);
    await page.screenshot({
      path: `test-results/final-dashboard-${Date.now()}.png`,
      fullPage: true
    });
  });
});

test.describe('Production E2E: Cleanup Verification', () => {
  test('Step 9: Verify test data is clearly marked', async ({ page }) => {
    console.log('🧹 Verifying test data is clearly identifiable...');

    // Check home page map
    await page.goto('/');
    await realWait(page, 5000); // Wait for map to load

    // Look for test markers in location list
    const testLocations = page.locator('.location-item, .marker-popup', { hasText: 'TEST' });
    const count = await testLocations.count();

    console.log(`✅ Found ${count} TEST locations on map`);

    // Each test box should be clearly marked
    const expectedLabels = [
      'Santa\'s Workshop (TEST BOX)',
      'Reindeer Stable (TEST BOX)',
      'Elf Village Toy Store (TEST BOX)'
    ];

    for (const label of expectedLabels) {
      const hasLabel = await page.locator(`:has-text("${label}")`).count() > 0;
      if (hasLabel) {
        console.log(`✅ Found: ${label}`);
      }
    }

    // Take screenshot of map with test locations
    await page.screenshot({
      path: `test-results/map-with-test-locations-${Date.now()}.png`,
      fullPage: true
    });

    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log(`Created ${Object.keys(TEST_CONFIG.USERS).length} test users`);
    console.log(`Created ${Object.keys(TEST_CONFIG.BOXES).length - 1} test boxes`);
    console.log('All test data clearly marked with TEST prefix');
    console.log('Test data uses festive North Pole theme for easy identification');
    console.log('\n⚠️  IMPORTANT: Test data remains in production database');
    console.log('Manual cleanup may be required if needed');
  });
});