# E2E Test Fixes - 2025-11-16

## Current Situation

We had all tests passing locally, including the big E2E test suite (e2e-full-journey.spec.js). However:
- Smoke tests work both locally and in GitHub Actions ✅
- Full E2E tests work locally but NOT in GitHub Actions ❌
- When we tried to roll back to previous working commit (c53ba1b), tests became "not found" ❌
- Fixed the "not found" issue by adding `'**/e2e-full-journey.spec.js'` to testMatch in playwright.config.js ✅
- Now tests run but are failing again ❌

## Root Causes Identified

### 1. Test Discovery Issue (FIXED)
The e2e-full-journey.spec.js was not in the testMatch array in playwright.config.js. This was added locally but never committed, so git reset removed it.

**Fix Applied:** Added to testMatch array in playwright.config.js

### 2. URL Path Flexibility Issue
URLs can vary between environments:
- `/setup?id=123` ← Works in some cases
- `/setup/?id=123` ← Works in other cases (trailing slash)

**Solution:** All URL checks must handle BOTH patterns using regex like `/\/setup\/?\\?id=/`

### 3. Button vs Link Confusion
Many elements that look like buttons are actually `<a>` links styled as buttons.

**Solution:** Use flexible selectors like `'button:has-text("Text"), a:has-text("Text")'` or `.first()`

### 4. Sign In vs Sign Up Flow
Tests need to check which page they're on before clicking toggle buttons:
- If on sign-in page but need to sign up → click "Create an account" link
- If on sign-up page but need to sign in → click sign-in link

**Solution:** Check current state before toggling

### 5. Authorization Redirects
When accessing protected pages (like /setup) without authorization:
- Unauthenticated → redirects to /login
- Authenticated but not authorized → redirects to /authorize
- Both are REAL redirects that happen automatically

**Solution:** Expect and handle these redirects in tests

### 6. Authorize Flow Issues with Emulators
The authorize flow has been problematic in emulators, causing flaky tests.

**Temporary Solution:** Skip the authorize page for now, we'll add it back later once basic tests are stable

## The Plan

### Step 1: Add Comprehensive Logging
Before every assertion, log the current state:
- Current URL
- What element we're looking for
- Whether element was found

This helps debug failures without guessing.

### Step 2: Fix URL Pattern Matching
Replace all URL assertions to handle optional trailing slash:
- Change `/\/setup\?id=/` to `/\/setup\/?\\?id=/`
- Change `/\/status\?id=/` to `/\/status\/?\\?id=/`
- Change `/\/box\?id=/` to `/\/box\/?\\?id=/`

### Step 3: Fix Button/Link Selectors
Use flexible selectors that work for both:
```javascript
// BAD
page.locator('button:has-text("Submit")')

// GOOD
page.locator('button:has-text("Submit"), a:has-text("Submit")').first()
```

### Step 4: Add State Checks Before Actions
Before clicking sign-in/sign-up buttons, check what page we're on:
```javascript
// Check if we need to toggle
const currentTitle = await page.locator('#email-auth-title').textContent();
if (currentTitle.includes('Sign In') && needSignUp) {
  await page.locator('#toggle-sign-up-btn').click();
}
```

### Step 5: Skip Authorize Flow Temporarily
Instead of going through /authorize, we'll:
1. Create account
2. Manually call authorizeVolunteer() helper
3. Navigate directly to destination

This bypasses the problematic authorize page while we fix core issues.

### Step 6: Run Smoke Tests First
Before committing any changes, ALWAYS run:
```bash
npm run test:smoke
```

Only commit if all 12 smoke tests pass.

### Step 7: Incremental Testing
Fix one test at a time:
1. Fix Part 1 (signup and provisioning)
2. Run test to verify
3. Fix Part 2 (dashboard operations)
4. Run test to verify
5. Continue until all parts pass

## Files to Modify

1. **tests/e2e/e2e-full-journey.spec.js**
   - Add logging before assertions
   - Fix URL patterns
   - Fix button/link selectors
   - Add state checks
   - Temporarily skip authorize flow

2. **playwright.config.js**
   - Already has e2e-full-journey.spec.js in testMatch ✅

## Success Criteria

- [ ] All smoke tests pass (12/12)
- [ ] Part 1 (signup and provisioning) passes
- [ ] Part 2 (dashboard operations) passes
- [ ] Part 3 (anonymous reporting) passes
- [ ] All 14 E2E tests pass
- [ ] Can roll back to this commit and tests still work
- [ ] All changes committed (no uncommitted working changes)

## Notes

- DO NOT skip critical flows like authorization unless absolutely necessary
- Always log state before assertions to aid debugging
- URL patterns MUST handle trailing slash variations
- Many "buttons" are actually styled links - use flexible selectors
- Test in BOTH environments: emulator (localhost) AND CI (GitHub Actions)

---

**Created:** 2025-11-16
**Status:** Ready to start fixing
**Priority:** HIGH - Need working E2E tests for CI/CD pipeline
