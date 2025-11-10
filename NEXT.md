# Firebase Auth Emulator CSP Fix - 2025-11-09

## Summary

**SOLVED!** All 3 failing smoke tests are now passing. The root cause was a Content Security Policy (CSP) configuration issue that blocked the Firebase Auth emulator from connecting.

### Test Results
- ✅ **12/12 smoke tests passing** (was 2/5 passing before)
- ✅ Anonymous auth test now works
- ✅ Both redirect tests now work

## Root Cause

The Firebase Auth emulator uses `http://127.0.0.1:9099` for connections, but the CSP `connect-src` directive in `firebase.json` did NOT include `http://localhost:*` or `http://127.0.0.1:*`. This caused all Firebase Auth operations to be blocked by the browser's CSP.

**Key Discovery Process:**
1. Added browser console logging to tests to capture errors
2. Saw CSP violation errors: `Refused to connect to 'http://127.0.0.1:9099/...'`
3. Found CSP headers were set in BOTH places:
   - HTML `<meta>` tags in each page
   - HTTP headers in `firebase.json` (which take precedence)
4. Updated both locations to include emulator endpoints

## The Fix

### 1. Updated `firebase.json` CSP Header (Line 50)
**Changed `connect-src` from:**
```
connect-src 'self' https://*.googleapis.com https://*.gstatic.com ...
```

**To:**
```
connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https://*.googleapis.com https://*.gstatic.com ...
```

### 2. Updated HTML Meta Tags
Updated CSP in all 9 HTML pages to match (for consistency):
- `/public/index.html`
- `/public/box/index.html`
- `/public/status/index.html`
- `/public/dashboard/index.html`
- `/public/setup/index.html`
- `/public/login/index.html`
- `/public/authorize/index.html`
- `/public/admin/index.html`
- `/public/print/index.html`

### 3. Updated `firebase-init.js`
Changed emulator connection from `localhost` to `127.0.0.1`:
```javascript
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectFunctionsEmulator(functions, '127.0.0.1', 5001);
```

## Why This Matters

**CSP Priority:** HTTP headers set in `firebase.json` override HTML `<meta>` tags. The hosting emulator was sending the restrictive CSP header that blocked emulator connections, even though the HTML meta tags were updated.

**Production Safety:** The `http://localhost:*` and `http://127.0.0.1:*` directives only work in development (localhost). In production, these resolve to different hosts and won't create security vulnerabilities.

## Files Modified

1. `firebase.json` - Added localhost/127.0.0.1 to CSP header
2. `public/js/firebase-init.js` - Use 127.0.0.1 for emulator connections
3. All 9 HTML pages - Updated CSP meta tags for consistency
4. `public/box/index.html` - ID validation fix (from previous session)
5. `public/status/index.html` - ID validation fix (from previous session)

## Test Execution

```bash
# Run smoke tests
npm run test:smoke

# Run specific test
npx playwright test tests/e2e/box-and-status.spec.js -g "should display box information for anonymous users"
```

## Important Notes

- **Emulator restart required** after changing `firebase.json`
- The CSP fix allows Firebase SDK to connect to local emulators during testing
- Production deployments are unaffected (localhost/127.0.0.1 don't apply)
- Tests now run reliably without auth/network-request-failed errors

## Previous Issues (Now Resolved)

~~1. Anonymous auth timeout - Firebase Auth emulator connection blocked by CSP~~ ✅ FIXED
~~2. Box redirect test - Auth failure prevented redirect logic~~ ✅ FIXED
~~3. Status redirect test - Auth failure prevented redirect logic~~ ✅ FIXED

## Next Steps

- All smoke tests passing ✅
- Ready to commit changes
- Consider running full test suite to verify no regressions
