# Test Writing Guide: Avoiding Flakiness from the Start

## Overview

This guide documents lessons learned from obliterating test flakiness in this project. Follow these principles to write reliable tests that work in parallel from day one.

---

## Golden Rules for Reliable Tests

### 1. **Use Unique Test Data for Every Test**

❌ **BAD - Hardcoded IDs:**
```javascript
await createTestLocation('BOX001', { label: 'Test' });
await page.goto('/box?id=BOX001');
```

✅ **GOOD - Generated Unique IDs:**
```javascript
const boxId = generateBoxId('BOX');
await createTestLocation(boxId, { label: 'Test' });
await page.goto(`/box?id=${boxId}`);
```

**Why**: Hardcoded IDs cause collisions when tests run in parallel. Worker 1 creates BOX001, Worker 2 creates BOX001 and overwrites it.

**Implementation**: Use `tests/fixtures/test-id-generator.js`:
```javascript
import { generateUsername, generateBoxId } from '../fixtures/test-id-generator.js';

const username = generateUsername('testuser'); // testuser_W1_12345_1_9876
const boxId = generateBoxId('BOX');            // BOX_W2_12345_2_5432
```

---

### 2. **Never Clear All Data in beforeEach**

❌ **BAD - Wipes parallel workers' data:**
```javascript
test.beforeEach(async () => {
  await clearTestData(); // DANGER: Deletes other workers' data!
  await seedTestConfig('passcode');
});
```

✅ **GOOD - Use global setup once:**
```javascript
// In playwright.config.js
export default defineConfig({
  globalSetup: './tests/global-setup.js',
  globalTeardown: './tests/global-teardown.js',
});

// In test files
test.beforeEach(async () => {
  // NO clearTestData() here!
  await seedTestConfig('passcode'); // Shared config is fine
});
```

**Why**: With parallel workers, clearing data in beforeEach means Worker 1 can delete Worker 2's test data mid-test, causing random failures.

**Solution**:
- Use global setup/teardown for one-time cleanup
- Rely on unique IDs to prevent collisions
- Each test's data is isolated by its unique IDs

---

### 3. **Verify Data Commitment After Writes**

❌ **BAD - Assumes write succeeded:**
```javascript
await firestore.doc(path).set(data);
return data; // Hope it's committed!
```

✅ **GOOD - Verify write committed:**
```javascript
const ref = firestore.doc(path);
await ref.set(data);

// Verify write by reading it back
const verifyDoc = await ref.get();
if (!verifyDoc.exists) {
  throw new Error('Write failed to commit');
}
return data;
```

**Why**: Firebase emulator (and real Firestore) may accept writes but take milliseconds to commit. Reading immediately after might return nothing.

**Implementation**: Already done in `tests/fixtures/firebase-helpers.js`:
- `createTestLocation()` - verifies location exists
- `createTestReport()` - verifies report exists
- `seedTestConfig()` - verifies config exists
- `authorizeVolunteer()` - verifies volunteer doc exists

---

### 4. **Don't Assert on Exact Long Unique IDs**

❌ **BAD - Expects full generated ID:**
```javascript
const username = generateUsername('testuser');
// username = "testuser_W1_1762436705984_42_9876"

await expect(page.locator('#username')).toContainText(username);
// Fails if UI truncates or shows only base name
```

✅ **GOOD - Assert on base name:**
```javascript
const username = generateUsername('testuser');
const baseName = username.split('_')[0]; // "testuser"

await expect(page.locator('#username')).toContainText(baseName);
```

**Why**: Unique IDs are very long (40+ characters). UIs often show only part of them. Test the intent, not the exact format.

---

### 5. **Wait for Data Loading, Don't Assume**

❌ **BAD - Asserts immediately:**
```javascript
await page.goto('/dashboard');
await expect(page.locator('.box-card')).toHaveCount(3);
// Might fail if data hasn't loaded yet
```

✅ **GOOD - Wait for loading to complete:**
```javascript
await page.goto('/dashboard');

// Wait for loading indicator to disappear
await expect(page.locator('#boxes-title')).not.toContainText('Loading...');

// Now assert on data
await expect(page.locator('.box-card')).toHaveCount(3);
```

**Why**: Pages load data asynchronously from Firestore. Need to wait for completion before asserting.

---

### 6. **Fix "Loading..." States in Code**

❌ **BAD - Forgets to update loading state:**
```javascript
const data = await fetchData();
if (data.length === 0) {
  container.innerHTML = 'No data';
  return; // Forgot to update title!
}
// Title still says "Loading..."
```

✅ **GOOD - Always update all loading states:**
```javascript
const data = await fetchData();
loadingIndicator.remove();

if (data.length === 0) {
  title.textContent = 'Data'; // Update title
  container.innerHTML = 'No data';
  return;
}
```

**Why**: Tests that assert on page state will fail if any loading indicators remain visible.

**Example Fix**: `public/dashboard/index.html:202`
```javascript
if (locationsSnapshot.empty) {
  document.getElementById('boxes-title').textContent = 'Box Statuses'; // Added
  boxesContainer.innerHTML = '<p>No reports...</p>';
  return;
}
```

---

### 7. **Use Proper Playwright Waits**

❌ **BAD - Hardcoded timeouts:**
```javascript
await page.waitForTimeout(2000); // Brittle, slow
```

✅ **GOOD - Wait for actual conditions:**
```javascript
// Wait for element to exist
await page.waitForSelector('#element');

// Wait for function to return true
await page.waitForFunction(() => window.dataLoaded === true);

// Wait for URL change
await page.waitForURL(/\/dashboard/);

// Wait for network idle
await page.waitForLoadState('networkidle');
```

**Why**: Hardcoded timeouts are unreliable (too short = flaky, too long = slow). Condition-based waits are faster and more reliable.

---

### 8. **Test Order Should Not Matter**

❌ **BAD - Tests depend on previous tests:**
```javascript
test('creates user', async () => {
  await createUser('alice');
});

test('logs in user', async () => {
  await login('alice'); // Depends on previous test!
});
```

✅ **GOOD - Each test is independent:**
```javascript
test('creates user', async () => {
  const username = generateUsername('alice');
  await createUser(username);
});

test('logs in user', async () => {
  const username = generateUsername('alice');
  await createUser(username); // Create own data
  await login(username);
});
```

**Why**: Tests may run in any order or in parallel. Dependencies cause failures.

---

### 9. **Shared Config is OK, Shared Data is Not**

✅ **GOOD - Shared global config:**
```javascript
await seedTestConfig('sharedPasscode'); // Same for all tests
```

❌ **BAD - Shared test data:**
```javascript
await createTestLocation('SHARED_BOX'); // Conflict!
```

**Why**: Config values (passcodes, API keys) can be shared. Mutable test data (users, locations, reports) must be unique per test.

---

### 10. **Count-Based Assertions Need Isolation**

❌ **BAD - Counts can include other workers' data:**
```javascript
await createTestReport(boxId, { status: 'new' });

// Query ALL reports with status 'new'
const allNew = await getReports({ status: 'new' });
await expect(allNew).toHaveLength(1); // Fails if other workers have reports!
```

✅ **GOOD - Count only your test's data:**
```javascript
await createTestReport(boxId, { status: 'new' });

// Query reports for YOUR box only
const myReports = await getReports({ boxId: boxId, status: 'new' });
await expect(myReports).toHaveLength(1); // Safe!
```

**Why**: With parallel workers, global queries return data from all workers. Always scope queries to your test's unique data.

---

## Test Organization Best Practices

### File Structure
```
tests/
├── fixtures/
│   ├── firebase-helpers.js     # Data setup/teardown
│   ├── auth.js                 # Auth utilities
│   └── test-id-generator.js    # Unique ID generation
├── global-setup.js             # One-time setup before all tests
├── global-teardown.js          # One-time cleanup after all tests
└── e2e/
    ├── login.spec.js           # Lightweight tests first
    ├── home.spec.js
    ├── box-and-status.spec.js
    ├── setup.spec.js
    └── dashboard.spec.js       # Heavy tests last
```

### Test Execution Order

Configure test order in `playwright.config.js` to reduce contention:
```javascript
testMatch: [
  '**/login.spec.js',      // Lightweight, auth only
  '**/home.spec.js',       // Minimal data
  '**/box-and-status.spec.js',  // Medium data load
  '**/setup.spec.js',      // Medium data load
  '**/dashboard.spec.js'   // Heavy data operations
]
```

**Why**: Spreading heavy tests across the test run reduces Firebase emulator contention.

---

## Quick Reference Checklist

Before writing a new test, check:

- [ ] Uses `generateUsername()` or `generateBoxId()` for all data
- [ ] Does NOT call `clearTestData()` in beforeEach
- [ ] Verifies data exists after creating it (if critical)
- [ ] Waits for loading states to complete before asserting
- [ ] Does not depend on other tests
- [ ] Scopes queries to test's own data (not global counts)
- [ ] Uses proper Playwright waits (not hardcoded timeouts)
- [ ] Updates all loading indicators in code when data loads

---

## Example: Perfect Test Template

```javascript
import { test, expect } from '@playwright/test';
import { generateUsername, generateBoxId } from '../fixtures/test-id-generator.js';
import { seedTestConfig, createTestLocation } from '../fixtures/firebase-helpers.js';

test.describe('My Feature', () => {
  test.beforeEach(async () => {
    // Global config is fine
    await seedTestConfig('testpasscode');
  });

  test('should do something', async ({ page }) => {
    // 1. Generate unique data
    const username = generateUsername('testuser');
    const boxId = generateBoxId('BOX');

    // 2. Create test data
    await createTestLocation(boxId, { label: 'Test Store' });

    // 3. Perform user actions
    await page.goto(`/box?id=${boxId}`);

    // 4. Wait for loading to complete
    await expect(page.locator('#loading-message')).not.toBeVisible();

    // 5. Assert on results (using base names if needed)
    await expect(page.locator('#location-display')).toContainText('Test Store');
  });
});
```

---

## Common Patterns to Avoid

### Pattern: Timestamp-Only Unique IDs
```javascript
❌ const username = `user_${Date.now()}`; // Can collide in parallel
✅ const username = generateUsername('user'); // Guaranteed unique
```

### Pattern: Expecting Exact Generated Values in UI
```javascript
❌ await expect(element).toContainText(fullGeneratedUsername);
✅ await expect(element).toContainText(baseUsername);
```

### Pattern: Global Data Cleanup Between Tests
```javascript
❌ test.afterEach(async () => await clearTestData()); // Risky
✅ // Let global teardown handle it once at the end
```

### Pattern: Reusing the Same Box/User Across Tests
```javascript
❌ const SHARED_BOX = 'BOX001'; // Don't share!
✅ const boxId = generateBoxId('BOX'); // Unique each time
```

---

## Summary

The key to flake-free tests:
1. **Unique data** per test (use generators)
2. **No shared mutable state** between tests
3. **Verify data exists** after writes
4. **Wait for loading** before asserting
5. **Test independently** (no order dependencies)

Follow these rules and your tests will work reliably in parallel from day one!
