import { test, expect } from '@playwright/test';

/**
 * Production Smoke Tests
 *
 * These tests run against https://toysfortots.mcl1311.com
 * They verify:
 * - Pages load successfully
 * - JavaScript executes (not blocked by CSP)
 * - Security headers are present
 * - No console errors
 *
 * IMPORTANT: These are READ-ONLY tests, safe for production
 */

test.describe('Production Site Health', () => {

  test('homepage should load and JavaScript should execute', async ({ page }) => {
    const consoleErrors = [];

    // Monitor console for errors (CSP violations show here)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/');

    // Verify page loaded
    await expect(page).toHaveTitle(/Toys for Tots/);

    // CRITICAL: Verify JavaScript executed
    // Leaflet creates .leaflet-container when map initializes
    // If CSP blocks JS, this element won't exist
    const leafletContainer = page.locator('.leaflet-container');
    await expect(leafletContainer).toBeVisible({ timeout: 10000 });

    // Verify map controls (created by Leaflet JS)
    const zoomControls = page.locator('.leaflet-control-zoom');
    await expect(zoomControls).toBeVisible();

    // Verify header loaded by loader.js
    const header = page.locator('header img[alt*="Toys for Tots"]');
    await expect(header).toBeVisible();

    // Fail test if console errors detected
    if (consoleErrors.length > 0) {
      console.error('❌ Console errors detected in production:');
      consoleErrors.forEach(err => console.error('  ', err));
      throw new Error(`Console errors detected: ${consoleErrors.join('; ')}`);
    }
  });

  test('login page should load and JavaScript should execute', async ({ page }) => {
    const consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/login');

    // Verify page loaded
    await expect(page).toHaveTitle(/Sign In/);

    // Verify header loaded by loader.js (CSP would block this)
    const header = page.locator('header img[alt*="Toys for Tots"]');
    await expect(header).toBeVisible({ timeout: 10000 });

    // Verify login form is present
    await expect(page.locator('#auth-email')).toBeVisible();
    await expect(page.locator('#auth-password')).toBeVisible();

    // Fail test if console errors detected
    if (consoleErrors.length > 0) {
      console.error('❌ Console errors detected in production:');
      consoleErrors.forEach(err => console.error('  ', err));
      throw new Error(`Console errors detected: ${consoleErrors.join('; ')}`);
    }
  });

  test('security headers should be present', async ({ page }) => {
    const response = await page.goto('/');

    const headers = response.headers();

    // Verify CSP header
    expect(headers['content-security-policy']).toBeTruthy();
    expect(headers['content-security-policy']).toContain('script-src');

    // Verify other security headers
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBeTruthy();
    expect(headers['permissions-policy']).toBeTruthy();

    console.log('✅ Security headers verified:');
    console.log('  Content-Security-Policy:', headers['content-security-policy'].substring(0, 80) + '...');
    console.log('  X-Frame-Options:', headers['x-frame-options']);
    console.log('  X-Content-Type-Options:', headers['x-content-type-options']);
    console.log('  Referrer-Policy:', headers['referrer-policy']);
    console.log('  Permissions-Policy:', headers['permissions-policy'].substring(0, 80) + '...');
  });

  test('box page should handle missing ID gracefully', async ({ page }) => {
    const consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/box');

    // Should show error message (not crash)
    await expect(page.locator('#loading-message')).toContainText('ID missing', { timeout: 10000 });

    // Header should still load
    const header = page.locator('header img[alt*="Toys for Tots"]');
    await expect(header).toBeVisible();

    // Fail test if console errors detected
    if (consoleErrors.length > 0) {
      console.error('❌ Console errors detected in production:');
      consoleErrors.forEach(err => console.error('  ', err));
      throw new Error(`Console errors detected: ${consoleErrors.join('; ')}`);
    }
  });

  test('dashboard should redirect unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Login page should load successfully
    await expect(page.locator('#auth-email')).toBeVisible();
  });
});
