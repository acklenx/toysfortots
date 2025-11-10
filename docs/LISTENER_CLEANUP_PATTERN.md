# Listener Cleanup Implementation Guide

**Purpose:** Step-by-step guide to implement proper listener cleanup in admin panel

**Related:** [ISSUE_1.md](../ISSUE_1.md) | [REALTIME_LISTENERS.md](REALTIME_LISTENERS.md)

---

## Quick Start

If you just want to fix the bug quickly, jump to [Solution 1: Simple Pattern](#solution-1-simple-pattern-recommended).

If you want a robust, maintainable solution, use [Solution 2: Listener Manager](#solution-2-listener-manager-pattern-best).

---

## Solution 1: Simple Pattern (Recommended)

### Overview

Add 4 global variables to store unsubscribe functions, then modify the 4 load functions to clean up before creating new listeners.

**Time to implement:** ~15 minutes
**Lines of code:** ~20
**Difficulty:** Easy

### Step 1: Add Global Variables

**Location:** `/public/admin/index.html` around line 804 (after other global variables)

```javascript
let currentUserRole = 'volunteer';
let currentEditBoxId = null;
let currentEditVolunteerId = null;
let confirmCallback = null;
let showingDeleted = localStorage.getItem('showingDeleted') === 'true';

// ADD THESE FOUR LINES:
let boxesUnsubscribe = null;
let reportsUnsubscribe = null;
let volunteersUnsubscribe = null;
let auditLogsUnsubscribe = null;

const ROOT_USER_EMAIL = 'acklenx@gmail.com';
const ROOT_USER_NAME = 'Quincy Acklen';
```

### Step 2: Modify loadBoxes()

**Location:** Line ~1029

**Find this:**
```javascript
function loadBoxes() {
  try {
    const loadStart = performance.now();
    const locationsRef = collection(db, locationsCollectionPath);
    const q = query(locationsRef, orderBy('created', 'desc'));

    // Setup one-time event listeners
    const searchInput = document.getElementById('boxes-search');
    searchInput.addEventListener('input', () => filterAndRenderBoxes());
    const exportBtn = document.getElementById('export-boxes-btn');
    exportBtn.addEventListener('click', () => exportBoxesToCSV());

    // Real-time listener
    onSnapshot(q, (snapshot) => {
```

**Change to:**
```javascript
function loadBoxes() {
  try {
    // Clean up old listener
    if (boxesUnsubscribe) {
      console.log('🧹 Cleaning up old boxes listener');
      boxesUnsubscribe();
      boxesUnsubscribe = null;
    }

    const loadStart = performance.now();
    const locationsRef = collection(db, locationsCollectionPath);
    const q = query(locationsRef, orderBy('created', 'desc'));

    // Setup one-time event listeners
    const searchInput = document.getElementById('boxes-search');
    searchInput.addEventListener('input', () => filterAndRenderBoxes());
    const exportBtn = document.getElementById('export-boxes-btn');
    exportBtn.addEventListener('click', () => exportBoxesToCSV());

    // Real-time listener - store unsubscribe function
    boxesUnsubscribe = onSnapshot(q, (snapshot) => {
```

**Key changes:**
1. Added cleanup block at the start
2. Changed `onSnapshot(` to `boxesUnsubscribe = onSnapshot(`

### Step 3: Modify loadReports()

**Location:** Line ~1384

**Find this:**
```javascript
async function loadReports() {
  const startTime = performance.now();
  const reportsRef = collection(db, reportsCollectionPath);

  // Real-time listener
  onSnapshot(reportsRef, (snapshot) => {
```

**Change to:**
```javascript
async function loadReports() {
  // Clean up old listener
  if (reportsUnsubscribe) {
    console.log('🧹 Cleaning up old reports listener');
    reportsUnsubscribe();
    reportsUnsubscribe = null;
  }

  const startTime = performance.now();
  const reportsRef = collection(db, reportsCollectionPath);

  // Real-time listener - store unsubscribe function
  reportsUnsubscribe = onSnapshot(reportsRef, (snapshot) => {
```

### Step 4: Modify loadVolunteers()

**Location:** Line ~1584

**Find this:**
```javascript
async function loadVolunteers() {
  const volunteersRef = collection(db, authorizedVolunteersCollectionPath);

  onSnapshot(volunteersRef, (snapshot) => {
```

**Change to:**
```javascript
async function loadVolunteers() {
  // Clean up old listener
  if (volunteersUnsubscribe) {
    console.log('🧹 Cleaning up old volunteers listener');
    volunteersUnsubscribe();
    volunteersUnsubscribe = null;
  }

  const volunteersRef = collection(db, authorizedVolunteersCollectionPath);

  // Store unsubscribe function
  volunteersUnsubscribe = onSnapshot(volunteersRef, (snapshot) => {
```

### Step 5: Modify loadAuditLogs()

**Location:** Search for `async function loadAuditLogs()`

**Add cleanup at the start:**
```javascript
async function loadAuditLogs() {
  // Clean up old listener
  if (auditLogsUnsubscribe) {
    console.log('🧹 Cleaning up old audit logs listener');
    auditLogsUnsubscribe();
    auditLogsUnsubscribe = null;
  }

  // ... rest of function
  auditLogsUnsubscribe = onSnapshot(q, (snapshot) => {
```

### Step 6: Add Cleanup on Page Unload (Optional but Recommended)

**Location:** End of script section, before `</script>`

```javascript
// Cleanup listeners when page unloads
window.addEventListener('beforeunload', () => {
  console.log('🧹 Page unloading - cleaning up all listeners');
  if (boxesUnsubscribe) boxesUnsubscribe();
  if (reportsUnsubscribe) reportsUnsubscribe();
  if (volunteersUnsubscribe) volunteersUnsubscribe();
  if (auditLogsUnsubscribe) auditLogsUnsubscribe();
});
```

### Step 7: Restore loadBoxes/loadReports/loadVolunteers Calls

Now that we have proper cleanup, we can RESTORE the calls we removed!

**Locations to restore:**
- Line 1957: `loadBoxes();` (after edit box)
- Line 1988: `loadBoxes();` (after soft delete)
- Line 2026: `loadBoxes();` (after bulk delete)
- Line 2054: `loadReports();` (after delete report)
- Line 2092: `loadReports();` (after bulk delete reports)
- Line 2139: `loadVolunteers();` (after edit volunteer)
- Line 2189: `loadVolunteers();` (after delete volunteer)
- Line 2233: `loadVolunteers();` (after bulk delete volunteers)

**Change:**
```javascript
// Don't call loadBoxes() - the real-time listener will handle updates automatically
```

**Back to:**
```javascript
loadBoxes();
```

**Why restore them?**
- With proper cleanup, calling loadBoxes() is safe
- Provides immediate UI refresh (better UX)
- Simpler than relying only on listener updates

### Testing

1. Deploy code
2. Clear browser cache (or use Incognito)
3. Load admin panel
4. Open console - should see: "🧹 Cleaning up old boxes listener" (only on reload, not on first load)
5. Soft delete a box
6. Should see: "🧹 Cleaning up old boxes listener"
7. Verify: No duplicates!

---

## Solution 2: Listener Manager Pattern (Best)

### Overview

Create a centralized ListenerManager class that handles all listener lifecycle management.

**Time to implement:** ~30 minutes
**Lines of code:** ~60
**Difficulty:** Medium
**Benefits:** Easier debugging, better maintainability, cleaner code

### Step 1: Add ListenerManager Class

**Location:** After global variables (~line 810)

```javascript
const ROOT_USER_EMAIL = 'acklenx@gmail.com';
const ROOT_USER_NAME = 'Quincy Acklen';

// ==================== LISTENER MANAGER ====================

class ListenerManager {
  constructor() {
    this.listeners = new Map();
    this.debug = true; // Set to false in production
  }

  subscribe(name, unsubscribeFn) {
    // Clean up old listener if exists
    if (this.listeners.has(name)) {
      if (this.debug) console.log(`🧹 Unsubscribing from ${name}`);
      this.listeners.get(name)();
    }

    // Store new unsubscribe function
    this.listeners.set(name, unsubscribeFn);
    if (this.debug) console.log(`✅ Subscribed to ${name}`);
  }

  unsubscribe(name) {
    if (this.listeners.has(name)) {
      if (this.debug) console.log(`🧹 Unsubscribing from ${name}`);
      this.listeners.get(name)();
      this.listeners.delete(name);
    }
  }

  unsubscribeAll() {
    if (this.debug) console.log(`🧹 Unsubscribing from all listeners (${this.listeners.size})`);
    this.listeners.forEach((unsubscribe, name) => {
      if (this.debug) console.log(`  → ${name}`);
      unsubscribe();
    });
    this.listeners.clear();
  }

  getActiveCount() {
    return this.listeners.size;
  }

  getActiveNames() {
    return Array.from(this.listeners.keys());
  }
}

// Global instance
const listenerManager = new ListenerManager();

// Make available in console for debugging
window.listenerManager = listenerManager;
```

### Step 2: Modify Load Functions

**Pattern for all load functions:**

```javascript
function loadBoxes() {
  try {
    // ... existing code to build query

    // Create listener and register with manager
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // ... existing snapshot handler
    });

    // Register with manager (replaces old listener automatically)
    listenerManager.subscribe('boxes', unsubscribe);

  } catch (error) {
    // ... error handling
  }
}
```

**Apply to:**
- `loadBoxes()` → name: 'boxes'
- `loadReports()` → name: 'reports'
- `loadVolunteers()` → name: 'volunteers'
- `loadAuditLogs()` → name: 'auditLogs'

### Step 3: Add Page Unload Cleanup

```javascript
window.addEventListener('beforeunload', () => {
  listenerManager.unsubscribeAll();
});
```

### Step 4: Add Debug Commands (Optional)

Makes debugging easier - check listener status in console:

```javascript
// Make these available globally
window.debugListeners = () => {
  console.log('Active listeners:', listenerManager.getActiveCount());
  console.log('Names:', listenerManager.getActiveNames());
};

window.cleanupListeners = () => {
  listenerManager.unsubscribeAll();
};
```

**Usage in browser console:**
```javascript
debugListeners()
// Active listeners: 3
// Names: ['boxes', 'reports', 'volunteers']

cleanupListeners()
// Manually clean up all listeners
```

### Step 5: Enhanced Debugging

Add listener invocation tracking:

```javascript
class ListenerManager {
  constructor() {
    this.listeners = new Map();
    this.invocations = new Map(); // Track how many times each listener fires
    this.debug = true;
  }

  subscribe(name, unsubscribeFn) {
    // ... existing code

    // Wrap unsubscribe to track invocations
    const wrappedUnsubscribe = () => {
      unsubscribeFn();
      this.invocations.delete(name);
    };

    this.listeners.set(name, wrappedUnsubscribe);
    this.invocations.set(name, 0);
  }

  recordInvocation(name) {
    const count = (this.invocations.get(name) || 0) + 1;
    this.invocations.set(name, count);
    if (this.debug) console.log(`📊 ${name} listener fired (${count} times)`);
  }

  getStats() {
    const stats = {};
    this.invocations.forEach((count, name) => {
      stats[name] = count;
    });
    return stats;
  }
}
```

**Usage in load functions:**
```javascript
const unsubscribe = onSnapshot(q, (snapshot) => {
  listenerManager.recordInvocation('boxes');
  // ... rest of handler
});
```

**Check stats:**
```javascript
console.log(listenerManager.getStats());
// { boxes: 5, reports: 3, volunteers: 2 }
```

---

## Testing Both Solutions

### Basic Test

1. Load admin panel
2. Check console for cleanup messages
3. Perform soft delete
4. Verify no duplicates
5. Check console: Should see cleanup + new listener created

### Stress Test

```javascript
// Run in browser console
async function stressTest() {
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    loadBoxes();
    console.log(`Iteration ${i+1}: Active listeners = ${listenerManager.getActiveCount()}`);
  }
}

stressTest();
```

**Expected:** Active listener count stays at 1 (for boxes)
**Problem:** Count increases = listeners accumulating

### Memory Leak Test

```javascript
// Open Performance tab in DevTools
// Take heap snapshot
// Run operations
// Take another heap snapshot
// Compare - should see minimal growth
```

---

## Troubleshooting

### Still Seeing Duplicates

1. **Check console for cleanup messages**
   - If you DON'T see "🧹 Cleaning up..." → Code not deployed or cached
   - Clear cache aggressively or use Incognito

2. **Verify only one listener per type**
   ```javascript
   console.log(listenerManager.getActiveCount()); // Should be 3 or 4
   ```

3. **Check if old code is running**
   ```javascript
   // Should be defined if new code is running
   console.log(typeof listenerManager); // "object"
   ```

### Cleanup Not Working

1. **Check unsubscribe function is saved**
   ```javascript
   console.log(typeof boxesUnsubscribe); // "function"
   ```

2. **Add more logging**
   ```javascript
   if (boxesUnsubscribe) {
     console.log('Calling unsubscribe...');
     boxesUnsubscribe();
     console.log('Unsubscribe complete');
   }
   ```

---

## Commit Checklist

After implementing:

- [ ] All 4 load functions modified
- [ ] Global variables added (Solution 1) OR ListenerManager class (Solution 2)
- [ ] Page unload cleanup added
- [ ] Code tested in browser (Incognito)
- [ ] Console shows cleanup messages
- [ ] No duplicates on soft delete
- [ ] No duplicates on purge
- [ ] No duplicates on edit
- [ ] Update ISSUE_1.md with results

---

## Next Steps After Implementation

1. **Test thoroughly** in production
2. **Monitor performance** - page should be faster
3. **Re-enable deleted field filtering** in Firestore rules (see NEXT.md)
4. **Add tests** for listener cleanup
5. **Consider:** Extract ListenerManager to separate file for reusability

---

## References

- [ISSUE_1.md](../ISSUE_1.md) - Active bug tracker
- [REALTIME_LISTENERS.md](REALTIME_LISTENERS.md) - Technical background
- [Firebase Documentation](https://firebase.google.com/docs/firestore/query-data/listen#detach_a_listener)
