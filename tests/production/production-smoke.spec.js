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
    const consoleMessages = [];
    const cspViolations = [];

    // Monitor ALL console messages (CSP violations might be warnings, not errors)
    page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      consoleMessages.push({ type, text });

      // Detect CSP violations in any message type
      if (text.includes('Content Security Policy') || text.includes('CSP') ||
          text.toLowerCase().includes('blocked') || text.includes('refused to') ||
          text.includes('violates the following')) {
        cspViolations.push(`[${type}] ${text}`);
      }
    });

    // Expose function to collect CSP violations
    await page.exposeFunction('reportCSPViolation', (violation) => {
      cspViolations.push(`${violation.directive}: ${violation.uri}`);
    });

    // Capture CSP violations via the browser API
    await page.addInitScript(() => {
      window.cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        const v = {
          directive: e.violatedDirective,
          uri: e.blockedURI
        };
        window.cspViolations.push(v);
        window.reportCSPViolation(v);
      });
    });

    await page.goto('/');

    // Wait a bit for all resources to load and violations to be logged
    await page.waitForTimeout(5000);

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

    // Get CSP violations from the page
    const capturedViolations = await page.evaluate(() => window.cspViolations || []);
    if (capturedViolations.length > 0) {
      console.error('❌ CSP VIOLATIONS (via API):');
      capturedViolations.forEach(v => {
        console.error(`  Directive: ${v.directive}, Blocked: ${v.uri}`);
        cspViolations.push(`${v.directive}: ${v.uri}`);
      });
    }

    // Print all console messages for debugging
    console.log('\n📋 All console messages:');
    consoleMessages.forEach(msg => {
      const preview = msg.text.length > 150 ? msg.text.substring(0, 150) + '...' : msg.text;
      console.log(`  [${msg.type}] ${preview}`);

      // Check specifically for "Refused to connect" CSP violations
      if (msg.text.includes('Refused to connect') || msg.text.includes('refused to')) {
        cspViolations.push(`[${msg.type}] ${msg.text}`);
      }
    });

    // Report CSP violations if detected
    if (cspViolations.length > 0) {
      console.error(`\n❌ ${cspViolations.length} CSP VIOLATIONS DETECTED:`);
      cspViolations.forEach(violation => console.error('  ', violation));
      throw new Error(`${cspViolations.length} CSP violations detected`);
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
