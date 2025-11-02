import { test, expect } from '@playwright/test';

test.describe('Setup Page: Unauthenticated User', () => {

	// This test is fine, it already waits for #auth-container
	test('should show login options for a new user', async ({ page }) => {
		await page.goto('/setup/?id=test-box-123');
		await expect(page.locator('#auth-container')).toBeVisible(); // This wait is good
		await expect(page.locator('#new-location-form')).toBeHidden();
		await expect(page.locator('#box-id-display')).toHaveText('test-box-123');
		await expect(page.locator('#sign-in-btn')).toHaveText('Sign In with Google');
		await expect(page.locator('#show-email-setup-btn')).toBeVisible();
	});

	//
	// --- THIS TEST NEEDS THE FIX ---
	//
	test('should show email auth fields when clicked', async ({ page }) => {
		// 1. ARRANGE: Go to the page
		await page.goto('/setup/?id=test-box-123');

		// 2. WAIT FOR APP TO BE READY (THE FIX)
		// This line forces Playwright to wait for onAuthStateChanged
		// to finish before the test continues.
		await expect(page.locator('#auth-container')).toBeVisible();

		// 3. ACT: Click the button (now it's safe)
		await page.locator('#show-email-setup-btn').click();

		// 4. ASSERT: Check that the email section appears
		await expect(page.locator('#email-auth-section')).toBeVisible();
		await expect(page.locator('#or-divider')).toBeVisible();
		await expect(page.locator('#show-email-setup-btn')).toBeHidden(); // This will pass now
		await expect(page.locator('#email-auth-title')).toHaveText('Create Account with Username');
		await expect(page.locator('#email-sign-up-btn')).toBeVisible();
		await expect(page.locator('#email-sign-in-btn')).toBeHidden();
	});

	//
	// --- THIS TEST ALSO NEEDS THE FIX ---
	//
	test('should toggle from sign-up to sign-in mode', async ({ page }) => {
		// 1. ARRANGE: Go to the page
		await page.goto('/setup/?id=test-box-123');

		// 2. WAIT AND ACT 1 (THE FIX)
		// Wait for the auth container to be ready
		await expect(page.locator('#auth-container')).toBeVisible();
		// Click the first button
		await page.locator('#show-email-setup-btn').click();

		// 3. ACT 2: Click the toggle button
		// We also wait for the email section to be visible before clicking inside it
		await expect(page.locator('#email-auth-section')).toBeVisible();
		await page.locator('#toggle-sign-up-btn').click();

		// 4. ASSERT: Check that the form is now in "Sign In" mode
		await expect(page.locator('#email-auth-title')).toHaveText('Sign In with Username');
		await expect(page.locator('#email-sign-up-btn')).toBeHidden();
		await expect(page.locator('#email-sign-in-btn')).toBeVisible();
		await expect(page.locator('#password-hint')).toBeHidden();
	});

});

test.describe('Setup Page: Authenticated User', () => {

	test('should allow a new user to create an account and see the form', async ({ page }) => {

		// --- 1. ARRANGE & ACT: Go through the sign-up flow ---

		// Generate a unique email for every test run
		const uniqueEmail = `test-user-${Date.now()}`;
		const password = 'Password123!';

		// Go to the page
		await page.goto('/setup/?id=test-box-123');

		// Wait for the auth form to be ready (our best practice!)
		await expect(page.locator('#auth-container')).toBeVisible();

		// Navigate to the email form
		await page.locator('#show-email-setup-btn').click();
		await expect(page.locator('#email-auth-section')).toBeVisible();

		// Fill out the sign-up form
		await page.locator('#auth-email').fill(uniqueEmail);
		await page.locator('#auth-password').fill(password);

		// Click the "Create Account" button
		await page.locator('#email-sign-up-btn').click();


		// --- 2. ASSERT: Check that the login was successful ---

		// The most important check: wait for the *main form* to appear.
		// We give it a longer timeout, as creating a user can take a second.
		await expect(page.locator('#new-location-form')).toBeVisible({ timeout: 10000 });

		// Now, verify the rest of the page state
		await expect(page.locator('#auth-container')).toBeHidden();
		await expect(page.locator('#user-display')).toContainText(`Signed in as: ${uniqueEmail}`);
		await expect(page.locator('#sign-out-btn')).toBeVisible();
	});
});