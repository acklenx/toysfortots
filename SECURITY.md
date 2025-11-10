# Security Documentation

This document describes the security measures implemented in this application and maintenance requirements.

## Content Security Policy (CSP)

### Overview

This application uses a strict Content Security Policy to protect against Cross-Site Scripting (XSS), clickjacking, and other code injection attacks. The CSP is configured in two places:

1. **HTTP Headers** (`firebase.json` lines 48-51) - Takes precedence, applies to all HTML pages
2. **HTML Meta Tags** (all `index.html` files) - Backup/documentation, consistent with HTTP headers

### CSP Configuration

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://unpkg.com;
  style-src 'self' 'unsafe-inline' https://unpkg.com;
  img-src 'self' data: https: blob:;
  font-src 'self' data: https://unpkg.com;
  connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:* https://*.googleapis.com https://*.gstatic.com https://unpkg.com https://*.cloudfunctions.net https://*.firebaseapp.com https://*.firebaseio.com https://*.google.com https://tile.openstreetmap.org wss://*.firebaseio.com;
  frame-src 'self' https://*.google.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self'
```

### Localhost/127.0.0.1 in Production CSP

**Why it's included:**

The CSP includes `http://localhost:*` and `http://127.0.0.1:*` in the `connect-src` directive to support Firebase Local Emulator Suite during development and testing.

**Security implications in production:**

✅ **SAFE** - These directives allow connections to localhost/127.0.0.1, which resolve to **the visitor's own machine**, NOT the production server.

**How it works:**
- **Development (localhost):** `firebase-init.js` detects `window.location.hostname === 'localhost'` and connects to emulators at `127.0.0.1:9099` (auth), `127.0.0.1:8080` (firestore), etc.
- **Production (toysfortots.mcl1311.com):** The localhost check fails, emulator connections are never attempted, Firebase SDK connects directly to production services at `*.googleapis.com`

**Risk assessment:**
- Allows JavaScript to connect to services on visitor's local machine only
- Does NOT expose production Firebase services or server infrastructure
- Standard practice for Firebase applications using Local Emulator Suite
- If visitor's machine is compromised (malware running on localhost), the malware already has full access - this CSP directive does not increase risk

### Maintaining CSP Security

**CRITICAL:** When modifying CSP, ensure BOTH locations are updated:

1. **Primary:** `firebase.json` → `hosting.headers[].value` (line 50)
2. **Secondary:** All HTML files → `<meta http-equiv="Content-Security-Policy">`

**Required for Firebase:**
- `'unsafe-inline'` in `script-src` and `style-src` - Firebase SDK uses inline scripts
- All Firebase domains in `connect-src` - Required for production Firebase services
- `https://unpkg.com` - Used for loading Leaflet maps library

**DO NOT remove:**
- `http://localhost:*` and `http://127.0.0.1:*` from `connect-src` - Required for emulator testing
- WebSocket endpoints (`ws://`, `wss://`) - Required for Firebase Realtime Database and Firestore

**When adding new external services:**
1. Add only necessary domains to appropriate directives
2. Update BOTH `firebase.json` and HTML meta tags
3. Test with CSP violations enabled in browser console
4. Document the reason in this file

## XSS (Cross-Site Scripting) Prevention

### Mandatory HTML Escaping

**Rule:** ALWAYS escape user-generated content before rendering with `innerHTML`.

**Escape function** (use in all pages displaying user data):
```javascript
const escapeHtml = (unsafe) => {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
```

**Usage:**
```javascript
// GOOD - Escaped
element.innerHTML = `<h2>${escapeHtml(location.label)}</h2>`;

// BAD - Vulnerable to XSS
element.innerHTML = `<h2>${location.label}</h2>`;
```

**Where to escape:**
- ALL Firestore data (locations, reports, user profiles, contact info)
- ALL URL parameters (boxId, search queries)
- ALL form inputs that get re-displayed
- ALL API responses from external services

**Safe alternatives to innerHTML:**
- `textContent` - Automatically escapes, use for plain text
- `setAttribute()` - Safe for attribute values
- `createElement()` + `appendChild()` - Safe DOM manipulation

**Testing XSS fixes:**
Use malicious payloads in test data:
- `<script>alert("XSS")</script>`
- `<img src=x onerror=alert("XSS")>`
- `<iframe src="javascript:alert('XSS')"></iframe>`

See `tests/e2e/box-and-status.spec.js` for XSS test examples.

## Firebase Security Rules

### Authentication vs Authorization

**Two-tier security model:**

1. **Authentication** (Firebase Auth)
   - Custom email domain: `{username}@toysfortots.mcl1311.com`
   - Google OAuth
   - Anonymous auth for public pages

2. **Authorization** (Firestore collection)
   - `authorizedVolunteers` collection validates volunteer access
   - Cloud Function `isAuthorizedVolunteerV2` checks authorization
   - Users auto-authorized when provisioning first box with passcode

### Firestore Security Rules

**Critical paths:**
- `artifacts/toysfortots-eae4d/public/01/data/01/locations` - Public read
- `artifacts/toysfortots-eae4d/public/01/data/01/totsReports` - Public create, volunteer read/update
- `artifacts/toysfortots-eae4d/private/01/data/01/authorizedVolunteers` - Volunteer access only

**DO NOT:**
- Expose `authorizedVolunteers` collection to public
- Allow public write access to `locations`
- Skip authorization checks in Cloud Functions

## Sensitive Data

### Never Log Sensitive Data

**Prohibited in console.log():**
- Passcodes
- Passwords
- API keys
- User authentication tokens
- Email addresses in error messages

**Environment variables** (stored in `functions/.env.local` for emulator):
- `MAILGUN_KEY` - Never commit to git
- `MAILGUN_DOMAIN` - Safe to commit
- `GEOCODING_API_KEY` - Never commit to git

### API Keys in Code

The Firebase `apiKey` in `firebase-init.js` is **safe to expose** - it identifies the Firebase project but does not grant access. Security is enforced by Firebase Security Rules.

## Additional Security Headers

Set in `firebase.json`:

- **X-Frame-Options: DENY** - Prevents clickjacking
- **X-Content-Type-Options: nosniff** - Prevents MIME sniffing
- **Referrer-Policy: strict-origin-when-cross-origin** - Limits referrer leakage
- **Permissions-Policy** - Restricts browser features (geolocation to self only, denies camera, mic, etc.)

## Rate Limiting

**Current status:** Not implemented in Cloud Functions

**Recommendation:** Add rate limiting to prevent abuse of:
- `provisionBoxV2` - Prevent passcode brute force
- `createReportV2` - Prevent report spam
- `sendReportEmail` - Prevent email bombing

## HTTPS Enforcement

Firebase Hosting automatically redirects HTTP to HTTPS in production.

**DO NOT:**
- Allow HTTP connections in production
- Disable HTTPS redirect in `firebase.json`

## Security Testing

### Running Security Tests

```bash
# XSS prevention tests
npx playwright test tests/e2e/box-and-status.spec.js -g "XSS"

# Full test suite
npm run test:smart
```

### Production Security Checks

```bash
# Test production security headers
npm run test:production
```

Verifies:
- CSP headers present
- No console errors
- JavaScript executes (not blocked by CSP)
- Critical user paths work

## Security Incidents

### Reporting

Report security vulnerabilities to: toysfortots@qlamail.com

**DO NOT:**
- Open public GitHub issues for security vulnerabilities
- Discuss vulnerabilities in public channels before patching

### Response Process

1. Assess severity and impact
2. Develop and test patch
3. Deploy to production immediately if critical
4. Document in SECURITY.md
5. Notify users if data exposure occurred

## Maintenance Checklist

When modifying the application:

- [ ] Update CSP in BOTH `firebase.json` AND HTML files
- [ ] Escape ALL user-generated content with `escapeHtml()`
- [ ] Test with malicious XSS payloads
- [ ] Run security tests before committing
- [ ] Never commit API keys or secrets
- [ ] Review Firestore Security Rules if changing data model
- [ ] Test HTTPS redirect still works
- [ ] Verify auth/authorization checks in Cloud Functions

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Rules Documentation](https://firebase.google.com/docs/rules)
- [Content Security Policy Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

---

**Last Updated:** 2025-11-09
**Last Security Review:** 2025-11-09
