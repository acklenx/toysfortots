# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## IMPORTANT: Commit Message Policy

**DO NOT include Claude Code co-authored text in commit messages!**

The following lines should NEVER appear in commit messages:
- `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
- `Co-Authored-By: Claude <noreply@anthropic.com>`

A `commit-msg` hook will automatically block commits containing these lines.

## Project Overview

This is a Firebase-based web application for tracking Toys for Tots donation boxes. Marines use QR codes to provision boxes at business locations, and the public can scan codes to report when boxes need pickup. The system manages location data, status reports, and volunteer authorization.

## Security Guidelines

### XSS (Cross-Site Scripting) Prevention

**CRITICAL: Always escape user-generated content before rendering to prevent XSS attacks.**

When displaying data from Firestore or user input using `innerHTML`, you **MUST** escape HTML special characters.

**BAD (Vulnerable to XSS):**
```javascript
// DON'T DO THIS - Allows script injection!
element.innerHTML = `<h2>${location.label}</h2>`;
element.innerHTML = `<p>${report.description}</p>`;
```

**GOOD (XSS Protected):**
```javascript
// Always use this escapeHtml function before inserting user data
const escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

element.innerHTML = `<h2>${escapeHtml(location.label)}</h2>`;
element.innerHTML = `<p>${escapeHtml(report.description)}</p>`;
```

**When to escape:**
- ANY data from Firestore (locations, reports, user profiles, etc.)
- URL parameters (boxId, search queries, etc.)
- Form inputs that get re-displayed
- API responses from external services

**Safe alternatives to `innerHTML`:**
- Use `textContent` for plain text (automatically escapes HTML)
- Use `setAttribute()` for attribute values
- Use `createElement()` and `appendChild()` for DOM manipulation

**Example with textContent:**
```javascript
const heading = document.createElement('h2');
heading.textContent = location.label; // Automatically safe
element.appendChild(heading);
```

**Testing XSS fixes:**
Test with malicious payloads like:
- `<script>alert("XSS")</script>`
- `<img src=x onerror=alert("XSS")>`
- `<iframe src="javascript:alert('XSS')"></iframe>`

See `tests/e2e/box-and-status.spec.js` for XSS test examples.

### Other Security Best Practices

1. **Never log sensitive data** - Passcodes, passwords, API keys should never appear in console.log()
2. **Validate all inputs** - Both client-side and server-side (Cloud Functions)
3. **Use Firestore Security Rules** - Enforce authorization at the database level
4. **Rate limiting** - Protect Cloud Functions from abuse
5. **HTTPS only** - Never allow HTTP connections in production

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

### Performance Monitoring
```bash
# Run performance audit on all pages (desktop)
npm run perf:audit

# Run mobile performance audit
npm run perf:audit:mobile

# Audit specific page
npm run perf:page -- --page=dashboard

# Set performance baseline
npm run perf:baseline

# Compare against baseline
npm run perf:compare

# Interactive demo
./scripts/demo-performance-agent.sh
```

**Web Performance Agent:** The performance monitoring tool provides:
- **Lighthouse Integration:** Full audits on all 8 pages
- **Core Web Vitals:** LCP, CLS, FCP, TBT, SI, TTI tracking
- **Bundle Analysis:** JavaScript, CSS, image size monitoring
- **Opportunities:** Top optimization recommendations with time savings
- **Baseline Tracking:** Compare performance over time
- **CI/CD Integration:** Automated monitoring via GitHub Actions

See `docs/WEB_PERFORMANCE_AGENT.md` for complete documentation.

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

**triggerSyncLocationSuggestions** (HTTP endpoint):
- Manual trigger via HTTP POST request (no authentication required)
- URL: `https://us-central1-toysfortots-eae4d.cloudfunctions.net/triggerSyncLocationSuggestions`
- Optional `delay` query parameter (in seconds): `?delay=30`
- Returns: `{ success: boolean, synced: number, message: string }`
- Usage: `curl -X POST https://us-central1-toysfortots-eae4d.cloudfunctions.net/triggerSyncLocationSuggestions`

**getLocationsCache** (HTTP endpoint, CORS-enabled):
- Serves cached locations JSON for fast initial page load
- URL: `https://us-central1-toysfortots-eae4d.cloudfunctions.net/getLocationsCache`
- Returns: `{ locations: array, generatedAt: string, count: number, version: number }`
- No authentication required (public endpoint)
- HTTP cache headers: `Cache-Control: public, max-age=3600`
- Auto-generates cache if missing
- Usage: `fetch('https://us-central1-toysfortots-eae4d.cloudfunctions.net/getLocationsCache')`

**refreshLocationsCache** (callable):
- Manual trigger to regenerate locations cache
- Requires authorization (volunteers only)
- Returns: `{ success: boolean, count: number, message: string, url: string }`
- Usage: Call from dashboard or Firebase Console

**scheduledRefreshLocationsCache** (scheduled):
- Runs every 6 hours automatically
- Regenerates locations cache for home page performance
- Timezone: America/New_York
- Execution times: 12:00 AM, 6:00 AM, 12:00 PM, 6:00 PM EST

**triggerRefreshLocationsCache** (HTTP endpoint):
- Manual cache refresh via HTTP POST
- URL: `https://us-central1-toysfortots-eae4d.cloudfunctions.net/triggerRefreshLocationsCache`
- No authentication required
- Returns: `{ success: boolean, count: number, message: string, url: string }`
- Usage: `curl -X POST https://us-central1-toysfortots-eae4d.cloudfunctions.net/triggerRefreshLocationsCache`

### Frontend Pages

All pages follow a standardized HTML structure for consistency and maintainability:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="[SEO description crediting Marine Corps Reserve as primary, MCL 1311 as local support]">
    <title>Page Title - Toys for Tots</title>
    <link rel="stylesheet" href="/css/style.css?v=1.0.7">
</head>
<body class="bg-gray-100">
    <div id="header-placeholder"></div>

    <main class="page-container">
        <!-- Page content here -->
    </main>

    <div id="footer-placeholder"></div>
    <script src="/js/loader.js" defer></script>
</body>
</html>
```

**Page Inventory:**
- **`/index.html`**: Public map (uses cached data + lazy realtime updates)
- **`/login/`**: Standalone auth page (username → email conversion)
- **`/dashboard/`**: Volunteer logistics (requires authorization)
- **`/setup/`**: Box provisioning form (requires auth, grants authorization)
- **`/box/`**: Public reporting (anonymous auth, creates reports)
- **`/status/`**: Box history (shows all reports for a box)
- **`/authorize/`**: Volunteer authorization page
- **`/print/`**: QR code sticker generator for boxes

**Home Page Performance Optimization**:

The home page (`/index.html`) uses a two-tier loading strategy for optimal performance:

1. **Cached Data (Immediate ~100ms)**:
   - Loads from `getLocationsCache` Cloud Function endpoint
   - No authentication required
   - Renders map markers and location list immediately
   - Data refreshed every 6 hours automatically

2. **Realtime Data (Background ~500ms)**:
   - After Firebase auth completes, queries Firestore
   - Updates map with latest data
   - Runs in background, non-blocking
   - Ensures data freshness

**Benefits**:
- **7x faster initial render** (~150ms vs ~1200ms)
- **No auth blocking** for first paint
- **Always fresh** via background update
- **Graceful degradation** if cache unavailable

See `docs/LOCATIONS_CACHING_SYSTEM.md` for complete documentation.

**SEO Meta Descriptions:**
All pages include meta descriptions that credit:
1. **Marine Corps Reserve** as the primary organization running Toys for Tots
2. **Marine Corps League Detachment 1311** as local North Metro Atlanta support

Example: "Run by the Marine Corps Reserve and coordinated locally by Marine Corps League Detachment 1311 in North Metro Atlanta."

**Styling Convention:**
- All pages use `<body class="bg-gray-100">` for consistent background
- All content wrapped in `<main class="page-container">` for unified layout
- `.page-container` provides: flex layout, consistent margins/padding, max-width constraint
- Header and footer loaded dynamically via `/js/loader.js` for DRY principle

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

**Layout Shift Prevention:**
- All images have explicit `width` and `height` attributes to reserve space before loading
  - T4T logo: 181×60px (WebP)
  - MCL logo: 80×80px (WebP)
  - Gunny bear footer: 79×100px (WebP)
  - Map pin icon: 40×39px (WebP)
- Header and footer have `min-height` set (110px and 160px respectively)
- Empty `#header-placeholder` and `#footer-placeholder` divs show skeleton styles
- This reduces Cumulative Layout Shift (CLS) and improves Core Web Vitals

**Accessibility Features:**
- Descriptive alt text for all images:
  - T4T logo: "Toys for Tots logo with red text and toy train"
  - MCL logo: "Marine Corps League emblem with Eagle, Globe, and Anchor"
  - Gunny bear: "Gunny Bear, the Toys for Tots teddy bear mascot wearing Marine Corps uniform with sunglasses"
  - Map pin: WebP format icon for location markers
- Hamburger menu keyboard accessibility:
  - ALL menu items have `tabindex="-1"` and `aria-hidden="true"` when menu is closed
  - Includes Map, Dashboard, New Box, Sign In, and Sign Out items
  - JavaScript dynamically toggles `tabindex` and `aria-hidden` when menu opens/closes
  - Only visible items become focusable when menu is open
  - Hamburger button has `aria-label="Menu"` and `aria-expanded` state
  - Nav container properly manages `aria-hidden` state
- WCAG 2.1 Level A compliance for Non-text Content (1.1.1), Keyboard (2.1.1), and Name/Role/Value (4.1.2)

**Mobile Responsive Design:**
- Header layout optimized for mobile (768px breakpoint):
  - Maintains horizontal layout (flex-row) on mobile for better space efficiency
  - Reduced padding: 10px 15px (vs 15px 20px on desktop)
  - Reduced logo sizes: T4T 40px, MCL 50px (vs 60px/80px on desktop)
  - Left-aligned header text for better readability
  - Scaled-down typography: h1 1.2rem, h2 1rem, sub-header 0.75rem
  - Header placeholder adjusted to 90px on mobile (vs 110px desktop)
- Map and location list stack vertically on mobile (50vh each)

### Location Autocomplete System

The setup page includes an autocomplete system that reduces data entry by auto-filling form fields from a Google Sheets spreadsheet.

**How it works**:
1. **Scheduled Sync**: Every 10 minutes, `scheduledSyncLocationSuggestions` reads the spreadsheet and syncs to Firestore `locationSuggestions` collection
2. **Manual Trigger**: Can trigger sync via HTTP endpoint or callable function (see below)
3. **GPS Auto-Fill**: When user clicks "Use My GPS Location" and address is retrieved, system searches for exact match and silently auto-fills all fields
4. **Dropdown Search**: When user types in "Location Name (Label)" field, dropdown shows matching locations from spreadsheet
5. **Smart Fill**: Only fills fields that are currently empty - never overwrites user input
6. **Keyboard Navigation**: Desktop users can use Tab/Enter to select, Arrow keys to navigate, Escape to close

**Autocomplete Library** (`/public/js/location-autocomplete.js`):
- `searchByAddress(address, maxResults)` - Prefix search on address field
- `searchByLabel(label, maxResults)` - Prefix search on location name
- `findExactMatchByAddress(address)` - Returns single exact match (for GPS)
- `autoFillFormFields(location, fieldIds)` - Fills form fields (only empty ones)
- `createAutocomplete(inputElement, searchFunction, onSelect, debounceMs)` - Dropdown UI builder with keyboard navigation
  - **Tab**: Auto-select first/highlighted item
  - **Enter**: Select highlighted item
  - **Arrow Up/Down**: Navigate suggestions
  - **Escape**: Close dropdown
  - **Mouse/Touch**: Click or tap to select

**Setup Page UX Enhancements**:
- When user selects autocomplete suggestion, address fields auto-expand if hidden
- Auto-fill only populates empty fields (preserves user edits)
- Success message confirms data was loaded from records

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

**Triggering Manual Sync**:
```bash
# HTTP endpoint (no authentication required)
curl -X POST https://us-central1-toysfortots-eae4d.cloudfunctions.net/triggerSyncLocationSuggestions

# With optional delay (in seconds)
curl -X POST "https://us-central1-toysfortots-eae4d.cloudfunctions.net/triggerSyncLocationSuggestions?delay=30"

# Callable function (requires authorization)
# Use Firebase Console → Functions → syncLocationSuggestions → Test
```

**Deploying Autocomplete Updates**:
```bash
# After modifying Cloud Functions
firebase deploy --only functions

# After modifying Firestore rules
firebase deploy --only firestore:rules

# After modifying frontend autocomplete
firebase deploy --only hosting

# Trigger sync after deployment
curl -X POST https://us-central1-toysfortots-eae4d.cloudfunctions.net/triggerSyncLocationSuggestions
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
- **Dropdown too narrow or not visible**: Ensure input field is visible when autocomplete initializes (width is calculated dynamically on display)
- **Permission denied errors**: Ensure Firestore rules allow authenticated users to read `locationSuggestions` collection
- **API key errors**: Verify Google Sheets API is enabled on the API key stored in `GEOCODING_API_KEY`

## CSS Architecture

The project uses a unified CSS architecture with semantic variables and consistent styling patterns.

### CSS Variables

All colors and spacing are defined in `/public/css/style.css` using CSS custom properties:

```css
:root {
    /* Brand Colors */
    --t4t-red: #D21F3C;
    --t4t-red-hover: #a01828;
    --t4t-red-light: #fef2f2;
    --marine-blue: #002D62;
    --t4t-green: #008000;
    --t4t-green-dark: #15803d;

    /* Neutral Colors */
    --gray-50 through --gray-900

    /* Semantic Colors */
    --bg-primary, --bg-success, --bg-error
    --text-primary, --text-secondary, --text-muted
    --border-default, --border-focus

    /* Button Colors */
    --btn-primary, --btn-secondary, --btn-danger

    /* Spacing */
    --page-spacing: 20px;
    --border-radius: 8px;
}
```

### Container Classes

**Unified Page Container** (`.page-container`):
- Used on all pages for consistent layout
- Provides: `flex: 1`, `margin: var(--page-spacing) auto`, `padding: 0 20px`, `max-width: 1200px`
- Ensures sticky footer layout works properly

**Legacy Aliases** (deprecated but maintained for compatibility):
- `.page-content` - same as `.page-container`
- `.form-wrapper` - same as `.page-container`

**Specialized Containers**:
- `.container` - Used only on home page for map + sidebar flex layout
- `.form-container` - Green-tinted container for setup form
- `.box-page-container`, `.status-page-container` - Max-width 28rem for narrower content

### Utility Classes

- `.bg-gray-100` - Standard body background color
- `.hidden` - Display none
- `.sr-only` - Screen reader only (accessibility)

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
