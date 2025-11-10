# Security Documentation

This document describes the security measures implemented in this application and maintenance requirements that **MUST** be followed by all contributors - human developers, AI assistants, and automated tools.

## 🔒 Critical Security Rules

### 1. XSS (Cross-Site Scripting) Prevention

**ALWAYS escape user-generated content before rendering in HTML.**

#### Escape Function
Use this in all pages displaying user data:
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

#### ✅ GOOD - Escaped
```javascript
element.innerHTML = `<h2>${escapeHtml(location.label)}</h2>`;
element.innerHTML = `<p>${escapeHtml(report.description)}</p>`;
```

#### ❌ BAD - Vulnerable to XSS
```javascript
element.innerHTML = `<h2>${location.label}</h2>`; // DANGEROUS!
```

#### Where to Escape
- **ALL** data from Firestore (locations, reports, volunteers, audit logs)
- **ALL** URL parameters (boxId, search queries)
- **ALL** form inputs that are re-displayed
- **ALL** API responses from external services
- **ALL** Google Sheets data (location suggestions)

#### Safe Alternatives to innerHTML
- `textContent` - Automatically escapes HTML, use for plain text
- `setAttribute()` - Safe for attribute values
- `createElement()` + `appendChild()` - Safe DOM manipulation

#### Testing XSS Fixes
Test with malicious payloads:
```javascript
const xssPayloads = [
  '<script>alert("XSS")</script>',
  '<img src=x onerror=alert("XSS")>',
  '<iframe src="javascript:alert(\'XSS\')"></iframe>'
];
```

See `tests/e2e/box-and-status.spec.js` for XSS test examples.

### 2. Role-Based Access Control (RBAC)

**NOT all volunteers have the same permissions.**

#### User Roles
- **volunteer** (default): Can provision boxes, resolve reports, view dashboard
- **admin**: Can delete data, manage volunteers, access admin panel
- **root** (hidden): Super admin role for Quincy Acklen only
  - Email: `acklenx@gmail.com` OR displayName: `Quincy Acklen`
  - Cannot be deleted or modified by others
  - Can purge soft deletes and audit logs
  - **Displayed as "admin" in UI** (never show "root")

#### Critical RBAC Rules
- ✅ **ALWAYS** check authorization server-side (Firestore rules + Cloud Functions)
- ✅ **NEVER** rely solely on client-side role checks
- ✅ **NEVER** expose the root role in UI (display as "admin")
- ✅ Root user **CANNOT** be deleted or have role modified
- ✅ Users **CANNOT** modify their own role
- ✅ Admins **CANNOT** modify or delete the root user
- ✅ Volunteers **CANNOT** access admin panel or delete data

#### Checking Roles (Firestore Rules)
```javascript
function getUserRole() {
  let volunteer = get(/databases/$(database)/documents/artifacts/toysfortots-eae4d/private/01/data/01/authorizedVolunteers/$(request.auth.uid));
  return volunteer.data.role;
}

function isVolunteer() {
  return exists(/databases/$(database)/documents/artifacts/toysfortots-eae4d/private/01/data/01/authorizedVolunteers/$(request.auth.uid));
}

function isAdmin() {
  return getUserRole() in ['admin', 'root'];
}

function isRoot() {
  return getUserRole() == 'root';
}
```

#### Checking Roles (Client-Side)
```javascript
// Get user's role from Firestore
const volunteerDoc = await getDoc(doc(db, authorizedVolunteersCollectionPath, user.uid));
const userRole = volunteerDoc.data().role || 'volunteer';

// Check permissions
if (!['admin', 'root'].includes(userRole)) {
  // Deny access
}

// NEVER display root role
const displayRole = userRole === 'root' ? 'admin' : userRole;
```

### 3. Soft Deletes (Data Protection)

**NEVER permanently delete data unless you are the root user performing a purge operation.**

#### Why Soft Deletes?
- Protects against malicious deletions by insiders
- Allows data recovery from mistakes
- Maintains audit trail
- Compliance with data retention policies

#### Implementation
```javascript
// ✅ GOOD - Soft delete (reversible)
await updateDoc(docRef, {
  deleted: true,
  deletedAt: FieldValue.serverTimestamp(),
  deletedBy: currentUser.uid
});

// ❌ BAD - Hard delete (irreversible, root only!)
await deleteDoc(docRef); // Only for root user purging
```

#### Querying with Soft Deletes
```javascript
// Client-side filtering
const snapshot = await getDocs(query(collectionRef));
snapshot.forEach(doc => {
  const data = doc.data();
  if (data.deleted && !showingDeleted) return; // Skip deleted items
  // ... process document
});

// Firestore rules filtering
allow list, get: if request.auth != null &&
                    (resource == null || resource.data.deleted == false);
```

#### Restoring Soft Deleted Items
```javascript
// Root user only
await updateDoc(docRef, {
  deleted: false,
  restoredAt: FieldValue.serverTimestamp(),
  restoredBy: currentUser.uid
});
```

#### Purging (Hard Delete)
```javascript
// ROOT USER ONLY - Irreversible!
if (currentUserRole === 'root') {
  // Confirm with user first
  if (!confirm('PERMANENTLY DELETE? This cannot be undone!')) return;

  await deleteDoc(docRef); // Permanent deletion

  // Log the purge
  await logAudit(AUDIT_ACTIONS.PURGE_SOFT_DELETES, currentUser, {
    targetId: docId,
    targetType: 'box'
  });
}
```

### 4. Audit Logging

**ALL destructive and sensitive operations MUST be logged.**

#### What to Log
- ✅ Box deletions (individual and bulk)
- ✅ Volunteer deletions
- ✅ Report deletions
- ✅ Data modifications (box edits, volunteer role changes)
- ✅ Failed authorization attempts
- ✅ Data export operations
- ✅ Purge operations (hard deletes)

#### How to Log
```javascript
import { logAudit, AUDIT_ACTIONS } from '/js/audit-logger.js';

// Example: Logging a box deletion
await logAudit(AUDIT_ACTIONS.DELETE_BOX, currentUser, {
  targetId: boxId,
  targetType: 'box',
  targetLabel: boxLabel
});

// Example: Logging bulk operation
await logAudit(AUDIT_ACTIONS.DELETE_BOX_BULK, currentUser, {
  targetType: 'box',
  count: deletedBoxes.length
});

// Example: Logging role change
await logAudit(AUDIT_ACTIONS.MODIFY_VOLUNTEER_ROLE, currentUser, {
  targetId: volunteerId,
  targetType: 'volunteer',
  changes: { oldRole: 'volunteer', newRole: 'admin' }
});
```

#### Audit Log Schema
```javascript
{
  action: string,           // 'delete_box', 'modify_volunteer_role', etc.
  userId: string,
  userEmail: string,
  userDisplayName: string,
  timestamp: serverTimestamp,
  details: {
    targetId: string,       // ID of affected resource
    targetType: string,     // 'box', 'report', 'volunteer'
    targetLabel: string,    // Readable name
    changes: object,        // What changed (for updates)
    count: number           // For bulk operations
  },
  deleted: false,           // Audit logs can be soft deleted too
  deletedAt: timestamp,
  deletedBy: uid
}
```

#### Audit Log Immutability
- Audit logs are **immutable** (cannot be edited)
- Only root user can soft delete audit logs
- Only root user can purge (hard delete) audit logs
- Audit logging failures should **NEVER** throw errors that break operations

#### Handling Audit Log Failures
```javascript
export async function logAudit(action, user, details) {
  try {
    // ... log to Firestore
  } catch (error) {
    console.error('Failed to log audit:', error);
    // Don't throw - audit failure shouldn't break the operation
  }
}
```

### 5. Input Validation

**ALL user input MUST be validated on both client and server.**

#### Server-Side Validation (Cloud Functions)
```javascript
function validateInput(field, value, rules) {
  if (rules.required && (!value || value.trim() === '')) {
    throw new HttpsError('invalid-argument', `${field} is required`);
  }
  if (value && rules.maxLength && value.length > rules.maxLength) {
    throw new HttpsError('invalid-argument', `${field} too long`);
  }
  if (value && rules.pattern && !rules.pattern.test(value)) {
    throw new HttpsError('invalid-argument', `${field} format invalid`);
  }
}

// Example usage
validateInput('Email', email, {
  required: true,
  maxLength: 320,
  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
});

validateInput('Box ID', boxId, {
  required: true,
  maxLength: 100,
  pattern: /^[A-Z0-9_-]+$/i
});
```

#### Validation Rules
- **Email**: RFC 5322 pattern, max 320 chars
- **Phone**: Flexible format allowing various styles
- **Box ID**: Alphanumeric, hyphens, underscores only
- **Label**: 1-200 chars
- **Address**: 3-500 chars
- **All strings**: Always trim whitespace before saving

### 6. Secrets Management

**NEVER commit secrets to git or expose them in client code.**

#### ✅ GOOD - Use Firebase Functions params
```javascript
const MAILGUN_KEY = defineString('MAILGUN_KEY');
const apiKey = MAILGUN_KEY.value();
```

#### ❌ BAD - Hardcoded secrets
```javascript
const apiKey = 'sk-1234567890abcdef'; // NEVER DO THIS
```

#### Rules
- ✅ Store secrets in Firebase Functions params or `.env.local`
- ✅ Firebase public API key in client code is **safe** (designed to be public)
- ❌ **NEVER** commit `.env.local` to git
- ❌ **NEVER** log secrets to console (passcodes, API keys, etc.)
- ❌ **NEVER** include secrets in error messages

#### Environment Variables
Stored in `functions/.env.local` for emulator:
- `MAILGUN_KEY` - **Never commit to git**
- `MAILGUN_DOMAIN` - Safe to commit
- `GEOCODING_API_KEY` - **Never commit to git**

### 7. Firestore Security Rules

**Security rules are your last line of defense - make them strict.**

#### Default Deny
```javascript
match /{document=**} {
  allow read, write: if false; // Deny everything by default
}
```

#### Explicit Allow with Conditions
```javascript
match /locations/{boxId} {
  // Only show non-deleted items
  allow get, list: if request.auth != null &&
                      (resource == null || resource.data.deleted == false);

  // Only Cloud Functions can create
  allow create: if false;

  // Admins can soft delete
  allow update: if isAdmin() &&
                   request.resource.data.deleted == true &&
                   resource.data.deleted == false;

  // Only root can hard delete (purge)
  allow delete: if isRoot();
}
```

#### Testing Security Rules
```bash
# Run tests with emulator
npx playwright test

# Test specific scenarios
npx playwright test tests/e2e/admin.spec.js -g "RBAC"
```

### 8. Content Security Policy (CSP)

**CSP headers protect against XSS, clickjacking, and code injection.**

#### Configuration
Set in `firebase.json` (lines 48-51):
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

#### Localhost in Production CSP
**Safe** - `localhost:*` and `127.0.0.1:*` resolve to the visitor's own machine, not the server.
- Development: `firebase-init.js` detects localhost and connects to emulators
- Production: Check fails, connects to production Firebase services

#### Required for Firebase
- `'unsafe-inline'` in `script-src` and `style-src` - Firebase SDK uses inline scripts
- Firebase domains in `connect-src` - Required for Firebase services
- `https://unpkg.com` - Leaflet maps library

#### When Adding External Services
1. Add only necessary domains to appropriate directives
2. Test with CSP violations enabled in browser console
3. Document the reason in this file

### 9. Additional Security Headers

Set in `firebase.json`:
- **X-Frame-Options: DENY** - Prevents clickjacking
- **X-Content-Type-Options: nosniff** - Prevents MIME sniffing
- **Referrer-Policy: strict-origin-when-cross-origin** - Limits referrer leakage
- **Permissions-Policy** - Restricts browser features (geolocation to self only, denies camera, mic, etc.)

### 10. Dependencies

**Keep dependencies up to date and audit regularly.**

```bash
# Check for vulnerabilities
npm audit
cd functions && npm audit

# Update dependencies
npm update
cd functions && npm update
```

#### Rules
- ✅ Run `npm audit` before every deployment
- ✅ Update dependencies monthly
- ✅ Review changelogs for breaking changes
- ❌ **NEVER** ignore audit warnings without investigation

## 🚨 Security Incidents

### Reporting
Report security vulnerabilities to: **acklenx@gmail.com**

**DO NOT:**
- Open public GitHub issues for security vulnerabilities
- Discuss vulnerabilities in public channels before patching

### Response Process
1. Assess severity and impact
2. Develop and test patch
3. Deploy to production immediately if critical
4. Document in SECURITY.md
5. Notify users if data exposure occurred

## 📋 Pre-Deployment Security Checklist

Before deploying to production:

- [ ] All user input is escaped before rendering (`escapeHtml()`)
- [ ] All destructive operations log to audit
- [ ] Firestore security rules tested with emulator
- [ ] `npm audit` shows 0 vulnerabilities (main and functions)
- [ ] Secrets not hardcoded or committed
- [ ] Role checks enforced server-side (rules + functions)
- [ ] Soft deletes implemented for all data types
- [ ] CSP headers configured correctly
- [ ] XSS protection verified with test payloads
- [ ] RBAC tested for all user roles (volunteer, admin, root)
- [ ] Root user cannot be deleted or modified
- [ ] Migration script run (if adding RBAC features)

## 🤖 AI Assistant Guidelines

If you are an AI assistant working on this codebase:

### ALWAYS Do
1. Read this file and `CLAUDE.md` before making changes
2. Use `escapeHtml()` when inserting user data into HTML
3. Log destructive operations to audit
4. Implement soft deletes, not hard deletes
5. Validate input on both client and server
6. Check user role before allowing admin operations
7. Test security changes thoroughly

### NEVER Do
1. Bypass security rules "for convenience"
2. Remove existing security measures
3. Expose the root role in UI
4. Commit secrets or sensitive data
5. Skip testing security changes
6. Hardcode passwords, API keys, or passcodes
7. Allow volunteers to delete data or modify roles

When in doubt, ask the user or err on the side of being more secure.

## 📚 Additional Resources

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Firebase Security Rules Guide**: https://firebase.google.com/docs/rules
- **XSS Prevention Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- **Content Security Policy**: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- **RBAC Best Practices**: https://auth0.com/docs/manage-users/access-control/rbac

## 📝 Document History

**Version**: 2.0
**Last Updated**: 2025-11-09
**Last Security Review**: 2025-11-09
**Maintained By**: Quincy Acklen (acklenx@gmail.com)

**Major Changes**:
- v2.0 (2025-11-09): Added RBAC, soft deletes, audit logging
- v1.0 (2025-11-09): Initial security documentation (CSP, XSS, Firebase rules)

---

**Remember**: Security is not a feature, it's a requirement. Follow these practices religiously.
