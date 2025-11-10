# Admin Panel Architecture

**Purpose:** Overview of admin panel data flow, state management, and component organization

**Related:** [ISSUE_1.md](../ISSUE_1.md) | [REALTIME_LISTENERS.md](REALTIME_LISTENERS.md)

**File:** `/public/admin/index.html` (2619 lines, single-file architecture)

---

## Overview

The admin panel is a single-page application that provides real-time management of:
- **Boxes** (donation locations)
- **Reports** (status reports for boxes)
- **Volunteers** (authorized users)
- **Audit Logs** (track destructive operations)

**Key Features:**
- Real-time updates via Firebase onSnapshot listeners
- Role-based access control (volunteer/admin/root)
- Soft delete with audit logging
- Search, filter, sort, pagination
- CSV export
- Responsive design

---

## Global State

### Authentication & Authorization

```javascript
let currentUser = null;           // Firebase auth user object
let currentUserRole = 'volunteer'; // User's role: 'volunteer', 'admin', or 'root'
```

**Roles:**
- **volunteer**: Can view dashboard, edit data, mark reports cleared
- **admin**: Can soft delete items, view audit logs
- **root**: Can purge (hard delete), view/restore deleted items

### Data Collections

```javascript
// Master arrays (all items from Firestore)
let allBoxes = [];
let allReports = [];
let allVolunteers = [];

// Filtered/sorted arrays (what user sees)
let filteredBoxes = [];
let filteredReports = [];
let filteredVolunteers = [];

// Autocomplete data from Google Sheets
let locationSuggestions = [];
```

### State Flags

```javascript
// Track initial load completion
let boxesInitialLoadComplete = false;
let reportsInitialLoadComplete = false;
let volunteersInitialLoadComplete = false;

// Root user features
let showingDeleted = false; // Toggle for viewing soft-deleted items

// UI state
let currentEditBoxId = null;
let currentEditVolunteerId = null;
let confirmCallback = null;
```

### Pagination & Sorting

```javascript
const PAGE_SIZE = 20;
let currentBoxesPage = 1;
let currentReportsPage = 1;
let currentVolunteersPage = 1;

let boxesSortColumn = null;
let boxesSortDirection = 'asc';
// ... similar for reports and volunteers
```

---

## Data Flow

### 1. Page Load Sequence

```
┌─────────────────┐
│  Page Loads     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auth Check      │ onAuthStateChanged()
│ (Firebase Auth) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Authorization   │ isAuthorizedVolunteerV2()
│ Check           │ Get user role from Firestore
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Load Data       │ loadBoxes()
│                 │ loadReports()
│                 │ loadVolunteers()
│                 │ loadAuditLogs()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Setup Listeners │ onSnapshot() for each collection
│ (Real-time)     │ Initial data + live updates
└─────────────────┘
```

### 2. Real-Time Update Flow

```
Firestore Change
     │
     ▼
onSnapshot() fires
     │
     ├──── Initial Load? ────────┐
     │                           │
     │ Yes                       │ No
     ▼                           ▼
Build complete array      Use docChanges()
allBoxes = []             ├─ added
forEach doc:              ├─ modified
  allBoxes.push(doc)      └─ removed
     │                           │
     └──────────┬────────────────┘
                │
                ▼
      Update global state
      (allBoxes/allReports/etc)
                │
                ▼
      Filter & Sort
      (apply search, filters)
                │
                ▼
      Paginate
      (split into pages)
                │
                ▼
      Render to DOM
      (update table HTML)
```

### 3. Operation Flow (e.g. Soft Delete)

```
User clicks Delete
     │
     ▼
Show confirmation dialog
     │
     ▼
Update Firestore
(set deleted: true)
     │
     ▼
Log to auditLogs
     │
     ▼
⚠️ ISSUE: Old code called loadBoxes() here
         (creates duplicate listener)
     │
     ▼
onSnapshot() fires automatically
(detects the change)
     │
     ▼
docChanges() = 'modified'
     │
     ▼
Update allBoxes array
     │
     ▼
Re-filter & render
```

---

## Load Functions

### loadBoxes()

**Location:** Line ~1029
**Purpose:** Initialize real-time listener for locations collection

**Flow:**
1. Build Firestore query: `query(locationsRef, orderBy('created', 'desc'))`
2. Setup search/export event handlers (one-time)
3. Create onSnapshot listener
4. On initial snapshot: Build complete `allBoxes` array
5. On subsequent snapshots: Handle incremental changes via docChanges()
6. Filter deleted items (if `showingDeleted` is false)
7. Call `filterAndRenderBoxes()`

**Known Issue:** ⚠️ Creates new listener every call without cleanup

### loadReports()

**Location:** Line ~1384
**Similar pattern to loadBoxes()**

**Special logic:**
- Groups reports by boxId
- Shows latest pending report per box
- Filters by status ('new' vs 'cleared')

### loadVolunteers()

**Location:** Line ~1584
**Similar pattern to loadBoxes()**

**Special features:**
- Calculates "undeployed" count (volunteers in spreadsheet but not in Firestore)
- Shows role badges (volunteer/admin/root)
- Hides root user from regular admins

### loadAuditLogs()

**Purpose:** Load audit trail of operations (admin/root only)

**Special features:**
- Filtered by date range
- Shows operation type, user, target, timestamp
- Supports pagination

---

## Filter & Render Pipeline

### filterAndRenderBoxes()

**Location:** Line ~1184

**Steps:**
1. **Filter by search term** (label, address, city, state, volunteer name)
2. **Filter by soft delete** (hide if `deleted: true` unless `showingDeleted`)
3. **Sort** by selected column and direction
4. **Paginate** (split into pages of 20 items)
5. **Render** current page to DOM

**Performance:**
- Filters 100+ items in <5ms
- Uses case-insensitive string matching
- Debounced search (updates as you type)

### renderBoxesPage()

**Location:** Line ~1250

**HTML Generation:**
```javascript
const html = boxes.map(box => `
  <tr data-box-id="${box.id}">
    <td><a href="/box?id=${escapeHtml(box.id)}">${escapeHtml(box.id)}</a></td>
    <td>${escapeHtml(box.label)}</td>
    <!-- ... more columns ... -->
    <td>
      <button onclick="editBox('${box.id}')">Edit</button>
      <button onclick="deleteBox('${box.id}', '${escapeHtml(box.label)}')">Delete</button>
    </td>
  </tr>
`).join('');
```

**Security:** All user data escaped via `escapeHtml()` to prevent XSS

---

## Operations

### Soft Delete

**Functions:**
- `deleteBox(boxId, label)` - Delete single box
- Bulk delete via "Delete All" button

**Flow:**
1. Show confirmation dialog with warning
2. Update Firestore: `updateDoc(docRef, { deleted: true, deletedAt, deletedBy })`
3. Log audit: `logAudit(AUDIT_ACTIONS.DELETE_BOX, currentUser, details)`
4. ⚠️ **Old code:** Called `loadBoxes()` (creates duplicate listener)
5. ✅ **Fixed:** Removed call, rely on onSnapshot auto-update

**Result:**
- Item disappears from list (filtered out by `deleted: true`)
- Audit log created
- Can be restored by root user

### Purge (Hard Delete)

**Functions:**
- `purgeDeletedBoxes()` - Permanently delete soft-deleted items
- Root user only

**Flow:**
1. Query for items with `deleted: true`
2. Show confirmation with count
3. Delete documents using `deleteDoc()`
4. Log audit
5. ✅ **Fixed:** Removed `loadBoxes()` call

### Edit

**Functions:**
- `editBox(boxId)` - Open edit modal
- Save button handler

**Flow:**
1. Populate modal with current data
2. User edits fields
3. Update Firestore: `updateDoc(docRef, updatedFields)`
4. ⚠️ **Old code:** Called `loadBoxes()`
5. ✅ **Fixed:** Removed call

### Toggle "Show Deleted Items"

**Root user only**

**Flow:**
1. User checks/unchecks toggle
2. Set `showingDeleted` = checked
3. Save to localStorage
4. **Current implementation:** Call `window.location.reload()`
5. On reload: Restore toggle state from localStorage
6. Load functions filter based on `showingDeleted`

**Why reload?**
- Avoids calling `loadBoxes()` which would create duplicate listener
- Temporary workaround until proper listener cleanup implemented

---

## UI Components

### Confirmation Dialog

**Function:** `showConfirmation(title, message, callback)`

**Usage:**
```javascript
showConfirmation(
  'Delete Box',
  'Soft delete this box? Can be restored by root users.',
  async () => {
    // Perform delete operation
  }
);
```

### Edit Modals

- Box edit modal: `#edit-box-modal`
- Volunteer edit modal: `#edit-volunteer-modal`

**Pattern:**
1. Show modal with current data
2. User edits
3. Save button calls operation function
4. Hide modal
5. Data updates via onSnapshot listener

### Search Bars

Each table has a search input that filters as you type:
- `#boxes-search`
- `#reports-search`
- `#volunteers-search`

**Implementation:**
```javascript
searchInput.addEventListener('input', () => {
  filterAndRenderBoxes(); // Re-filter and render
});
```

---

## Performance Optimizations

### 1. Pagination

Only render 20 items per page instead of all items:
```javascript
const startIdx = (currentPage - 1) * PAGE_SIZE;
const endIdx = startIdx + PAGE_SIZE;
const pageItems = filteredBoxes.slice(startIdx, endIdx);
```

### 2. Incremental Updates

Use `docChanges()` instead of rebuilding entire array:
```javascript
snapshot.docChanges().forEach(change => {
  if (change.type === 'added') {
    allBoxes.push(box);
  } else if (change.type === 'modified') {
    const index = allBoxes.findIndex(b => b.id === box.id);
    allBoxes[index] = box;
  } else if (change.type === 'removed') {
    allBoxes = allBoxes.filter(b => b.id !== box.id);
  }
});
```

### 3. Animations

Flash animations show what changed:
- **Green flash** = new item added
- **Yellow flash** = item modified
- **Red fade** = item removed

**Implementation:**
```javascript
row.classList.add('flashing'); // Triggers CSS animation
setTimeout(() => row.classList.remove('flashing'), 3000);
```

### 4. Load Time Indicator

Shows how fast data loaded:
```javascript
const loadTime = Math.round(performance.now() - loadStart);
const cacheIndicator = loadTime < 300 ? ' 🚀 (cached)' : '';
```

---

## Security

### XSS Prevention

All user-generated content escaped before rendering:
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
innerHTML = `<td>${escapeHtml(box.label)}</td>`;
```

### RBAC Checks

**Client-side:**
```javascript
if (!['admin', 'root'].includes(currentUserRole)) {
  // Hide admin features
}
```

**Server-side (Firestore Rules):**
```javascript
allow delete: if isRoot();
allow update: if isAdmin();
```

### Audit Logging

All destructive operations logged:
```javascript
await logAudit(AUDIT_ACTIONS.DELETE_BOX, currentUser, {
  targetId: boxId,
  targetType: 'box',
  targetLabel: label
});
```

---

## Known Issues

### Issue #1: Duplicate Listeners (ACTIVE)

**See:** [ISSUE_1.md](../ISSUE_1.md)

**Symptoms:**
- Items duplicate in display after operations
- Multiple onSnapshot listeners accumulate

**Root Cause:**
- `loadBoxes()` creates new listener without unsubscribing from old one
- Each listener fires independently → duplicates in array

**Status:** In progress - fixes applied but bug persists

### Issue #2: No Deleted Field Filtering (TEMPORARY)

**Status:** Intentional workaround

**Impact:** Soft-deleted items visible to all users (if they exist)

**Firestore Rules:**
```javascript
// Temporarily disabled:
allow get, list: if request.auth != null;

// Should be:
allow get, list: if request.auth != null &&
                    (resource == null || resource.data.deleted != true);
```

**Fix:** Restore rules after Issue #1 is resolved

---

## File Structure

```
/public/admin/index.html (2619 lines)
├─ HTML Structure (lines 1-750)
│  ├─ Boxes table
│  ├─ Reports table
│  ├─ Volunteers table
│  ├─ Audit logs table
│  └─ Modals (edit, confirmation)
│
├─ JavaScript (lines 750-2619)
│  ├─ Global Variables (750-850)
│  ├─ Auth & Authorization (850-900)
│  ├─ Load Functions (900-1800)
│  │  ├─ loadBoxes()
│  │  ├─ loadReports()
│  │  ├─ loadVolunteers()
│  │  └─ loadAuditLogs()
│  │
│  ├─ Filter & Render (1800-1950)
│  │  ├─ filterAndRenderBoxes()
│  │  ├─ filterAndRenderReports()
│  │  └─ filterAndRenderVolunteers()
│  │
│  ├─ Operations (1950-2250)
│  │  ├─ Edit operations
│  │  ├─ Delete operations (soft delete)
│  │  └─ Bulk operations
│  │
│  ├─ Purge Operations (2250-2550)
│  │  └─ Root-only hard delete
│  │
│  └─ Event Handlers (2550-2619)
│     ├─ Search bars
│     ├─ Export buttons
│     └─ Show deleted toggle
```

---

## Dependencies

### Firebase SDK (v11.6.1)
- `firebase-app.js`
- `firebase-auth.js`
- `firebase-firestore.js`
- `firebase-functions.js`

### Custom Modules
- `/js/firebase-init.js` - Firebase configuration
- `/js/audit-logger.js` - Audit logging helper

### CSS
- `/css/style.css` - Global styles
- Inline styles for admin-specific components

---

## Future Improvements

### 1. Split Into Components
Extract sections into separate files:
- `boxes-manager.js`
- `reports-manager.js`
- `volunteers-manager.js`
- `audit-logs-viewer.js`

### 2. Use Framework
Consider migrating to React/Vue for:
- Better state management
- Component reusability
- Easier testing

### 3. Implement Proper Listener Cleanup
**See:** [LISTENER_CLEANUP_PATTERN.md](LISTENER_CLEANUP_PATTERN.md)

Add ListenerManager class to prevent accumulation

### 4. Add Tests
E2E tests for:
- Soft delete operations
- Purge operations
- Role-based access control
- Search/filter functionality

### 5. Optimize Bundle Size
Current: Single 2619-line file
Could split into modules and use bundler

---

## Debugging Tips

### Check Active Listeners

Add to console:
```javascript
let listenerCount = 0;
function loadBoxes() {
  console.log('Creating listener #' + ++listenerCount);
  // ...
}
```

**Expected:** 3-4 listeners (boxes, reports, volunteers, auditLogs)
**Problem:** Count keeps increasing

### Inspect Global State

```javascript
// In browser console:
console.log('Boxes:', allBoxes.length);
console.log('Filtered:', filteredBoxes.length);
console.log('Current page:', currentBoxesPage);
console.log('Role:', currentUserRole);
```

### Check for Duplicates

```javascript
const ids = allBoxes.map(b => b.id);
const uniqueIds = new Set(ids);
if (ids.length !== uniqueIds.size) {
  console.error('DUPLICATES DETECTED');
  console.log('Duplicate IDs:', ids.filter((id, i) => ids.indexOf(id) !== i));
}
```

---

## References

- [ISSUE_1.md](../ISSUE_1.md) - Active bug tracker
- [REALTIME_LISTENERS.md](REALTIME_LISTENERS.md) - Technical details on listeners
- [LISTENER_CLEANUP_PATTERN.md](LISTENER_CLEANUP_PATTERN.md) - Implementation guide
- [CLAUDE.md](../CLAUDE.md) - Project documentation
- [NEXT.md](../NEXT.md) - Session notes and history
