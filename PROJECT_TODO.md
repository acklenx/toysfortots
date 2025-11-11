# 🎄 Toys for Tots - Project TODO List

## 🚨 **Top Priority**

### 🔗 QR Code → Google Sheets Integration
- [ ] **Link QR codes to Google Sheets entries**
  - Import location data and contact info from existing spreadsheet
  - Auto-populate setup form when QR code has associated spreadsheet data
  - Skip manual entry for pre-registered locations
  - Handle updates when spreadsheet data changes

### 🎨 **UI/UX Consistency & Polish**
- [x] ✅ **Layout shift prevention (November 7, 2025)**
  - Fixed footer layout shift (reserve 224px, use visibility for username)
  - Fixed header layout shift (remove duplicate border, inline CSS)
  - Force scrollbar to prevent horizontal shifts
  - Loading message removal (no reserved space after quick load)

- [x] ✅ **Add hamburger menu for authenticated users**
  - Replace hidden icon navigation with proper menu
  - Include: Dashboard, Setup New Box, View All Boxes, Sign Out
  - Mobile-friendly slide-out design
  - Accessibility: menu items unfocusable until expanded
  - Use appropriate icons for menu items

- [x] ✅ **User experience improvements**
  - White footer username text for better contrast
  - Store displayName with proper capitalization
  - Location list always clears when realtime data loads
  - Loading message disappears after 5 seconds or on data load

- [ ] **Fix page appearance inconsistencies** ⚠️ **HIGH PRIORITY**
  - Audit all pages for visual consistency
  - Standardize header/footer styling across pages
  - Ensure consistent spacing, fonts, and colors

---

## ⚡ **Performance & Optimization**

### 🗺️ Homepage Cache Improvements
- [x] ✅ **Auto-refresh cache after box registration** (November 7, 2025 - commit: 7439f88)
  - Trigger cache refresh 1 second after provisionBoxV2 completes
  - New boxes appear on homepage map within 2 seconds
  - Eliminates 6-hour delay for new box visibility
  - Uses existing triggerRefreshLocationsCache HTTP endpoint

- [x] ✅ **Admin panel cache refresh button** (November 7, 2025 - commit: ec75640)
  - Manual "Refresh Map Cache" button in admin header
  - Displays detailed results: box count, cache URL, success/error messages
  - Button shows loading state while refreshing
  - Success messages auto-hide after 10 seconds
  - Useful for bulk imports and urgent updates

- [x] ✅ **Cache-only homepage loading with consistent sorting** (November 7, 2025 - commit: 413d131)
  - Homepage now uses cache-only (disabled Firebase realtime loading)
  - Cache generation sorts by newest first (orderBy created DESC)
  - Eliminates duplicate requests and inconsistent ordering
  - Performance: ~150ms cache load vs ~1200ms cache+realtime
  - Deprecated anonymous authentication test (no longer needed)

**Cache Refresh Ecosystem:**
- 🔄 Automatic: Every 6 hours (scheduled Cloud Function)
- 🆕 Auto-trigger: After new box registration (instant)
- 👨‍💼 Manual: Admin panel button (on-demand)
- 🎯 **Homepage uses cache-only** for optimal performance

---

## 🔒 **Security**

### 🛡️ XSS (Cross-Site Scripting) Protection
- [x] ✅ **Fix XSS in box page** (November 7, 2025 - commit: 9f5dec5)
  - Escape all location data (labels, addresses, cities, states)
  - Escape box IDs and volunteer names
  - Add comprehensive XSS security test

- [x] ✅ **Fix XSS in dashboard page** (November 7, 2025 - commit: 7bf632d)
  - Escape box labels, addresses, cities
  - Escape report descriptions and notes
  - Escape report types and IDs
  - Add comprehensive XSS security test

- [x] ✅ **Fix XSS in status page** (November 7, 2025 - commit: e4125fc)
  - Escape location labels, addresses, contact information
  - Escape report descriptions, notes, reporter information
  - Escape volunteer names and box IDs
  - Add comprehensive XSS security test

- [x] ✅ **Add XSS prevention guidelines to CLAUDE.md** (November 7, 2025 - commit: 9f5dec5)
  - Document escapeHtml() function pattern
  - Provide safe/unsafe code examples
  - List when to escape user data

- [x] ✅ **Fix XSS in home page** (November 7, 2025 - commit: 1a346cb) ⭐ **FINAL CRITICAL FIX**
  - Escape location data in map markers (labels, addresses, cities, states)
  - Escape location data in sidebar list
  - Add comprehensive XSS security test with map popup verification
  - **All critical XSS vulnerabilities now fixed across entire application**

- [x] ✅ **Remove sensitive data from logs** (November 7, 2025 - commit: 5b60b9b)
  - Removed passcode from Cloud Function logs (functions/index.js:149)
  - Replaced with safe logging: 'Validating passcode...'
  - Prevents passcode leakage in logs

### 🔐 Infrastructure Security
- [x] ✅ **Restrict CORS on HTTP endpoints** (November 7, 2025 - commits: bf4236f, e252935)
  - Added CORS support to triggerRefreshLocationsCache endpoint
  - Added CORS support to triggerSyncLocationSuggestions endpoint
  - Restricted to production domain only: https://toysfortots.mcl1311.com
  - **🚀 REQUIRES DEPLOYMENT: firebase deploy --only functions**

- [x] ✅ **Add Content Security Policy and security headers** (November 7, 2025 - commits: e0bfdec, d98c8bb, ebc0022)
  - Content-Security-Policy: Restrict script/style/connect sources to trusted domains
  - X-Frame-Options: DENY (prevents clickjacking)
  - X-Content-Type-Options: nosniff (prevents MIME-type sniffing)
  - Referrer-Policy: strict-origin-when-cross-origin (privacy protection)
  - Permissions-Policy: Comprehensive blocking of 19+ unused browser features
  - Fixed header routing pattern to match all HTML responses (not just .html files)
  - **⚠️ TEMPORARY WORKAROUND**: Added 'unsafe-inline' to script-src for inline module scripts
  - **✅ DEPLOYED TO PRODUCTION: All security headers now active**
  - **📋 TODO**: Refactor to external scripts (see "Refactor inline scripts" below)

- [ ] **Implement rate limiting**
  - Protect Cloud Functions from abuse
  - Add Firebase App Check

- [x] ✅ **Add authentication to HTTP endpoints** (November 7, 2025 - commit: 024a5e5)
  - Secured triggerSyncLocationSuggestions - requires authorized volunteer token
  - Secured triggerRefreshLocationsCache - requires authorized volunteer token
  - Both endpoints verify Firebase ID token and check authorizedVolunteers collection
  - Client-side updated to send Authorization header with ID token
  - **🚀 REQUIRES DEPLOYMENT: firebase deploy**

---

## 🔐 **Admin & Management**

### 👨‍💼 Admin Dashboard
- [x] ✅ **Create true admin page** (`/admin/`) ⭐ **COMPLETE - Tag: admin-page-done** (November 10, 2025)
  - ✅ View all locations with search/filter (regex + invert match)
  - ✅ Edit location details (address, contact info, label) - Edit modal with GPS coordinates
  - ✅ Delete locations with confirmation (soft-delete system)
  - ✅ Restore deleted locations (full audit trail)
  - ✅ View all submitted reports with location context
  - ✅ Delete/restore reports with confirmation
  - ✅ View report details (read-only modal)
  - ✅ Manage authorized volunteers with analytics
  - ✅ Delete/restore volunteer access
  - ✅ View system statistics (total boxes, reports, volunteers with real-time updates)
  - ✅ Export to CSV (boxes, reports, volunteers)
  - ✅ Sortable columns with hover-to-show indicators
  - ✅ Military date-time formatting (YYYY-MM-DD HH:mm)
  - ✅ Relative time display (1h ago, 2d ago) with full timestamp tooltips
  - ✅ Deployed column for boxes
  - ✅ Location column for reports
  - ✅ Undeployed boxes tracking for volunteers
  - ✅ Click outside to close modals
  - ✅ Responsive search inputs with flexible sizing
  - ✅ Right-aligned action buttons with proper spacing
  - ✅ Centered Actions headers

- [x] ✅ **Filter-aware delete buttons** (November 8, 2025 - commit: a1b1fa1)
  - Delete buttons show dynamic counts when filters are active
  - Button text: "Delete All" when no filter, "Delete 5 Boxes" when filtered
  - Confirmation dialogs show detailed counts (how many deleted vs kept)
  - Delete operations only affect filtered items
  - Buttons disabled when filtered count is 0
  - Volunteers section excludes current user from deletable count
  - Prevents accidental bulk deletions and gives admins confidence

- [x] ✅ **Soft-delete system with audit trail** (November 10, 2025 - Tag: soft-deletes-working, restore-working)
  - Soft-delete for boxes, reports, and volunteers
  - Tracks: deleted (bool), deletedAt (timestamp), deletedBy (uid)
  - Restore functionality with full audit trail
  - Tracks: restoredAt (timestamp), restoredBy (uid)
  - Preserves deletion history for compliance
  - Root-only toggle to show/hide deleted items (?showDeleted=true URL param)
  - Hard delete (purge) only for root users

### 🔒 Admin Authorization
- [x] ✅ **RBAC role system** (Existing - uses authorizedVolunteers collection)
  - Three roles: volunteer, admin, root
  - Firestore security rules enforce role-based access
  - Admins can soft-delete (but not modify self or root)
  - Root can restore deleted items and hard delete (purge)
- [x] ✅ **Protect admin routes** (Existing - client-side role check)
  - Admin page checks role on page load
  - Shows error if user is not admin or root
  - Root-only features conditionally displayed
- [x] ✅ **Admin-only operations** (Existing - Firestore rules enforce)
  - Delete/restore operations restricted by Firestore rules
  - Updates to authorized volunteers require admin role
  - Root user cannot be modified by admins

---

## 🧪 **Testing**

### ✅ **Completed**
- [x] ✅ **Smart test runner with 3-tier retry strategy**
  - Tier 1: Fast parallel execution (4 workers)
  - Tier 2: Automatic retry for transient failures
  - Tier 3: Sequential retry to distinguish real bugs

- [x] ✅ **Comprehensive unit test infrastructure**
  - Jest configuration for Cloud Functions
  - Test fixtures and helpers
  - Unit tests for all Cloud Functions

- [x] ✅ **E2E test suite reliability improvements**
  - Fixed data race conditions
  - Implemented unique test ID generation
  - Fixed loading state handling
  - Achieved stable parallel execution

- [x] ✅ **User journey tests**
  - 5 complete real-world user scenarios
  - Anonymous user flows (pickup, problem reporting, navigation)
  - Volunteer workflows (signup, provisioning, management)
  - Production-ready with 100% pass rate

- [x] ✅ **CSP enforcement in local tests** (November 7, 2025 - commits: e2eaf5e, e8d670d)
  - Added CSP meta tags to all 9 HTML pages
  - Meta tags match firebase.json security headers exactly
  - Includes localhost URLs for Firebase emulator compatibility
  - Updated smoke tests to verify JavaScript execution
  - Added console error detection to catch CSP violations
  - Closes critical blind spot where emulator didn't enforce CSP
  - All 11 smoke tests passing locally with CSP enforced

- [x] ✅ **Production smoke tests** (November 7, 2025 - commit: e8d670d)
  - Created test suite for https://toysfortots.mcl1311.com
  - Verifies JavaScript executes (not blocked by CSP)
  - Checks for console errors (CSP violations show here)
  - Validates all security headers present
  - Tests critical user paths (homepage, login, redirects)
  - READ-ONLY tests, safe to run against production
  - Usage: `npm run test:production`
  - All 5 production tests passing (3.1s)

- [x] ✅ **Fixed flaky test in smoke suite** (November 8, 2025)
  - Increased timeout from 3s to 5s for box redirect test
  - Test: "should redirect to login via setup if box does not exist"
  - Location: tests/e2e/box-and-status.spec.js:26
  - Initial failure rate: 20% (1 out of 5 runs)
  - Validation: 10 consecutive runs, 120 total test executions, 0 failures
  - Result: 100% stable, flakiness eliminated
  - Average runtime: 4.82s (box tests), 6.21s (parallel tests), 11.13s total

### 🌐 Production E2E Tests
- [x] ✅ **Basic production smoke tests complete** (see "Completed" section above)
- [ ] **Enhanced production test coverage** (optional future work)
  - Add themed test data scenarios (North Pole address, "Buddy the Elf" volunteer)
  - Expand to test more user journeys
  - Add scheduled daily runs with notifications
  - Currently: 5 READ-ONLY smoke tests verify site health

### ⚡ Test Performance Optimization
- [ ] **Implement shared test fixtures for common scenarios**
  - Create preconfigured test states with data loaded once
  - Run multiple read-only tests against same fixture (faster)
  - Examples: "dashboard with 3 boxes", "box with 5 reports", "homepage with 10 locations"
  - Only create new data for tests that specifically test data creation/mutation
  - Current problem: Every test creates its own data, even for simple "is text visible" checks
  - Solution: Fixture setup → run all tests that need it → teardown
  - Could reduce test suite time from ~60s to ~20s for full run

---

## 📱 **Progressive Web App (PWA)**

- [ ] **Convert to PWA**
  - Add `manifest.json` with app metadata
  - Include app icons (multiple sizes)
  - Add service worker for offline support
  - Enable "Add to Home Screen" functionality
  - Cache critical assets for offline viewing
  - Test installation on iOS and Android

---

## 🏗️ **Architecture Improvements**

### 📜 JavaScript Architecture
- [ ] **Refactor inline scripts to external files** ⚠️ **HIGH PRIORITY - Security Improvement**
  - Move all inline `<script>` blocks to external `.js` files
  - Remove `'unsafe-inline'` from CSP script-src directive
  - Options:
    1. Keep ES modules with external files (`<script type="module" src="...">`)
    2. Use traditional global scope scripts (no modules)
  - Benefits:
    - Stronger CSP protection (no unsafe-inline needed)
    - Better caching (scripts cached separately from HTML)
    - Easier testing (scripts can be unit tested independently)
  - Estimated effort: 4-6 hours to refactor all 11 HTML pages
  - Current workaround: Using 'unsafe-inline' to allow inline module scripts

### 🎯 Single Page Application (SPA)
- [ ] **Migrate to SPA architecture**
  - Replace directory-based routing (`/dashboard/index.html`) with client-side routing
  - Use History API for navigation
  - Centralize page templates
  - Reduce duplicate header/footer loading
  - Improve load times and navigation smoothness
  - Consider framework: Vanilla JS router, or lightweight option (Preact, Alpine.js)

---

## 📚 **Documentation**

### 📖 Volunteer Instructions
- [ ] **Create comprehensive volunteer guide** (`/docs/volunteer-guide.md`)
  - Step-by-step instructions with screenshots
  - How to provision a new box
  - How to check box status
  - How to respond to pickup requests
  - How to handle problem reports
  - Best practices and tips

- [ ] **Review print page** (`/print/index.html`)
  - Ensure it generates proper QR codes
  - Include instructions on printed materials
  - Test print layout on various paper sizes
  - Add setup instructions on printout

---

## 🔒 **Security & Best Practices**

### 🛡️ Security Review
- [ ] **Conduct security audit**
  - Review Firestore security rules
  - Check for XSS vulnerabilities
  - [x] ✅ **Validate all user inputs** (November 7, 2025 - commits: c125e0a, 11bd44c)
    - Server-side: Comprehensive validation in provisionBoxV2
      - Type checking, length limits, format validation (email, phone, boxId)
      - Input sanitization (trim whitespace)
      - Range validation for numeric fields
    - Client-side: HTML5 validation attributes on setup form
      - Matches server-side rules exactly
      - Instant feedback before submission
      - Browser-native validation UI
    - **🚀 REQUIRES DEPLOYMENT: firebase deploy**
  - Review authentication flows
  - Ensure no sensitive data in client code
  - Check for CSRF protections
  - Review Cloud Function permissions
  - Audit API key exposure

### ⚡ Performance & Best Practices
- [x] ✅ **Asset minification (November 7, 2025)**
  - Added build scripts for CSS minification (csso)
  - Added build scripts for JS minification (terser)
  - All pages updated to use minified assets
  - Reduced file sizes for faster page loads

- [x] ✅ **Production bug fixes**
  - Fixed getLocationsCache Cloud Function (explicit bucket name)
  - Fixed location list not clearing when cache fails but realtime succeeds
  - Cache function ready for deployment after Storage bucket creation

- [ ] **Lighthouse audit**
  - Run Lighthouse tests on all pages
  - Achieve 90+ scores across all categories
  - Fix performance bottlenecks
  - Optimize images (already done for logos)
  - Improve accessibility scores

- [ ] **Code cleanup**
  - Remove console.logs from production code
  - Standardize code formatting
  - Add JSDoc comments
  - Remove unused code/imports
  - Consolidate duplicate functions
  - Improve error handling consistency

---

## 🎨 **Visual & UX Polish**

### 📐 Layout & Styling
- [ ] Fix footer positioning (sticky/fixed at bottom)
- [ ] Ensure responsive design works on all screen sizes
- [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- [ ] Add loading spinners for async operations
- [ ] Improve button states (disabled, hover, active)
- [ ] Add success/error animations for form submissions

### ♿ Accessibility
- [x] ✅ **Hamburger menu accessibility (November 7, 2025)**
  - Menu items have tabindex="-1" and aria-hidden="true" when closed
  - Attributes removed only when menu expands
  - Proper keyboard navigation support
  - ARIA labels on hamburger button
- [ ] Add ARIA labels where needed (other pages)
- [ ] Ensure proper heading hierarchy
- [ ] Test with screen readers
- [ ] Verify keyboard navigation across all pages
- [ ] Check color contrast ratios
- [ ] Add focus indicators

---

## 📊 **Additional Features**

- [ ] **Analytics integration** (optional)
  - Track box provisioning trends
  - Monitor pickup request frequency
  - Volunteer activity metrics

- [ ] **Email notifications** (enhancement)
  - Improve email templates
  - Add volunteer preferences for notifications
  - Summary emails for daily activity

- [ ] **Export functionality**
  - Export box data to CSV
  - Export reports for record-keeping
  - Generate printable status reports

---

## 📝 **Notes**

- All completed items marked with ✅
- Top priorities marked with ⚠️
- Items can be broken into smaller subtasks as needed
- Review and update this list regularly

---

*Last Updated: November 10, 2025*
*Maintained with ❤️ for Marine Corps League Detachment #1311*
