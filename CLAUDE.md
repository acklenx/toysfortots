# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Firebase-based web application for tracking Toys for Tots donation boxes. Marines use QR codes to provision boxes at business locations, and the public can scan codes to report when boxes need pickup. The system manages location data, status reports, and volunteer authorization.

## Development Commands

### Testing
```bash
# Start Firebase emulators (required before running tests)
./start-emulators.sh
# OR manually:
npx firebase emulators:start --only hosting,auth,firestore,functions

# Recommended: Smart test runner with 3-tier retry strategy
npm run test:smart
# Or directly:
./run-tests-smart.sh

# Standard test commands (use these for quick iteration, NOT for full test runs)
# NOTE: Running the full test suite with npx playwright test is SLOW and prone to
# failures due to Firebase emulator contention. Use test:smart for full test runs.
npx playwright test tests/e2e/dashboard.spec.js  # Run specific file
npx playwright test -g "should display dashboard" # Run single test
npx playwright test --workers=1                  # Run with 1 worker (most stable, slower)
npx playwright test --ui                         # Run with UI
npx playwright show-report                       # View test report
```

**Smart Test Runner:** The `run-tests-smart.sh` script provides:
- **Tier 1:** Fast parallel execution (4 workers)
- **Tier 2:** Automatic retry for transient failures
- **Tier 3:** Sequential retry to distinguish real bugs from Firebase emulator contention
- Automatic summary showing which tier recovered failures
- Preserves all logs for analysis

See `docs/TEST_DEBUGGING_GUIDE.md` for more details.

### Test Writing and Debugging

**IMPORTANT**: Before writing new tests or debugging flaky tests, read these guides:

- **[Test Writing Guide](docs/TEST_WRITING_GUIDE.md)** - How to write reliable tests from the start
  - Unique test data generation
  - Avoiding data race conditions
  - Proper loading state handling
  - Parallel execution best practices

- **[Test Debugging Guide](docs/TEST_DEBUGGING_GUIDE.md)** - How to diagnose and fix flaky tests
  - Systematic debugging process
  - Common failure patterns and fixes
  - Decision trees for categorizing issues
  - Validation checklist

Key principles:
1. **Always use unique test IDs**: `generateBoxId()`, `generateUsername()`
2. **Never clear data in beforeEach**: Use global setup/teardown
3. **Wait for loading states**: Don't assert before data loads
4. **Test independently**: No dependencies on other tests

### Firebase Functions
```bash
# Install function dependencies
cd functions && npm install

# Deploy functions only
npm run deploy --prefix functions
```

### Deployment
```bash
# Deploy everything
firebase deploy

# Deploy hosting only
firebase deploy --only hosting
```

## Architecture

### Two-Tier Security Model

**Authentication** (Firebase Auth):
- Custom email domain: users enter username, app converts to `{username}@toysfortots.mcl1311.com`
- Google OAuth also supported
- Anonymous auth for public pages (map viewing, reporting)

**Authorization** (Firestore collection):
- Separate `authorizedVolunteers` collection in private path
- Cloud Function `isAuthorizedVolunteerV2` validates authorization
- Users are auto-authorized when they provision their first box with the shared passcode

### Key Flow: First-Time Volunteer

1. User creates account (authentication only, not yet authorized)
2. User navigates to `/setup?id=BOXID`
3. User enters shared passcode (stored in Firestore config)
4. `provisionBoxV2` Cloud Function:
   - Validates passcode
   - Creates location document
   - Adds user to `authorizedVolunteers` collection
   - Creates initial "box_registered" report

Future logins skip passcode - authorization check succeeds immediately.

### Firestore Data Structure

All data uses hierarchical artifact paths:

```
artifacts/toysfortots-eae4d/public/01/data/01/
  ├── locations/{boxId}            # Box locations (public read)
  ├── totsReports/{reportId}       # Status reports (public create, volunteer read/update)
  └── locationSuggestions/{id}     # Autocomplete data synced from Google Sheets

artifacts/toysfortots-eae4d/private/01/data/01/
  ├── authorizedVolunteers/{uid}  # Who can access dashboard
  └── metadata/config              # Shared passcode
```

**Critical paths** (exported from `firebase-init.js`):
- `locationsCollectionPath`
- `reportsCollectionPath`
- `locationSuggestionsCollectionPath`

### Cloud Functions

**provisionBoxV2** (callable):
- Creates new box location + authorizes first-time volunteers
- Validates passcode for new users
- Geocodes address using Google Maps API
- Returns: `{ success: boolean, boxId: string }`
- **Important**: Uses `FieldValue.serverTimestamp()` from `firebase-admin/firestore`, not `admin.firestore.FieldValue`

**isAuthorizedVolunteerV2** (callable):
- Checks if user is in `authorizedVolunteers` collection
- Returns: `{ isAuthorized: boolean, displayName: string }`

**sendReportEmail** (Firestore trigger):
- Fires when new report created in `totsReports`
- Sends email via Mailgun to `toysfortots@qlamail.com`

**syncLocationSuggestions** (callable):
- Manual trigger to sync Google Sheets → Firestore
- Only authorized volunteers can call
- Syncs data from spreadsheet to `locationSuggestions` collection
- Returns: `{ success: boolean, synced: number, message: string }`

**scheduledSyncLocationSuggestions** (scheduled):
- Runs every 10 minutes automatically
- Syncs Google Sheets data to Firestore
- Enables autocomplete on setup form
- **Spreadsheet**: [Master Toys for Tots Box tracker](https://docs.google.com/spreadsheets/d/1XbU6koPSANKaLFN9bFqU11SlNs-9qUhNpkUS6bxFg8k/) (sheet: WorkingCopy)
- **Columns mapped**: Label, Address, City, State, Owner/Manager Name, Phone, Email

### Frontend Pages

- **`/index.html`**: Public map (anonymous auth, shows all locations)
- **`/login/`**: Standalone auth page (username → email conversion)
- **`/dashboard/`**: Volunteer logistics (requires authorization)
- **`/setup/`**: Box provisioning form (requires auth, grants authorization)
- **`/box/`**: Public reporting (anonymous auth, creates reports)
- **`/status/`**: Box history (shows all reports for a box)

### Dashboard Implementation Detail

The dashboard reads from **locations collection first**, then joins with reports:

```javascript
// Get all locations
const locationsSnapshot = await getDocs(locationsRef);

// Build boxes map from locations
locationsSnapshot.forEach(doc => {
  allBoxesMap.set(boxId, { ...location, latestPendingReport: null });
});

// Get all reports, attach latest pending to each box
const reportsSnapshot = await getDocs(reportsQuery);
reportsSnapshot.forEach(doc => {
  const report = doc.data();
  const box = allBoxesMap.get(report.boxId);
  if (box && report.status === 'new' && !box.latestPendingReport) {
    box.latestPendingReport = report;
  }
});
```

This is the correct pattern - **do not read from reports collection and filter by volunteer**, as that breaks the "All Boxes" view.

## Testing

### Emulator Setup

Tests run against Firebase emulators (never production). The emulators must be running before tests:

```bash
# Terminal 1: Start emulators
./start-emulators.sh

# Terminal 2: Run tests
npx playwright test
```

### Test Fixtures (`tests/fixtures/`)

**firebase-helpers.js**:
- `clearTestData()` - Clear all test data from emulators
- `seedTestConfig(passcode)` - Set shared passcode in config
- `createTestLocation(boxId, data)` - Create location document
- `createTestReport(boxId, data)` - Create report document
- `authorizeVolunteer(uid, email, displayName)` - Add to authorizedVolunteers

**auth.js**:
- `createTestUser(page, username, password)` - Sign up new user
- `signInTestUser(page, username, password)` - Sign in existing user

### Test Pattern

Always clear data before/after each test:

```javascript
test.beforeEach(async () => {
  await clearTestData();
  await seedTestConfig('semperfi'); // Use real passcode
});

test.afterEach(async () => {
  await clearTestData();
});
```

### Playwright Configuration

- **Workers**: 4 (parallel execution for speed)
- **Timeouts**: 3 seconds default for actions/navigations, 15 seconds total per test
- **Do not hardcode timeouts** unless there's a specific reason - use defaults
- **Base URL**: `http://localhost:5000` (emulated hosting)

### Dashboard Test Authorization Flow

Dashboard tests use the **real authorization flow** (not manual `authorizeVolunteer()`):

```javascript
test.beforeEach(async ({ page }) => {
  await clearTestData();
  await seedTestConfig('semperfi');

  // Create user account
  await page.goto('/login');
  // ... sign up flow

  // Authorize by provisioning a box with passcode
  await page.goto('/setup?id=TEST_BOX_001');
  await page.fill('#passcode', 'semperfi');
  await page.fill('#label', 'Test Location');
  await page.locator('#show-address-btn').click(); // Address fields hidden by default
  await page.fill('#address', '123 Test St');
  // ... complete form
  await page.locator('#submit-btn').click();

  // Wait for redirect to status page (indicates success)
  await page.waitForURL(/\/status/);
});
```

This calls `provisionBoxV2` which validates passcode and adds user to `authorizedVolunteers`.

## Environment Variables

Functions require these environment variables (set in `functions/.env.local` for emulator):
- `MAILGUN_KEY`
- `MAILGUN_DOMAIN`
- `GEOCODING_API_KEY`

## Important Patterns

### Emulator Auto-Detection

`firebase-init.js` automatically detects localhost and connects to emulators:

```javascript
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

No code changes needed between local/production environments.

### QR Code Flow

Unique box IDs in URLs enable QR code scanning:
- `/box?id=BOXID` - If location exists → public reporting
- `/setup?id=BOXID` - If location doesn't exist → provisioning form

The box page checks if location exists and redirects to setup if not found.

### Report Status Lifecycle

1. Created: `status: 'new'`
2. Dashboard shows latest `new` report per box
3. Volunteer clicks "Mark as Cleared" → updates to `status: 'cleared'`
4. Dashboard no longer shows cleared reports

### Shared Header/Footer

All pages load `_header.html` and `_footer.html` via `loader.js` for consistent branding.

### Location Autocomplete System

The setup page includes an autocomplete system that reduces data entry by auto-filling form fields from a Google Sheets spreadsheet.

**How it works**:
1. **Scheduled Sync**: Every 10 minutes, `scheduledSyncLocationSuggestions` reads the spreadsheet and syncs to Firestore `locationSuggestions` collection
2. **Manual Trigger**: Authorized volunteers can call `syncLocationSuggestions` via Firebase Console to force immediate sync
3. **GPS Auto-Fill**: When user clicks "Use My GPS Location" and address is retrieved, system searches for exact match and silently auto-fills all fields
4. **Dropdown Search**: When user types in "Location Name (Label)" field, dropdown shows matching locations from spreadsheet
5. **Smart Fill**: Only fills fields that are currently empty - never overwrites user input

**Autocomplete Library** (`/public/js/location-autocomplete.js`):
- `searchByAddress(address, maxResults)` - Prefix search on address field
- `searchByLabel(label, maxResults)` - Prefix search on location name
- `findExactMatchByAddress(address)` - Returns single exact match (for GPS)
- `autoFillFormFields(location, fieldIds)` - Fills form fields (only empty ones)
- `createAutocomplete(inputElement, searchFunction, onSelect, debounceMs)` - Dropdown UI builder

**Setup Page Integration**:
```javascript
// After GPS gets address (public/setup/index.html ~line 167)
const match = await findExactMatchByAddress( addressInput.value );
if( match ) {
  autoFillFormFields( match );
  showMessage( 'success', 'Location info auto-filled from records!' );
}

// Label field autocomplete (in init() function ~line 326)
const labelInput = document.getElementById( 'label' );
createAutocomplete(
  labelInput,
  searchByLabel,
  ( selected ) => {
    autoFillFormFields( selected );
    showMessage( 'success', 'Location info filled from records!' );
  }
);
```

**Firestore Structure**:
Each suggestion document contains:
- `label` - Location name (from spreadsheet column A)
- `address` - Street address (column B)
- `city` - City (column C)
- `state` - State (column D)
- `contactName` - Owner/Manager name (column F)
- `contactPhone` - Phone number (column G)
- `contactEmail` - Email (column J)
- `searchLabel` - Lowercase label for prefix matching
- `searchAddress` - Lowercase address for prefix matching
- `syncedAt` - Timestamp of last sync
- `sourceRow` - Row number in spreadsheet

**Search Performance**:
Uses Firestore range queries with `\uf8ff` terminator for efficient prefix matching:
```javascript
where('searchLabel', '>=', normalized),
where('searchLabel', '<=', normalized + '\uf8ff'),
orderBy('searchLabel'),
limit(maxResults)
```

**Deploying Autocomplete Updates**:
```bash
# After modifying Cloud Functions
firebase deploy --only functions

# After modifying Firestore rules
firebase deploy --only firestore:rules

# After modifying frontend
firebase deploy --only hosting

# Trigger initial sync
# Option 1: Firebase Console → Functions → syncLocationSuggestions → Test
# Option 2: Wait up to 10 minutes for scheduled sync
```

**Modifying Spreadsheet Mapping**:
If spreadsheet columns change, update `syncLocationSuggestionsFromSheets()` in `functions/index.js`:
```javascript
const label = (row[0] || '').trim();        // Column A
const address = (row[1] || '').trim();      // Column B
const city = (row[2] || '').trim();         // Column C
const state = (row[3] || 'GA').trim();      // Column D
const contactName = (row[5] || '').trim();  // Column F (Owner/Manager Name)
const contactPhone = (row[6] || '').trim(); // Column G (Phone)
const contactEmail = (row[9] || '').trim(); // Column J (Email)
```

**Troubleshooting**:
- **No autocomplete results**: Check if sync has run (Firebase Console → Firestore → locationSuggestions should have documents)
- **Sync failing**: Check Cloud Functions logs for Google Sheets API errors
- **Wrong data shown**: Verify spreadsheet tab name is exactly "WorkingCopy" (case-sensitive)
- **Performance issues**: Default limit is 10 results - increase only if needed

## Common Issues

### Firebase Functions serverTimestamp Error

If you see `TypeError: Cannot read properties of undefined (reading 'serverTimestamp')`:

**Wrong**:
```javascript
admin.firestore.FieldValue.serverTimestamp()
```

**Correct**:
```javascript
const { FieldValue } = require('firebase-admin/firestore');
FieldValue.serverTimestamp()
```

The modular Firebase Admin SDK requires importing `FieldValue` separately.

### Dashboard Shows No Data

The dashboard reads from `locations` collection, not `reports`. Ensure:
1. `window.initApp()` queries `locationsCollectionPath` first
2. Reports are joined afterward by `boxId`
3. Filter by volunteer happens on locations, not reports
