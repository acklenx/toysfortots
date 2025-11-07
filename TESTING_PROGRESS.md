# Testing Progress

## Current Status (as of Nov 7, 2025)

### Test Suite Results

**Smoke Tests (12 critical tests, 4 workers):**
- ✅ **12/12 tests passing (100%)**
- Runs in ~8 seconds
- Fast, reliable coverage of critical paths

**Full Test Suite (4 workers with smart retry):**
- Status to be determined after next run
- Uses 3-tier retry strategy for reliability

### Major Changes (Nov 7, 2025)

#### 1. Authorization Flow Restructure
**Change**: Moved passcode entry from setup page to dedicated authorize page
**Impact**: Cleaner separation of concerns, better security model

**Setup Page Changes:**
- ✅ Removed passcode input field
- ✅ Added authentication check (redirect to login if not authenticated)
- ✅ Added authorization check (redirect to authorize if not authorized)
- ✅ Changed theme from red to green (background, border, buttons)
- ✅ Removed redundant user display and sign-out button
- ✅ Simplified UI - authorization happens once on authorize page

**Status Page Changes:**
- ✅ Added authentication/authorization check
- ✅ Redirects unauthorized users to box page (public reporting)
- ✅ Only authenticated, authorized volunteers can view full status history

**Authorization Flow:**
```
New User → Login → Create Account → Authorize (enter passcode) → Setup/Dashboard
Returning User → Login → Dashboard (if authorized) OR Authorize (if not)
```

#### 2. Smoke Test Suite
**Created**: Fast, reliable test suite for continuous validation
- 12 critical tests covering all major flows
- Runs in parallel with 4 workers (~8 seconds)
- Tests selected for reliability (no Firebase data race conditions)

**Tests Included:**
- Authorization: Code input field display
- Box/Status: Redirects, error handling
- Dashboard: Auth redirects
- Home: Page load, anonymous auth
- Login: Form display, error validation
- Setup: Auth/authorization redirects, box ID display

**Tests Excluded from Smoke:**
- Tests with Firebase write → immediate read (data race conditions)
- Tests requiring complex data setup

#### 3. Sticky Footer Fix
**Problem**: Footer sliding up on pages with little content (dashboard with no boxes)
**Fix**: Added `.page-container` wrapper with `flex: 1` to all pages
**Pages Fixed**: Dashboard, authorize, box, login, status

#### 4. UI/UX Improvements
- ✅ Status page: Changed "Cleared" to "Resolved" (with variable for easy changes)
- ✅ Status page: Green background for resolved alerts, red for problems
- ✅ Dashboard: Red "Mark as Resolved" button (60% width, centered)
- ✅ Homepage/Map: Removed contact name/phone, added city/state
- ✅ Hamburger menu: Hidden for anonymous/non-authenticated users
- ✅ Footer: Username display below gunny bear, red text, hidden for anonymous

### Test Updates

#### Setup Page Tests
**Major Refactor**: All tests updated for new authorization flow

**Helper Function Added:**
```javascript
async function createAuthorizedUser(page) {
  // Creates user, waits for auth, authorizes them
  // Returns { username, password, uid }
}
```

**Tests Removed:**
- Passcode field visibility tests (no longer applicable)
- Passcode toggle tests (no longer applicable)
- Sign-out button test (removed from page)
- User display test (removed from page)

**Tests Added:**
- Redirect to authorize page for unauthorized users
- Redirect to login for unauthenticated users

**Tests Updated:**
- All tests now use `createAuthorizedUser()` helper
- Proper auth waiting before navigation

#### Box and Status Tests
**Updated**: Redirect expectations changed for new auth requirements
- Nonexistent box → setup → login (was: direct to setup)
- Status page for anonymous users → redirect chain → login

### Files Modified This Session

1. **public/setup/index.html** - Removed passcode, added auth checks
2. **public/status/index.html** - Added auth/authorization checks
3. **public/dashboard/index.html** - Added page-container wrapper
4. **public/authorize/index.html** - Added page-container wrapper
5. **public/box/index.html** - Added page-container wrapper
6. **public/login/index.html** - Added page-container wrapper
7. **public/css/style.css** - Added .page-container class, various UI fixes
8. **tests/e2e/setup.spec.js** - Major refactor for new auth flow
9. **tests/e2e/box-and-status.spec.js** - Updated redirect expectations, removed @smoke from flaky tests
10. **tests/e2e/dashboard.spec.js** - Removed @smoke from flaky test
11. **playwright.smoke.config.js** - Created smoke test configuration

### Smoke Test Configuration

```javascript
{
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 4,
  retries: 1,
  timeout: 15000,
  grep: /@smoke/
}
```

**Performance**: 12 tests in ~8 seconds with 4 workers

### Key Learnings

1. **Separate authentication from authorization**: Login/signup on one page, passcode entry on another
2. **Smoke tests need careful selection**: Avoid tests with Firebase data race conditions
3. **Use CSS variables for text**: Easy to change terminology (e.g., "Cleared" → "Resolved")
4. **Sticky footer requires flex container**: Use `.page-container` with `flex: 1`
5. **Test helpers reduce duplication**: `createAuthorizedUser()` simplified all setup tests
6. **Wait for auth before navigation**: Prevents race conditions in redirect tests

### Known Issues

- Pre-commit hook runs full test suite (should use smoke tests or smart tests)
- Need to verify full test suite still passes with new authorization flow
