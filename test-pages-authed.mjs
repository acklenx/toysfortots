import { chromium } from 'playwright';
import { clearTestData, seedTestConfig, createTestLocation, authorizeVolunteer } from './tests/fixtures/firebase-helpers.js';
import admin from 'firebase-admin';

(async () => {
  // Setup test data
  await clearTestData();
  await seedTestConfig('semperfi');

  // Create a test location
  await createTestLocation('TEST123', {
    label: 'Test Location',
    address: '123 Test St',
    city: 'Test City',
    state: 'GA',
    volunteer: 'testuser@example.com'
  });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Go to box page with existing location
  console.log('\n=== Testing box page with existing location ===');
  await page.goto('http://localhost:5000/box/?id=TEST123', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/box-working.png', fullPage: true });
  console.log('✓ Box page screenshot saved');
  console.log(`Title: ${await page.title()}`);
  console.log(`URL: ${page.url()}`);

  await browser.close();
  await clearTestData();

  // Clean up Firebase Admin
  await admin.app().delete();
})();
