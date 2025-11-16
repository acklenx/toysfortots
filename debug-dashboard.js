const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Go to login
  await page.goto('http://localhost:5000/login');
  await page.waitForTimeout(1000);

  // Login as the test user
  const username = `santa_claus_test_${Date.now()}`;
  const password = 'HoHoHo2024!';

  console.log('Creating account...');
  await page.locator('#toggle-sign-up-btn').click();
  await page.fill('#auth-email', username);
  await page.fill('#auth-password', password);
  await page.locator('#email-sign-up-btn').click();

  await page.waitForTimeout(3000);

  // Should be on authorize or dashboard
  console.log('Current URL:', page.url());

  // If on authorize, enter passcode
  if (page.url().includes('/authorize')) {
    console.log('On authorize page, entering passcode...');
    await page.fill('#authorization-code', 'semperfi');
    await page.locator('#authorize-btn').click();
    await page.waitForTimeout(2000);
  }

  // Go to dashboard
  await page.goto('http://localhost:5000/dashboard');
  await page.waitForTimeout(3000);

  console.log('\n=== DASHBOARD PAGE ===');
  console.log('URL:', page.url());

  // Get all text content
  const bodyText = await page.locator('body').textContent();
  console.log('\nPage text content:', bodyText.substring(0, 500));

  // Find all buttons
  const buttons = await page.locator('button').allTextContents();
  console.log('\nAll buttons:', buttons);

  // Find all links
  const links = await page.locator('a').allTextContents();
  console.log('\nAll links:', links);

  // Find elements with class containing 'view'
  const viewElements = await page.locator('[class*="view"]').allTextContents();
  console.log('\nElements with "view" in class:', viewElements);

  // Find elements with class containing 'history'
  const historyElements = await page.locator('[class*="history"]').allTextContents();
  console.log('\nElements with "history" in class:', historyElements);

  // Find all clickable elements
  const clickables = await page.locator('a, button, [onclick], [role="button"]').allTextContents();
  console.log('\nAll clickable elements:', clickables);

  console.log('\nPress Ctrl+C to exit...');
  await page.waitForTimeout(60000);

  await browser.close();
})();
