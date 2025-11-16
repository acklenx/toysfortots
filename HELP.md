# Test Discovery Issue - E2E Tests Not Found

## Symptom
When running `npx playwright test tests/e2e/e2e-full-journey.spec.js`, Playwright reports:
```
Error: No tests found.
Make sure that arguments are regular expressions matching test files.
```

## Root Cause
The `e2e-full-journey.spec.js` file was missing from the `testMatch` array in `playwright.config.js`.

## Why This Happened
The line `'**/e2e-full-journey.spec.js'` was added locally but never committed. When doing `git reset --hard`, this uncommitted change was removed, causing tests to become undiscoverable.

## The Fix
Add `'**/e2e-full-journey.spec.js'` to the testMatch array in `playwright.config.js`:

```javascript
testMatch: [
  '**/dashboard.spec.js',
  '**/setup.spec.js',
  '**/box-and-status.spec.js',
  '**/home.spec.js',
  '**/login.spec.js',
  '**/authorize.spec.js',
  '**/user-journeys.spec.js',
  '**/admin.spec.js',
  '**/e2e-full-journey.spec.js'  // <-- MUST BE HERE
],
```

## Lesson Learned
Always commit configuration changes like testMatch patterns. Uncommitted config changes can make tests "magically" disappear when switching commits.
