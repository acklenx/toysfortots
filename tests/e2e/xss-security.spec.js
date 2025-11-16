import { test, expect } from '@playwright/test';
import {
  clearTestData,
  seedTestConfig,
  authorizeVolunteer,
  createTestLocation,
  createTestReport
} from '../fixtures/firebase-helpers.js';
import { generateUsername, generateBoxId } from '../fixtures/test-id-generator.js';

/**
 * XSS Security Tests
 *
 * These tests verify that user-generated content is properly escaped before rendering
 * to prevent Cross-Site Scripting (XSS) attacks.
 */

test.describe('XSS Security', () => {
  test.beforeEach(async () => {
    await seedTestConfig('TEST_PASSCODE');
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test('Home: should prevent XSS attacks by escaping HTML in location data', async ({ page }) => {
    const xssBoxId = generateBoxId('XSS');

    // Create location with XSS payloads
    await createTestLocation(xssBoxId, {
      label: '<script>alert("XSS-Label")</script>Evil Store',
      address: '<img src=x onerror=alert("XSS-Addr")>666 Hack Ave',
      city: '<b>Atlanta</b>',
      state: '<i>GA</i>',
      lat: 33.7490,
      lon: -84.3880
    });

    // Listen for any alert dialogs (should not appear if XSS is prevented)
    page.on('dialog', async dialog => {
      throw new Error(`Unexpected dialog appeared: ${dialog.message()}`);
    });

    await page.goto('/');

    // Wait for locations to load
    await page.waitForTimeout(3000);

    // Verify the malicious scripts are rendered as text in the sidebar
    const locationList = page.locator('#location-list');
    await expect(locationList).toContainText('<script>alert("XSS-Label")</script>Evil Store');
    await expect(locationList).toContainText('<img src=x onerror=alert("XSS-Addr")>666 Hack Ave');

    // Verify no script tags were actually rendered in the DOM
    const scriptTags = await page.locator('script:has-text("alert")').count();
    expect(scriptTags).toBe(0);

    // Verify HTML tags are escaped in the location list
    const listHTML = await locationList.innerHTML();
    expect(listHTML).toContain('&lt;script&gt;');
    expect(listHTML).toContain('&lt;img');
    expect(listHTML).not.toContain('<script>alert');
    expect(listHTML).not.toContain('<img src=x onerror');
  });

  test('Dashboard: should prevent XSS attacks by escaping HTML in box and report data', async ({ page }) => {
    const username = generateUsername('xsstest');
    const password = 'testpass123';

    // Create user account
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Wait for authentication to complete
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 10000 });

    // Get user UID and authorize directly
    const userRecord = await page.evaluate(async () => {
      const auth = window.auth;
      const user = auth.currentUser;
      return { uid: user.uid, email: user.email };
    });

    await authorizeVolunteer(userRecord.uid, userRecord.email, username);

    // Get the displayName for creating test data
    const displayName = await page.evaluate(() => {
      return window.auth.currentUser ? (window.auth.currentUser.displayName || window.auth.currentUser.email) : null;
    });

    const xssBoxId = generateBoxId('XSS');

    // Create location with XSS payloads
    await createTestLocation(xssBoxId, {
      label: '<script>alert("XSS-Label")</script>Evil Store',
      address: '<img src=x onerror=alert("XSS-Addr")>123 Hack St',
      city: '<b>Atlanta</b>',
      volunteer: displayName
    });

    // Create report with XSS payload in description
    await createTestReport(xssBoxId, {
      reportType: 'pickup_alert',
      description: '<script>alert("XSS-Desc")</script>Please pick up',
      status: 'new'
    });

    // Listen for any alert dialogs (should not appear if XSS is prevented)
    page.on('dialog', async dialog => {
      throw new Error(`Unexpected dialog appeared: ${dialog.message()}`);
    });

    await page.goto('/dashboard');

    // Wait for boxes to load
    await expect(page.locator('.box-card')).toBeVisible();

    const boxCard = page.locator('.box-card').first();

    // Verify the malicious scripts are rendered as text, not executed
    await expect(boxCard).toContainText('<script>alert("XSS-Label")</script>Evil Store');
    await expect(boxCard).toContainText('<img src=x onerror=alert("XSS-Addr")>123 Hack St');
    await expect(boxCard).toContainText('<script>alert("XSS-Desc")</script>Please pick up');

    // Verify no script tags were actually rendered in the DOM
    const scriptTags = await page.locator('script:has-text("alert")').count();
    expect(scriptTags).toBe(0);

    // Verify HTML tags are escaped in the DOM
    const innerHTML = await boxCard.innerHTML();
    expect(innerHTML).toContain('&lt;script&gt;');
    expect(innerHTML).toContain('&lt;img');
    expect(innerHTML).not.toContain('<script>alert');
    expect(innerHTML).not.toContain('<img src=x onerror');
  });

  test('Box Page: should prevent XSS attacks by escaping HTML in location data', async ({ page }) => {
    const boxId = generateBoxId('XSS_TEST');

    // Create location with XSS payloads in various fields
    await createTestLocation(boxId, {
      label: '<script>alert("XSS")</script>Malicious Store',
      address: '<img src=x onerror=alert("XSS")>123 Evil St',
      city: '<b>Atlanta</b>',
      state: '<i>GA</i>',
      volunteer: '<script>alert("XSS")</script>Hacker'
    });

    // Listen for any alert dialogs (should not appear if XSS is prevented)
    page.on('dialog', async dialog => {
      throw new Error(`Unexpected dialog appeared: ${dialog.message()}`);
    });

    await page.goto(`/box?id=${boxId}`);

    // Wait for anonymous authentication to complete (critical signal that page is ready)
    await page.waitForFunction(() => {
      return window.auth && window.auth.currentUser && window.auth.currentUser.isAnonymous;
    }, { timeout: 10000 });

    const locationDisplay = page.locator('#location-display');

    // Verify the malicious scripts are rendered as text, not executed
    await expect(locationDisplay).toContainText('<script>alert("XSS")</script>Malicious Store');
    await expect(locationDisplay).toContainText('<img src=x onerror=alert("XSS")>123 Evil St');

    // Verify no script tags were actually rendered in the DOM
    const scriptTags = await page.locator('script:has-text("alert")').count();
    expect(scriptTags).toBe(0);
  });

  test('Status Page: should prevent XSS attacks by escaping HTML in location and report data', async ({ page }) => {
    const username = generateUsername('xsstest');
    const password = 'testpass123';

    // Create user account
    await page.goto('/login');
    await page.locator('#toggle-sign-up-btn').click();
    await page.fill('#auth-email', username);
    await page.fill('#auth-password', password);
    await page.locator('#email-sign-up-btn').click();

    // Wait for authentication to complete
    await page.waitForFunction(() => window.auth?.currentUser !== null, { timeout: 10000 });

    // Get user UID and authorize directly
    const userRecord = await page.evaluate(async () => {
      const auth = window.auth;
      const user = auth.currentUser;
      return { uid: user.uid, email: user.email };
    });

    await authorizeVolunteer(userRecord.uid, userRecord.email, username);

    const xssBoxId = generateBoxId('XSS');

    // Create location with XSS payloads
    await createTestLocation(xssBoxId, {
      label: '<script>alert("XSS-Label")</script>Evil Store',
      address: '<img src=x onerror=alert("XSS-Addr")>666 Hack Ave',
      city: '<b>Decatur</b>',
      contactName: '<script>alert("XSS-Contact")</script>Evil Manager',
      contactEmail: '<img src=x onerror=alert("XSS-Email")>evil@test.com',
      volunteer: userRecord.email
    });

    // Create report with XSS payloads
    await createTestReport(xssBoxId, {
      reportType: '<script>alert("XSS-Type")</script>pickup_alert',
      description: '<img src=x onerror=alert("XSS-Desc")>Needs immediate pickup',
      reporterName: '<script>alert("XSS-Reporter")</script>Hacker',
      reporterEmail: '<img src=x onerror=alert("XSS-Email2")>hacker@evil.com',
      status: 'new'
    });

    // Listen for any alert dialogs (should not appear if XSS is prevented)
    page.on('dialog', async dialog => {
      throw new Error(`Unexpected dialog appeared: ${dialog.message()}`);
    });

    await page.goto(`/status?id=${xssBoxId}`);

    // Wait for page to load and find authenticated view
    await page.waitForSelector('#main-content', { timeout: 10000 });

    const locationDisplay = page.locator('#location-display');

    // Verify location XSS is escaped
    await expect(locationDisplay).toContainText('<script>alert("XSS-Label")</script>Evil Store');
    await expect(locationDisplay).toContainText('<img src=x onerror=alert("XSS-Addr")>666 Hack Ave');
    await expect(locationDisplay).toContainText('<script>alert("XSS-Contact")</script>Evil Manager');

    // Get the XSS report (not the box_registered report)
    const reportItem = page.locator('.report-item').filter({ hasText: 'pickup' }).first();
    await expect(reportItem).toBeVisible();
    await expect(reportItem).toContainText('<img src=x onerror=alert("XSS-Desc")>Needs immediate pickup');
    await expect(reportItem).toContainText('<script>alert("XSS-Reporter")</script>Hacker');

    // Verify no script tags were actually rendered in the DOM
    const scriptTags = await page.locator('script:has-text("alert")').count();
    expect(scriptTags).toBe(0);
  });
});
