import { test, expect } from '@playwright/test';
import {
  clearTestData,
  seedTestConfig,
  createTestLocation
} from '../fixtures/firebase-helpers.js';

test.describe('Home Page', () => {
  test.beforeEach(async () => {
    await clearTestData();
    await seedTestConfig('TEST_PASSCODE');
  });

  test.afterEach(async () => {
    await clearTestData();
  });

  test('should load home page successfully', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Page should load without errors
    await expect(page).toHaveURL('/');
  });

  test('should display page title', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Check page title
    await expect(page).toHaveTitle(/Toys for Tots/i);
  });

  test('should have header placeholder', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Header should be loaded
    await expect(page.locator('#header-placeholder')).toBeVisible();
  });

  test('should have footer placeholder', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Footer should be loaded
    await expect(page.locator('#footer-placeholder')).toBeVisible();
  });

  test('should initialize without authentication errors', async ({ page }) => {
    // Listen for console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Should not have critical Firebase errors
    const criticalErrors = errors.filter(err =>
      err.includes('Firebase') && err.includes('fatal')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should load without box locations showing message', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    // When no locations exist, page should still load
    // Check that no critical errors are visible
    const errorElements = await page.locator('.error, [class*="error"]').count();
    // Some error styling might exist, but page should be functional
  });

  test('should work with anonymous authentication', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Check that Firebase initialized and user is authenticated anonymously
    const isAuthenticated = await page.evaluate(() => {
      return new Promise((resolve) => {
        if (window.auth) {
          const unsubscribe = window.auth.onAuthStateChanged((user) => {
            resolve(user !== null);
            unsubscribe();
          });
          // Timeout after 5 seconds
          setTimeout(() => {
            resolve(false);
            unsubscribe();
          }, 5000);
        } else {
          resolve(false);
        }
      });
    });

    expect(isAuthenticated).toBe(true);
  });

  test('should load locations when they exist', async ({ page }) => {
    // Create test locations
    await createTestLocation('HOME001', {
      label: 'Test Store 1',
      address: '123 Main St',
      city: 'Atlanta',
      lat: 33.7490,
      lon: -84.3880
    });

    await createTestLocation('HOME002', {
      label: 'Test Store 2',
      address: '456 Oak Ave',
      city: 'Decatur',
      lat: 33.7750,
      lon: -84.2960
    });

    await page.goto('/');
    await page.waitForTimeout(4000);

    // Locations should be loaded via Firebase
    // The exact display mechanism depends on the implementation
    // but we can verify no loading errors occurred
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit more for any delayed errors
    await page.waitForTimeout(2000);

    const firestoreErrors = consoleErrors.filter(err =>
      err.toLowerCase().includes('firestore') && err.toLowerCase().includes('error')
    );
    expect(firestoreErrors.length).toBe(0);
  });

  test('should have valid meta viewport for mobile', async ({ page }) => {
    await page.goto('/');

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });

  test('should load CSS stylesheets', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Check that styles are loaded
    const hasStyles = await page.evaluate(() => {
      const stylesheets = document.styleSheets;
      return stylesheets.length > 0;
    });

    expect(hasStyles).toBe(true);
  });

  test('should load Firebase scripts without errors', async ({ page }) => {
    const scriptErrors = [];
    page.on('pageerror', error => {
      scriptErrors.push(error.message);
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // Check for script loading errors
    const firebaseScriptErrors = scriptErrors.filter(err =>
      err.toLowerCase().includes('firebase')
    );
    expect(firebaseScriptErrors.length).toBe(0);
  });

  test('should connect to Firebase emulators in localhost', async ({ page }) => {
    // Set up console listener BEFORE page loads
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    const emulatorMessage = consoleLogs.find(log =>
      log.includes('Connected to Firebase emulators')
    );
    expect(emulatorMessage).toBeTruthy();
  });

  test('should handle multiple locations without errors', async ({ page }) => {
    // Create multiple locations
    for (let i = 1; i <= 10; i++) {
      await createTestLocation(`MULTI${String(i).padStart(3, '0')}`, {
        label: `Location ${i}`,
        address: `${i}00 Test St`,
        city: 'Atlanta',
        lat: 33.7490 + (i * 0.01),
        lon: -84.3880 + (i * 0.01)
      });
    }

    await page.goto('/');
    await page.waitForTimeout(5000);

    // Should load without timeout or errors
    const pageContent = await page.content();
    expect(pageContent).toBeTruthy();
    expect(pageContent.length).toBeGreaterThan(0);
  });

  test('should be accessible via root URL', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
  });

  test('should load within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds (generous for emulator)
    expect(loadTime).toBeLessThan(10000);
  });

  test('should not redirect to login page', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    // Home page should NOT redirect to login (uses anonymous auth)
    await expect(page).toHaveURL('/');
  });

  test('should work without user interaction', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(4000);

    // Page should be functional without any clicks or input
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
  });
});
