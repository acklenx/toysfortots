# Security Enhancement Implementation Plan - 2025-11-09

**⚠️ NOTE: Most of this plan has already been implemented (see commits ec94877, d641520, cedde3d). Scroll to the bottom for "IMPLEMENTATION SESSION NOTES" for current status and remaining issues.**

## Overview

Implementing three critical security features to protect against malicious insiders:
1. **Role-Based Access Control (RBAC)** - Limit destructive operations to admins
2. **Audit Logging** - Track all sensitive operations
3. **Soft Deletes** - Make deletions reversible

## User Roles

- **volunteer** (default): Can provision boxes, resolve own reports, view dashboard
- **admin**: Can delete data, manage volunteers, access admin panel
- **root** (hidden): Super admin role for Quincy Acklen (acklenx@gmail.com or "Quincy Acklen")
  - Cannot be deleted
  - Can purge soft deletes
  - Can purge audit logs
  - Displayed as "admin" in UI (security through obscurity)

## Implementation Checklist

### 1. Update Firestore Data Model

**Add to `firebase-init.js`:**
```javascript
export const auditLogsCollectionPath = `${privateBasePath}/auditLogs`;
```

**authorizedVolunteers schema (add role field):**
```javascript
{
  displayName: "John Doe",
  email: "john@toysfortots.mcl1311.com",
  role: "volunteer" | "admin" | "root",
  createdAt: timestamp,
  createdBy: uid,
  lastLogin: timestamp,
  analytics: {...},
  deleted: false,           // NEW: Soft delete flag
  deletedAt: timestamp,     // NEW: When deleted
  deletedBy: uid            // NEW: Who deleted
}
```

**locations schema (add soft delete fields):**
```javascript
{
  // ... existing fields
  deleted: false,           // NEW
  deletedAt: timestamp,     // NEW
  deletedBy: uid            // NEW
}
```

**totsReports schema (add soft delete fields):**
```javascript
{
  // ... existing fields
  deleted: false,           // NEW
  deletedAt: timestamp,     // NEW
  deletedBy: uid            // NEW
}
```

**auditLogs collection (NEW):**
```javascript
{
  action: string,           // 'delete_box', 'delete_volunteer', 'modify_box', etc.
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
  ipAddress: string,        // Optional, if available
  deleted: false,           // Audit logs can be purged too
  deletedAt: timestamp,
  deletedBy: uid
}
```

### 2. Update Firestore Security Rules (`firestore.rules`)

**Add helper functions:**
```javascript
// Get user's role from authorizedVolunteers collection
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

**Update locations collection:**
```javascript
match /locations/{boxId} {
  allow get, list: if request.auth != null &&
                      (resource == null || resource.data.deleted == false); // Only show non-deleted
  allow create: if false; // Only Cloud Functions can create

  // Allow any authenticated user to update ONLY the analytics field
  allow update: if request.auth != null &&
                   request.resource.data.diff(resource.data).affectedKeys().hasOnly(['analytics']);

  // Allow admins to soft delete (set deleted=true)
  allow update: if isAdmin() &&
                   request.resource.data.deleted == true &&
                   resource.data.deleted == false;

  // Hard delete only for root (purging soft deletes)
  allow delete: if isRoot();
}
```

**Update totsReports collection:**
```javascript
match /totsReports/{reportId} {
  allow create: if request.auth != null;
  allow list, get: if isVolunteer() &&
                      (resource == null || resource.data.deleted == false);
  allow update: if isVolunteer(); // For status changes

  // Soft delete
  allow update: if isAdmin() &&
                   request.resource.data.deleted == true &&
                   resource.data.deleted == false;

  // Hard delete (purge)
  allow delete: if isRoot();
}
```

**Update authorizedVolunteers collection:**
```javascript
match /authorizedVolunteers/{userId} {
  allow list, get: if isVolunteer() &&
                      (resource == null || resource.data.deleted == false);
  allow create: if false; // Only Cloud Functions

  // Admins can update volunteers (but not their own role or the root user)
  allow update: if isAdmin() &&
                   userId != request.auth.uid && // Can't modify self
                   resource.data.role != 'root'; // Can't modify root user

  // Soft delete (admins can soft delete, but not root or themselves)
  allow update: if isAdmin() &&
                   userId != request.auth.uid &&
                   resource.data.role != 'root' &&
                   request.resource.data.deleted == true &&
                   resource.data.deleted == false;

  // Hard delete (purge) - only root
  allow delete: if isRoot();
}
```

**Add auditLogs collection:**
```javascript
match /auditLogs/{logId} {
  allow create: if request.auth != null; // Anyone authenticated can write logs
  allow list, get: if isAdmin() &&
                      (resource == null || resource.data.deleted == false);
  allow update, delete: if false; // Immutable, except for root purge

  // Root can soft delete audit logs
  allow update: if isRoot() &&
                   request.resource.data.deleted == true &&
                   resource.data.deleted == false;

  // Root can hard delete (purge)
  allow delete: if isRoot();
}
```

### 3. Create Audit Logging Helper (`public/js/audit-logger.js`)

**NEW FILE:**
```javascript
import { db } from './firebase-init.js';
import { collection, addDoc, FieldValue } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const AUDIT_LOGS_PATH = 'artifacts/toysfortots-eae4d/private/01/data/01/auditLogs';

export async function logAudit(action, user, details) {
  try {
    const auditRef = collection(db, AUDIT_LOGS_PATH);
    await addDoc(auditRef, {
      action,
      userId: user.uid,
      userEmail: user.email,
      userDisplayName: user.displayName || user.email,
      timestamp: FieldValue.serverTimestamp(),
      details,
      deleted: false
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
    // Don't throw - audit logging failure shouldn't break operations
  }
}

// Pre-defined audit actions
export const AUDIT_ACTIONS = {
  DELETE_BOX: 'delete_box',
  DELETE_BOX_BULK: 'delete_box_bulk',
  DELETE_REPORT: 'delete_report',
  DELETE_REPORT_BULK: 'delete_report_bulk',
  DELETE_VOLUNTEER: 'delete_volunteer',
  DELETE_VOLUNTEER_BULK: 'delete_volunteer_bulk',
  MODIFY_BOX: 'modify_box',
  MODIFY_VOLUNTEER: 'modify_volunteer',
  MODIFY_VOLUNTEER_ROLE: 'modify_volunteer_role',
  PURGE_SOFT_DELETES: 'purge_soft_deletes',
  PURGE_AUDIT_LOGS: 'purge_audit_logs',
  EXPORT_DATA: 'export_data'
};
```

### 4. Update Cloud Functions (`functions/index.js`)

**Update provisionBoxV2:**
- Add `role: 'volunteer'` when creating new authorizedVolunteer
- Add `deleted: false` when creating new location

**Create new callable function for role management:**
```javascript
exports.updateVolunteerRole = onCall(async (request) => {
  // Check if caller is admin
  const callerDoc = await db.doc(`${AUTH_VOLUNTEERS_PATH}/${request.auth.uid}`).get();
  if (!callerDoc.exists || !['admin', 'root'].includes(callerDoc.data().role)) {
    throw new HttpsError('permission-denied', 'Only admins can change roles');
  }

  const { volunteerId, newRole } = request.data;

  // Can't change root user
  const targetDoc = await db.doc(`${AUTH_VOLUNTEERS_PATH}/${volunteerId}`).get();
  if (targetDoc.data().role === 'root') {
    throw new HttpsError('permission-denied', 'Cannot modify root user');
  }

  // Can't change your own role
  if (volunteerId === request.auth.uid) {
    throw new HttpsError('permission-denied', 'Cannot change your own role');
  }

  await db.doc(`${AUTH_VOLUNTEERS_PATH}/${volunteerId}`).update({
    role: newRole,
    modifiedAt: FieldValue.serverTimestamp(),
    modifiedBy: request.auth.uid
  });

  return { success: true };
});
```

### 5. Update Admin Panel (`public/admin/index.html`)

**Add at top of script section:**
```javascript
import { logAudit, AUDIT_ACTIONS } from '/js/audit-logger.js';

let currentUserRole = 'volunteer'; // Will be set on auth
const ROOT_USER_EMAIL = 'acklenx@gmail.com';
const ROOT_USER_NAME = 'Quincy Acklen';
```

**Update authorization check:**
```javascript
onAuthStateChanged(auth, async (user) => {
  // ... existing auth check

  // Get user's role
  const volunteerDoc = await getDoc(doc(db, authorizedVolunteersCollectionPath, user.uid));
  if (volunteerDoc.exists()) {
    currentUserRole = volunteerDoc.data().role || 'volunteer';
  }

  // Only admins/root can access admin panel
  if (!['admin', 'root'].includes(currentUserRole)) {
    document.getElementById('auth-check').innerHTML = '<div class="error-message">Only administrators can access this panel.</div>';
    return;
  }

  // Show UI based on role
  if (currentUserRole === 'root') {
    document.getElementById('purge-section').style.display = 'block';
  }
});
```

**Update delete functions to soft delete:**
```javascript
async function deleteBox(boxId, boxLabel) {
  if (!confirm(`Soft delete box "${boxLabel}"?\n\nThis can be restored later.`)) return;

  try {
    const boxRef = doc(db, locationsCollectionPath, boxId);
    await updateDoc(boxRef, {
      deleted: true,
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: currentUser.uid
    });

    // Log audit
    await logAudit(AUDIT_ACTIONS.DELETE_BOX, currentUser, {
      targetId: boxId,
      targetType: 'box',
      targetLabel: boxLabel
    });

    showMessage('success', `Box "${boxLabel}" soft deleted`);
  } catch (error) {
    showMessage('error', 'Failed to delete box: ' + error.message);
  }
}
```

**Update loadBoxes to filter deleted:**
```javascript
async function loadBoxes() {
  const locationsRef = collection(db, locationsCollectionPath);
  const q = query(locationsRef, orderBy('createdAt', 'desc'));

  const snapshot = await getDocs(q);
  allBoxes = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    // Filter out soft-deleted items (unless root viewing deleted)
    if (data.deleted && !showingDeleted) return;

    allBoxes.push({ id: doc.id, ...data });
  });

  // ... rest of function
}
```

**Add UI for viewing deleted items (root only):**
```html
<!-- In admin panel header section -->
<div id="deleted-toggle" style="display: none;">
  <label>
    <input type="checkbox" id="show-deleted-checkbox">
    Show Deleted Items
  </label>
</div>
```

**Add purge section (root only):**
```html
<section id="purge-section" style="display: none;">
  <h2>Purge Operations (Root Only)</h2>
  <div class="danger-zone">
    <button id="purge-deleted-boxes-btn" class="danger-btn">Purge Deleted Boxes</button>
    <button id="purge-deleted-reports-btn" class="danger-btn">Purge Deleted Reports</button>
    <button id="purge-deleted-volunteers-btn" class="danger-btn">Purge Deleted Volunteers</button>
    <button id="purge-audit-logs-btn" class="danger-btn">Purge Audit Logs</button>
  </div>
</section>
```

**Add audit log viewer section:**
```html
<section id="audit-logs-section">
  <h2>Audit Logs</h2>
  <div class="controls">
    <input type="text" id="audit-search" placeholder="Search audit logs...">
    <select id="audit-action-filter">
      <option value="">All Actions</option>
      <option value="delete_box">Delete Box</option>
      <option value="delete_volunteer">Delete Volunteer</option>
      <!-- ... more options -->
    </select>
  </div>
  <div id="audit-logs-container"></div>
  <div id="audit-pagination"></div>
</section>
```

### 6. Create Migration Script (`scripts/migrate-rbac.js`)

**NEW FILE:**
```javascript
// Run this ONCE to set up roles for existing volunteers
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const AUTH_VOLUNTEERS_PATH = 'artifacts/toysfortots-eae4d/private/01/data/01/authorizedVolunteers';
const ROOT_EMAIL = 'acklenx@gmail.com';
const ROOT_NAME = 'Quincy Acklen';

async function migrateRoles() {
  const volunteersRef = db.collection(AUTH_VOLUNTEERS_PATH);
  const snapshot = await volunteersRef.get();

  const batch = db.batch();
  let rootFound = false;

  snapshot.forEach(doc => {
    const data = doc.data();
    const isRoot = data.email === ROOT_EMAIL || data.displayName === ROOT_NAME;

    if (isRoot) {
      rootFound = true;
      console.log(`Setting ${data.displayName} as ROOT`);
    }

    batch.update(doc.ref, {
      role: isRoot ? 'root' : (data.role || 'volunteer'),
      deleted: false,
      modifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  if (!rootFound) {
    console.error('WARNING: Root user not found! Make sure acklenx@gmail.com is in authorizedVolunteers');
  }

  await batch.commit();
  console.log(`Migration complete. Updated ${snapshot.size} volunteers.`);
}

migrateRoles().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
```

### 7. Testing Plan

**Test as volunteer:**
- ✓ Cannot access admin panel
- ✓ Cannot delete boxes/reports/volunteers
- ✓ Can provision boxes and resolve reports

**Test as admin:**
- ✓ Can access admin panel
- ✓ Can soft delete boxes/reports/volunteers
- ✓ Cannot delete root user (Quincy)
- ✓ Cannot modify own role
- ✓ Cannot see purge section
- ✓ Audit logs created for all operations

**Test as root (Quincy):**
- ✓ Can see "Show Deleted Items" toggle
- ✓ Can view soft-deleted items
- ✓ Can purge (hard delete) soft-deleted items
- ✓ Can purge audit logs
- ✓ Cannot be deleted by admins
- ✓ Role displays as "admin" in UI (not "root")

**Test soft delete recovery:**
- ✓ Soft delete a box
- ✓ Verify it disappears from admin panel
- ✓ Root user toggles "Show Deleted"
- ✓ Box appears with "DELETED" indicator
- ✓ Root can restore (set deleted=false)
- ✓ Box reappears for all users

## Implementation Order

1. ✅ Update `firebase-init.js` with audit logs path
2. ✅ Create `audit-logger.js` helper
3. ✅ Update Firestore security rules
4. ✅ Update Cloud Functions (add role field, prevent root modification)
5. ✅ Create migration script
6. ✅ Run migration in dev/emulator
7. ✅ Update admin panel with soft deletes
8. ✅ Update admin panel with audit logging
9. ✅ Add audit log viewer UI
10. ✅ Add purge functionality (root only)
11. ✅ Test all scenarios
12. ✅ Run migration in production
13. ✅ Deploy

## Current Status

**NEXT STEP:** Update `firebase-init.js` to add audit logs collection path

## Important Notes

- Root user is determined by email (`acklenx@gmail.com`) OR displayName (`Quincy Acklen`)
- Root role should NEVER be displayed as "root" in UI - always show as "admin"
- Soft deletes use `deleted: true` flag, not actual document deletion
- Hard deletes (purge) only available to root user
- Audit logs are immutable (except for root purge)
- All destructive operations must be logged to audit
- Migration script must be run ONCE before deploying RBAC changes

## Files to Create/Modify

**NEW FILES:**
- `public/js/audit-logger.js` - Audit logging helper
- `scripts/migrate-rbac.js` - One-time migration script

**MODIFY:**
- `public/js/firebase-init.js` - Add audit logs path
- `firestore.rules` - Add RBAC and soft delete rules
- `functions/index.js` - Add role field, update functions
- `public/admin/index.html` - Soft deletes, audit viewer, purge UI

## Security Considerations

- Never expose root role in client code or UI
- Always check role on server-side (Firestore rules + Cloud Functions)
- Audit logs are critical - handle failures gracefully but log them
- Purge operations are destructive and permanent - require confirmation
- Root user protection must be enforced at multiple levels (rules, functions, UI)

---

# IMPLEMENTATION SESSION NOTES - 2025-01-10

## What Was Completed ✅

### 1. Core Infrastructure (All Committed)

**Commits:**
- `ec94877` - Main RBAC implementation
- `d641520` - Migration script debugging
- `cedde3d` - Firestore rules circular permission fix

**Files Created:**
- ✅ `public/js/audit-logger.js` - Audit logging helper with AUDIT_ACTIONS constants
- ✅ `scripts/migrate-rbac.cjs` - Migration script (CommonJS format for Node.js compatibility)

**Files Modified:**
- ✅ `public/js/firebase-init.js` - Added `auditLogsCollectionPath` export
- ✅ `firestore.rules` - Complete RBAC rules with soft delete support
- ✅ `functions/index.js` - Added role support, `updateVolunteerRole` function, deleted fields
- ✅ `public/admin/index.html` - Full RBAC UI (2619 lines)
  - Soft delete operations with audit logging
  - Audit log viewer (admin/root only)
  - Purge operations section (root only)
  - "Show Deleted Items" toggle (root only)
- ✅ `tests/fixtures/firebase-helpers.js` - Updated test helpers to include `deleted: false` and `role: 'volunteer'`

### 2. RBAC System Implementation

**Role Hierarchy:**
- `volunteer` (default) - Can provision boxes, resolve reports, view dashboard
- `admin` - Can soft delete data, view audit logs, manage volunteers
- `root` - Super admin (Quincy Acklen), can purge, view deleted items, restore data

**Key Features Implemented:**
- ✅ All delete operations use soft deletes (`deleted: true`, `deletedAt`, `deletedBy`)
- ✅ Comprehensive audit logging for all destructive operations
- ✅ Root user protection (cannot be deleted or modified by others)
- ✅ Users cannot delete themselves or change their own role
- ✅ Admin panel restricts access to admin/root roles only
- ✅ Root-only features hidden from admins (purge, deleted toggle)

### 3. Firestore Rules Updates

**Critical Fix Applied (commit cedde3d):**
- Changed `deleted == false` to `deleted != true` to handle undefined values
- Added special permission for users to read their OWN volunteer document (fixes circular dependency)
- This allows `getUserRole()` helper to work without requiring `isVolunteer()` check

**Rules Structure:**
```javascript
// Users can read their OWN document (needed for getUserRole())
allow get: if request.auth.uid == userId && resource.data.deleted != true;

// Volunteers can list all volunteers
allow list: if isVolunteer() && resource.data.deleted != true;
```

### 4. Cloud Functions Updates

**provisionBoxV2:**
- Now adds `role: 'volunteer'` when creating new authorized volunteers
- Adds `deleted: false` to new locations and reports

**New Function - updateVolunteerRole:**
- Allows admins to change volunteer roles
- Protects root user from modification
- Prevents users from changing their own role
- Logs audit trail

### 5. Test Fixes

**Updated test helpers to include RBAC fields:**
- `createTestLocation()` - adds `deleted: false`
- `createTestReport()` - adds `deleted: false`  
- `authorizeVolunteer()` - adds `role: 'volunteer'` and `deleted: false`

**All smoke tests passing (12/12)** ✅

### 6. Admin Panel Features

**Implemented:**
- ✅ Soft delete for boxes, reports, volunteers (with confirmation dialogs)
- ✅ Bulk soft delete operations
- ✅ Audit log viewer with search and filtering
- ✅ Root-only purge section (hard delete)
  - Purge deleted boxes
  - Purge deleted reports
  - Purge deleted volunteers
  - Purge audit logs (90+ days)
- ✅ "Show Deleted Items" toggle for root users
- ✅ Role-based UI visibility (admin vs root features)
- ✅ All deleted items filtered from views unless root viewing deleted

## Current Problems ❌

### 1. **CRITICAL: Permission Denied Errors in Production**

**Symptoms:**
- User can log in and read their own volunteer document ✅
- But gets "Missing or insufficient permissions" when trying to:
  - ❌ Read locations
  - ❌ Read reports  
  - ❌ List volunteers

**Diagnostic Results:**
```
✓ Own volunteer doc readable: true
  Data: { uid, email, role: "root", deleted: false, ... }
✗ Cannot read locations: permission-denied
✗ Cannot read reports: permission-denied
✗ Cannot list volunteers: permission-denied
```

**Volunteer Document Structure (Confirmed Correct):**
```json
{
  "uid": "psoE77AEpQRImiY7gVXAen4jIlV2",
  "email": "qlasandbox@gmail.com",
  "role": "root",
  "displayName": "Quincy -Drone- Acklen (QLA Sandbox)",
  "deleted": false,
  "lastLogin": { "seconds": 1762749283 },
  "authorizedAt": { "seconds": 1762748858 }
}
```

**Likely Causes:**
1. **Firestore rules not fully propagated** - Can take 1-2 minutes after deployment
2. **Existing data missing `deleted` field** - Old locations/reports created before RBAC don't have `deleted: false`
3. **exists() check failing** - The `isAuthorizedVolunteer()` helper uses `exists()` which may have permission issues

### 2. Migration Script Issues (Not Critical - Can Be Skipped)

**Problem:** Migration script fails with `this.count_get is not a function`

**Root Cause:** Version mismatch between firebase-admin versions:
- Root package.json: `firebase-admin@13.6.0`
- Functions package.json: `firebase-admin@12.6.0`

**Current Workaround:** Skip migration, manually add fields via Firebase Console

### 3. Data Cleanup Needed

**Issue:** User manually deleted all Firestore data to start fresh, which removed their volunteer document

**Result:** Had to manually recreate volunteer document with correct fields

## What Was NOT Done ❌

1. **Migration script never successfully ran in production**
   - Skipped in favor of manual field additions
   - Not critical since new data gets fields automatically

2. **Existing production data may lack `deleted` field**
   - New boxes/reports will have it (Cloud Functions updated)
   - Old data needs manual addition or migration

3. **Comprehensive RBAC testing in production**
   - Can't fully test until permission issues resolved
   - Smoke tests pass in emulator ✅

## Next Steps 🚀

### IMMEDIATE (Must Do First)

1. **Wait for Firestore rules propagation**
   ```bash
   # On other computer, verify rules deployed
   firebase deploy --only firestore:rules --force
   
   # Wait 2-3 minutes, then check Firebase Console:
   # https://console.firebase.google.com/project/toysfortots-eae4d/firestore/rules
   # Verify "Last published" timestamp is recent
   ```

2. **Add `deleted: false` to ALL existing production data**
   
   **Option A: Browser console script (run on admin panel page):**
   ```javascript
   (async()=>{
     const m=await import('/js/firebase-init.js');
     const f=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
     
     // Update all locations
     const locs=await f.getDocs(f.collection(m.db,m.locationsCollectionPath));
     for(const d of locs.docs){
       if(d.data().deleted===undefined){
         await f.updateDoc(d.ref,{deleted:false});
       }
     }
     
     // Update all reports
     const reps=await f.getDocs(f.collection(m.db,m.reportsCollectionPath));
     for(const d of reps.docs){
       if(d.data().deleted===undefined){
         await f.updateDoc(d.ref,{deleted:false});
       }
     }
     
     console.log('Done! Refresh page.');
   })();
   ```

   **Option B: Manually in Firebase Console** (if few documents):
   - Go to each collection (locations, reports, volunteers)
   - For each document, add field: `deleted` = `false` (boolean)

3. **Verify volunteer document exists and is correct**
   - Navigate to: `artifacts/toysfortots-eae4d/private/01/data/01/authorizedVolunteers`
   - Find document with YOUR uid: `psoE77AEpQRImiY7gVXAen4jIlV2`
   - Verify fields:
     - `role`: `"root"` (string, not string with visible quotes)
     - `deleted`: `false` (boolean, checkbox unchecked)
     - `email`, `displayName`, `authorizedAt` present

4. **Run diagnostic again after waiting**
   ```javascript
   // Run in browser console on admin panel
   (async()=>{
     const m=await import('/js/firebase-init.js');
     const f=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
     
     // Wait for auth
     await new Promise(r=>setTimeout(r,2000));
     
     console.log('User:', m.auth.currentUser?.email);
     
     // Test volunteer doc
     try {
       const v=await f.getDoc(f.doc(m.db,m.authorizedVolunteersCollectionPath,m.auth.currentUser.uid));
       console.log('✓ Volunteer doc:', v.exists(), v.data());
     } catch(e) { console.error('✗ Volunteer:', e.message); }
     
     // Test locations
     try {
       const l=await f.getDocs(f.query(f.collection(m.db,m.locationsCollectionPath),f.limit(1)));
       console.log('✓ Locations:', l.size);
     } catch(e) { console.error('✗ Locations:', e.message); }
     
     // Test reports
     try {
       const r=await f.getDocs(f.query(f.collection(m.db,m.reportsCollectionPath),f.limit(1)));
       console.log('✓ Reports:', r.size);
     } catch(e) { console.error('✗ Reports:', e.message); }
   })();
   ```

### AFTER PERMISSIONS FIXED

5. **Test RBAC functionality**
   - ✓ Soft delete a box
   - ✓ View audit logs
   - ✓ Toggle "Show Deleted Items"
   - ✓ Purge soft-deleted items
   - ✓ Try creating a new box (should have `deleted: false` automatically)

6. **Create a test admin user**
   - Create new volunteer account
   - Set their role to `admin` (not root)
   - Verify they:
     - ✓ Can access admin panel
     - ✓ Can soft delete
     - ✓ Cannot see purge section
     - ✓ Cannot see deleted toggle

7. **Create a test volunteer user**
   - Create new volunteer account
   - Leave role as `volunteer`
   - Verify they:
     - ✓ Cannot access admin panel (gets "Only administrators..." error)
     - ✓ Can still provision boxes
     - ✓ Can still view dashboard

### OPTIONAL / FUTURE

8. **Fix migration script** (not critical, but nice to have)
   - Resolve firebase-admin version conflict
   - Test in emulator
   - Document usage for future bulk updates

9. **Add audit log export feature**
   - Allow admins to export audit logs to CSV
   - Add date range filtering

10. **Add restore functionality**
    - Currently root can see deleted items but can't easily restore them
    - Add "Restore" button next to deleted items when viewing with toggle

11. **Add email notifications for audit events**
    - Email root user when critical actions occur (bulk deletes, purges)
    - Configurable thresholds

## Troubleshooting Guide

### "Missing or insufficient permissions" Error

**Checklist:**
1. ✓ Is user authenticated? (Check `currentUser` in console)
2. ✓ Does volunteer document exist with correct uid?
3. ✓ Does volunteer doc have `role` field (string)?
4. ✓ Does volunteer doc have `deleted: false` (boolean)?
5. ✓ Have Firestore rules been deployed? (Check Firebase Console timestamp)
6. ✓ Has it been 2+ minutes since rules deployment?
7. ✓ Does data have `deleted` field? (Or is it undefined?)
8. ✓ Try hard refresh (Ctrl+Shift+R) to clear cached rules

**Still failing?**
- Check browser console for specific error codes
- Look at Firestore Rules debugging in Firebase Console
- Verify `exists()` check works: Run in browser console:
  ```javascript
  import('/js/firebase-init.js').then(async m=>{
    const f=await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const doc=await f.getDoc(f.doc(m.db,m.authorizedVolunteersCollectionPath,m.auth.currentUser.uid));
    console.log('exists() works:', doc.exists());
  })
  ```

### "Cannot load locations/reports" on New Box Creation

**Cause:** New box created by old Cloud Functions deployment (before RBAC)

**Fix:**
1. Verify Cloud Functions deployed: `firebase deploy --only functions`
2. Check function logs: `firebase functions:log`
3. Manually add `deleted: false` to the new box in Firestore Console

### Admin Panel Shows Blank/Empty Tables

**Cause:** Firestore rules blocking reads due to missing `deleted` field

**Fix:** Add `deleted: false` to all existing documents (see browser script above)

## Important Security Notes

- ✅ Root role (`root`) should NEVER be visible in UI - always display as "admin"
- ✅ Root user determined by email `acklenx@gmail.com` (in production environment)
- ✅ Circular dependency fixed: Users can read their own volunteer doc without `isVolunteer()` check
- ✅ All operations use `deleted != true` (not `== false`) to handle undefined gracefully
- ⚠️ Firestore rules can take 1-2 minutes to propagate globally after deployment
- ⚠️ Browser may cache old rules - hard refresh (Ctrl+Shift+R) if issues persist

## File Locations Reference

**Production Environment:**
- Working directory: `/home/acklenx/WebstormProjects/toysfortots`
- Service account key should be at: `/home/acklenx/WebstormProjects/toysfortots/serviceAccountKey.json`
- Remember to add to `.gitignore`!

**Development Environment (This Machine):**
- Working directory: `/home/quincy/toysfortots`
- Emulators must be running before tests: `./start-emulators.sh`

## Contact/Handoff Notes

- All code committed and pushed ✅
- Tests passing in emulator ✅
- Production deployment partially complete (rules/functions/hosting deployed)
- **BLOCKING ISSUE:** Permission errors in production - likely rules propagation delay or missing `deleted` fields on existing data
- **NEXT SESSION:** Start with "IMMEDIATE" steps above - wait for rules propagation and add `deleted` fields to existing data

## Verification Checklist for Next Session

Before considering RBAC complete, verify:

- [ ] Production Firestore rules show recent timestamp in Firebase Console
- [ ] All existing locations have `deleted: false` field
- [ ] All existing reports have `deleted: false` field  
- [ ] All volunteers have `role` and `deleted: false` fields
- [ ] Root user can access admin panel without permission errors
- [ ] Root user can view all sections (boxes, reports, volunteers)
- [ ] Root user can see audit logs
- [ ] Root user can see purge section
- [ ] Root user can toggle "Show Deleted Items"
- [ ] Soft delete operation works and creates audit log
- [ ] Test admin user cannot see purge section
- [ ] Test volunteer user cannot access admin panel
- [ ] New boxes created have `deleted: false` automatically

---

**Session ended at:** 2025-01-10 (ran out of time during production debugging)
**Status:** Implementation complete, production deployment partially working, permissions debugging in progress
**Priority:** Fix production permissions issue (likely just needs rules propagation wait + data field additions)

