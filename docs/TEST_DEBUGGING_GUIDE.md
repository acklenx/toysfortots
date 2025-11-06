# Test Debugging Guide: Finding and Fixing Flaky Tests

## Overview

This guide provides a systematic approach to diagnosing and fixing flaky tests. Use this when tests start failing intermittently.

---

## Phase 1: Identify the Scope of Flakiness

### Step 1: Run Tests Multiple Times

**Single test (3x):**
```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test -g "test name pattern"
done
```

**Full suite (3x):**
```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test --workers=4
done | tee test-results.log
```

**Analyze results:**
- ✅ **3/3 passes**: Not flaky, likely fixed or environment issue
- ⚠️ **1-2/3 fails**: Flaky test
- ❌ **3/3 fails**: Consistently failing (real bug, easier to fix)

---

### Step 2: Test with Different Worker Counts

**1 worker (sequential):**
```bash
npx playwright test --workers=1
```

**2 workers:**
```bash
npx playwright test --workers=2
```

**4 workers (parallel):**
```bash
npx playwright test --workers=4
```

**Diagnosis:**
- ✅ **Passes with 1 worker, fails with 4**: Parallel execution issue (data isolation, contention)
- ❌ **Fails even with 1 worker**: Real bug in test or code (not flakiness)
- ⚠️ **Passes sometimes with any worker count**: True flakiness (timing, race conditions)

---

### Step 3: Enable Flakiness Tracking

Use the built-in flakiness tracker:

```javascript
// In playwright.config.js
reporter: [
  ['list'],
  ['./flakiness-reporter.js'] // Tracks failures
]
```

**Check stats:**
```bash
cat test-flakiness-stats.json | jq '.[] | select(.totalFailures > 0)'
```

**Generate report:**
```bash
node -e "
const tracker = require('./test-flakiness-tracker.js');
tracker.generateReport();
"
```

---

## Phase 2: Categorize the Failure Type

### Failure Category 1: Data Race / Isolation Issue

**Symptoms:**
- Fails with 4 workers, passes with 1 worker
- Error: "Expected element not found"
- Error: "Expected X items, got Y"

**Example:**
```
Error: Expected 2 boxes, found 5
```

**Likely Cause:** Test is seeing data from other parallel workers.

**Diagnosis Steps:**
1. Check if test uses hardcoded IDs (e.g., 'BOX001', 'testuser')
2. Check if test clears data in beforeEach
3. Check if test counts global data without scoping

**Fixes:**
- Use unique test IDs: `generateBoxId()`, `generateUsername()`
- Remove `clearTestData()` from beforeEach
- Scope queries to test's data: `getReports({ boxId: myBoxId })`

---

### Failure Category 2: Loading State / Timing Issue

**Symptoms:**
- Element stuck showing "Loading..."
- Error: "Expected 'Data', found 'Loading...'"
- Error: "Element not visible" but it exists

**Example:**
```
Expected: "Box Statuses"
Received: "Loading..."
```

**Likely Cause:** Test asserts before page finishes loading data.

**Diagnosis Steps:**
1. Check if test waits for loading to complete
2. Check if code updates all loading indicators
3. Check if test uses hardcoded `waitForTimeout()`

**Fixes:**

**In test (add proper waits):**
```javascript
// Wait for loading to complete
await expect(page.locator('#title')).not.toContainText('Loading...');

// Or wait for specific element
await page.waitForSelector('.data-loaded-class');
```

**In code (fix loading states):**
```javascript
// BEFORE
if (data.empty) {
  container.innerHTML = 'No data';
  return; // Forgot to update title!
}

// AFTER
if (data.empty) {
  title.textContent = 'Data'; // Update title
  container.innerHTML = 'No data';
  return;
}
```

---

### Failure Category 3: Data Not Committed

**Symptoms:**
- Fails immediately after creating data
- Error: "Location not found" right after creating it
- Works after adding `waitForTimeout(1000)`

**Example:**
```javascript
await createTestLocation(boxId, { label: 'Test' });
await page.goto(`/box?id=${boxId}`);
// Error: Box not found
```

**Likely Cause:** Firebase emulator hasn't committed write yet.

**Diagnosis Steps:**
1. Check if `createTestLocation()` verifies write
2. Check emulator logs for timing
3. Try adding read-after-write verification

**Fix:**
```javascript
async function createTestLocation(boxId, data) {
  const ref = firestore.doc(`${LOCATIONS_PATH}/${boxId}`);
  await ref.set(data);

  // ADD THIS: Verify write committed
  const verifyDoc = await ref.get();
  if (!verifyDoc.exists) {
    throw new Error(`Failed to verify location ${boxId} was created`);
  }

  return data;
}
```

---

### Failure Category 4: Auth State Synchronization

**Symptoms:**
- User created but not authenticated
- Error: "net::ERR_ABORTED" on page load
- Redirect to login when should be logged in

**Example:**
```
Error: page.goto: net::ERR_ABORTED at http://localhost:5000/dashboard/
```

**Likely Cause:** Auth state not synced across Firebase client SDK.

**Diagnosis Steps:**
1. Check if test waits for auth state
2. Check if authorization step completed
3. Check browser auth state vs emulator state

**Fix:**
```javascript
// Create user
await page.fill('#auth-email', username);
await page.locator('#email-sign-up-btn').click();

// WAIT for auth to complete
await page.waitForFunction(() => window.auth?.currentUser !== null, {
  timeout: 10000
});

// Get UID and authorize
const userRecord = await page.evaluate(() => ({
  uid: window.auth.currentUser.uid,
  email: window.auth.currentUser.email
}));
await authorizeVolunteer(userRecord.uid, userRecord.email, username);

// NOW safe to navigate
await page.goto('/dashboard/');
```

---

### Failure Category 5: Assertion Mismatch

**Symptoms:**
- Expected value doesn't match received
- Works manually, fails in test
- Error: "Expected 'testuser_W1_12345', received 'testuser'"

**Example:**
```
Expected substring: "testuser_W1_1762436705984_42_9876"
Received: "testuser"
```

**Likely Cause:** UI displays shortened version of generated data.

**Fix:**
```javascript
// DON'T assert on full generated ID
const username = generateUsername('testuser');
await expect(page).toContainText(username); // ❌

// DO assert on base name
const baseName = username.split('_')[0];
await expect(page).toContainText(baseName); // ✅
```

---

## Phase 3: Systematic Debugging Process

### Step 1: Isolate the Test

Run ONLY the failing test:
```bash
npx playwright test -g "exact test name"
```

If it passes in isolation but fails in suite → data isolation issue.

---

### Step 2: Check Test Data Flow

Add logging to trace data:
```javascript
test('my test', async () => {
  const boxId = generateBoxId('BOX');
  console.log('Created boxId:', boxId);

  await createTestLocation(boxId, { label: 'Test' });
  console.log('Location created');

  await page.goto(`/box?id=${boxId}`);
  console.log('Navigated to box page');

  // Check what the page actually shows
  const content = await page.locator('#location-display').textContent();
  console.log('Page content:', content);

  await expect(page.locator('#location-display')).toContainText('Test');
});
```

Run with output:
```bash
npx playwright test -g "my test" --reporter=line
```

---

### Step 3: Check Firebase Emulator Data

**Query emulator directly:**
```javascript
import { initializeFirebaseAdmin } from '../fixtures/firebase-helpers.js';

const firestore = initializeFirebaseAdmin();
const snapshot = await firestore.collection(LOCATIONS_PATH).get();
console.log('Total locations:', snapshot.size);
snapshot.forEach(doc => {
  console.log('Location:', doc.id, doc.data());
});
```

**Check for:**
- Data from other tests (indicates no isolation)
- Missing data (indicates write didn't commit)
- Wrong data (indicates test logic error)

---

### Step 4: Run with Playwright UI

Visual debugging:
```bash
npx playwright test --ui -g "test name"
```

**Watch for:**
- When elements appear/disappear
- What text is actually rendered
- Network requests timing
- Console errors

---

### Step 5: Check Screenshots and Videos

Failed tests automatically capture:
```
test-results/
  test-name-chromium/
    test-failed-1.png      ← What page looked like
    video.webm             ← Full test recording
    error-context.md       ← Error details
```

**Look for:**
- Is page still loading?
- Is data actually rendered?
- Is user logged in?
- Any error messages visible?

---

## Phase 4: Common Fix Patterns

### Fix Pattern 1: Make IDs Unique

**Find:**
```bash
grep -r "BOX0\|USER0\|testuser" tests/e2e/
```

**Replace:**
```javascript
// BEFORE
const boxId = 'BOX001';
const username = `testuser${Date.now()}`;

// AFTER
const boxId = generateBoxId('BOX');
const username = generateUsername('testuser');
```

---

### Fix Pattern 2: Remove Cross-Worker Data Clearing

**Find:**
```bash
grep -r "clearTestData" tests/e2e/
```

**Fix:**
```javascript
// BEFORE
test.beforeEach(async () => {
  await clearTestData(); // ❌ Wipes other workers' data
});

// AFTER
test.beforeEach(async () => {
  // No clearTestData() - unique IDs prevent collisions
  await seedTestConfig('passcode');
});
```

---

### Fix Pattern 3: Add Data Load Waits

**Find tests without waits:**
```bash
grep -A5 "page.goto" tests/e2e/ | grep -v "waitFor"
```

**Add waits:**
```javascript
// AFTER navigation
await page.goto('/dashboard');

// ADD THIS
await expect(page.locator('#loading-indicator')).not.toBeVisible();
// or
await page.waitForFunction(() => !document.querySelector('#loading'));
```

---

### Fix Pattern 4: Fix Loading States in Code

**Find "Loading..." that never updates:**
```bash
grep -r "Loading\.\.\." public/
```

**Check each:**
```javascript
// Does every code path update the loading state?
if (data.empty) {
  loadingMessage.remove(); // ✅ Good
  title.textContent = 'Data'; // ✅ Good
  return;
}
```

---

## Phase 5: Validate the Fix

### Validation Checklist

After fixing, test thoroughly:

1. **Single test 10x:**
   ```bash
   for i in {1..10}; do npx playwright test -g "test name"; done
   ```
   Should pass 10/10 times.

2. **Full suite 3x with 1 worker:**
   ```bash
   for i in 1 2 3; do npx playwright test --workers=1; done
   ```
   Should pass 100% each time.

3. **Full suite 3x with 4 workers:**
   ```bash
   for i in 1 2 3; do npx playwright test --workers=4; done
   ```
   Should pass ≥90% each time.

4. **Check flakiness stats:**
   ```bash
   node -e "require('./test-flakiness-tracker.js').generateReport()"
   ```
   Fixed test should have 0 new failures.

---

## Decision Tree: What to Fix

```
Test fails?
├─ Fails with 1 worker?
│  ├─ YES → Real bug in test or code
│  │  ├─ Check test logic
│  │  ├─ Check code logic
│  │  └─ Fix and verify with 1 worker first
│  └─ NO → Continue to next question
│
├─ Fails with 4 workers but not 1?
│  ├─ YES → Parallel execution issue
│  │  ├─ Check for hardcoded IDs
│  │  ├─ Check for clearTestData() in beforeEach
│  │  ├─ Check for global data queries/counts
│  │  └─ Make data unique and isolated
│  └─ NO → Continue to next question
│
├─ Shows "Loading..." in error?
│  ├─ YES → Loading state issue
│  │  ├─ Add waits in test
│  │  └─ Fix loading indicators in code
│  └─ NO → Continue to next question
│
├─ Says "element not found" immediately after creating data?
│  ├─ YES → Data commitment issue
│  │  └─ Add read-after-write verification
│  └─ NO → Continue to next question
│
└─ Random "net::ERR_ABORTED" errors?
   └─ YES → Auth state sync issue
      └─ Add waitForFunction for auth.currentUser
```

---

## Tracking Fixes

Document each fix:

```markdown
## Test: "should display volunteer name"

**Issue**: Failed 7/10 runs with 4 workers
**Symptom**: Expected "testuser_W1_12345...", got "testuser"
**Root Cause**: UI displays only base username, test expected full generated ID
**Fix**: Changed assertion to check base username: `username.split('_')[0]`
**Validation**: 10/10 passes after fix
**Eradicated**: 2025-11-06
```

Keep track in `test-flakiness.log` or `FLAKINESS_FIXES.md`.

---

## Prevention Checklist

Before merging new tests:

- [ ] Test passes 10x in isolation
- [ ] Test passes 3x with full suite (1 worker)
- [ ] Test passes 3x with full suite (4 workers)
- [ ] No hardcoded IDs used
- [ ] No clearTestData() in beforeEach
- [ ] Proper waits for loading states
- [ ] Assertions match actual UI output
- [ ] No dependencies on other tests

---

## Tools Reference

### Run specific test:
```bash
npx playwright test -g "test name pattern"
```

### Run with UI:
```bash
npx playwright test --ui
```

### Run with debug:
```bash
npx playwright test --debug -g "test name"
```

### View last report:
```bash
npx playwright show-report
```

### Check flakiness stats:
```bash
cat test-flakiness-stats.json | jq
```

### Clear flakiness tracking:
```bash
rm test-flakiness-stats.json test-flakiness.log
```

---

## Summary

Systematic approach to fixing flaky tests:

1. **Identify scope**: Single test or pattern? 1 worker or 4?
2. **Categorize**: Data race? Loading? Auth? Assertion mismatch?
3. **Debug**: Isolate, log, inspect data, use UI
4. **Fix**: Apply pattern-specific solution
5. **Validate**: Test 10x, check stats, verify fix holds

Most flakiness comes from:
- ❌ Hardcoded IDs (use generators)
- ❌ Clearing data in beforeEach (use global setup)
- ❌ Not waiting for loading (add proper waits)
- ❌ Asserting on exact generated IDs (use base names)

Fix these and 95% of flakiness disappears!
