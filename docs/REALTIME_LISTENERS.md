# Real-Time Listeners Deep Dive

**Purpose:** Technical documentation of Firebase onSnapshot listeners and the duplicate accumulation bug

**Related:** [ISSUE_1.md](../ISSUE_1.md)

---

## How Firebase onSnapshot Works

### Basic Pattern

```javascript
const unsubscribe = onSnapshot(queryRef, (snapshot) => {
  snapshot.forEach(doc => {
    console.log('Document:', doc.id, doc.data());
  });
});

// Later: clean up
unsubscribe();
```

### Key Concepts

1. **onSnapshot returns an unsubscribe function** that must be called to stop listening
2. **Listener fires immediately** with current data, then fires again on any changes
3. **Listeners persist** until unsubscribed - they don't auto-cleanup
4. **Multiple listeners can exist** on the same query - all will fire independently

---

## The Admin Panel Implementation

### Current Pattern (BROKEN)

```javascript
// Global state
let allBoxes = [];
let boxesInitialLoadComplete = false;

function loadBoxes() {
  const locationsRef = collection(db, locationsCollectionPath);
  const q = query(locationsRef, orderBy('created', 'desc'));

  // ❌ PROBLEM: Creates new listener every time, never unsubscribes
  onSnapshot(q, (snapshot) => {
    if (!boxesInitialLoadComplete) {
      // First time: Build complete array
      allBoxes = [];
      snapshot.forEach((doc) => {
        allBoxes.push({ id: doc.id, ...doc.data() });
      });
      boxesInitialLoadComplete = true;
      filterAndRenderBoxes();
    } else {
      // Subsequent changes: Incremental updates
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          allBoxes.push({ id: change.doc.id, ...change.doc.data() });
        } else if (change.type === 'modified') {
          const index = allBoxes.findIndex(b => b.id === change.doc.id);
          if (index !== -1) allBoxes[index] = { id: change.doc.id, ...change.doc.data() };
        } else if (change.type === 'removed') {
          const index = allBoxes.findIndex(b => b.id === change.doc.id);
          if (index !== -1) allBoxes.splice(index, 1);
        }
      });
      filterAndRenderBoxes();
    }
  });
}
```

### The Accumulation Problem

**Scenario:**
1. Page loads → calls `loadBoxes()` → **Listener #1 created** ✅
2. User soft-deletes box → (old code) called `loadBoxes()` → **Listener #2 created** ❌
3. Firestore detects deletion and notifies ALL listeners
4. **Listener #1** fires: `docChanges()` shows 'removed' → removes item from array
5. **Listener #2** fires: `!boxesInitialLoadComplete` is FALSE for this listener → **Rebuilds entire array!**
6. Result: Array now has duplicate items

**Why Listener #2 rebuilds:**
- Each listener has its own closure context
- `boxesInitialLoadComplete` is checked PER LISTENER INVOCATION
- First time a listener fires, it's that listener's "initial load"
- So Listener #2 thinks it's the first load and rebuilds the whole array

### Visualization

```
Timeline:
──────────────────────────────────────────────────────────────

T0: Page Load
    loadBoxes() called
    Listener #1 created ───────────┐
    boxesInitialLoadComplete = true │
    allBoxes = [A, B]                │
                                     │
T1: User soft-deletes Box A         │
    (Old code) loadBoxes() called   │
    Listener #2 created ─────────┐  │
                                 │  │
T2: Firestore change propagates  │  │
                                 ▼  ▼
    Listener #1 fires:          Listener #2 fires:
    - docChanges() = 'removed'  - Initial load for THIS listener
    - Remove A from array       - Rebuild: allBoxes = [B, B]
    - allBoxes = [B]            - Now we have duplicates!
```

---

## Why Our Fixes Didn't Work

### Fix Attempt 1: Remove loadBoxes() calls
**What we did:** Removed all calls to `loadBoxes()` after operations (soft delete, edit, etc)

**Why it didn't work:**
- There's likely a code path we missed
- OR `loadBoxes()` is being called multiple times on initial page load
- OR browser cache is serving old code

**Evidence:**
- Purge operations work (we removed those calls successfully)
- Soft delete still duplicates (missed a call somewhere?)

---

## docChanges() Behavior

### What is docChanges()?

Returns an array of changes since last snapshot:
```javascript
snapshot.docChanges().forEach(change => {
  console.log(change.type);  // 'added', 'modified', 'removed'
  console.log(change.doc);   // DocumentSnapshot
});
```

### Important: Change Types

**'added'** - Document added to query results
- Can be new document created
- OR existing document now matches query filter
- OR first snapshot from new listener

**Key insight:** When a NEW listener is created, ALL documents appear as 'added' changes!

This is why our logic breaks:
```javascript
if (change.type === 'added') {
  allBoxes.push(box);  // ❌ Adds ALL boxes again when new listener created
}
```

---

## Correct Pattern: Listener Cleanup

### Simple Cleanup Pattern

```javascript
// Store unsubscribe function
let boxesUnsubscribe = null;

function loadBoxes() {
  // Clean up old listener first
  if (boxesUnsubscribe) {
    console.log('Unsubscribing from old boxes listener');
    boxesUnsubscribe();
  }

  const q = query(locationsRef, orderBy('created', 'desc'));

  // Save unsubscribe function
  boxesUnsubscribe = onSnapshot(q, (snapshot) => {
    // ... listener logic
  });
}
```

**Why this works:**
- Only ONE listener exists at a time
- Old listener cleaned up before creating new one
- No accumulation possible

### Advanced: Listener Manager Pattern

```javascript
class ListenerManager {
  constructor() {
    this.listeners = new Map();
  }

  subscribe(name, unsubscribeFn) {
    // Clean up old listener if exists
    if (this.listeners.has(name)) {
      console.log(`Unsubscribing from ${name}`);
      this.listeners.get(name)();
    }

    // Store new unsubscribe function
    this.listeners.set(name, unsubscribeFn);
  }

  unsubscribe(name) {
    if (this.listeners.has(name)) {
      this.listeners.get(name)();
      this.listeners.delete(name);
    }
  }

  unsubscribeAll() {
    this.listeners.forEach((unsubscribe, name) => {
      console.log(`Unsubscribing from ${name}`);
      unsubscribe();
    });
    this.listeners.clear();
  }
}

// Global instance
const listenerManager = new ListenerManager();

// Usage
function loadBoxes() {
  const unsubscribe = onSnapshot(q, (snapshot) => { ... });
  listenerManager.subscribe('boxes', unsubscribe);
}

function loadReports() {
  const unsubscribe = onSnapshot(q, (snapshot) => { ... });
  listenerManager.subscribe('reports', unsubscribe);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  listenerManager.unsubscribeAll();
});
```

**Benefits:**
- Centralized listener management
- Easy debugging (see all active listeners)
- Automatic cleanup
- Prevents memory leaks

---

## Debugging Listener Accumulation

### Count Active Listeners

```javascript
let listenerCount = 0;

function loadBoxes() {
  listenerCount++;
  console.log('Creating listener #' + listenerCount);
  console.trace('Called from:');

  onSnapshot(q, (snapshot) => {
    console.log('Listener #' + listenerCount + ' fired');
    // ...
  });
}
```

**Expected output on page load:**
```
Creating listener #1
Creating listener #2
Creating listener #3
(boxes, reports, volunteers)
```

**If you see more than 3:** Something is calling load functions multiple times

### Track Listener Invocations

```javascript
function loadBoxes() {
  let invocationCount = 0;

  onSnapshot(q, (snapshot) => {
    invocationCount++;
    console.log('Boxes listener invocation #' + invocationCount);

    if (!boxesInitialLoadComplete) {
      console.log('  → Initial load');
    } else {
      console.log('  → Incremental update');
      console.log('  → Changes:', snapshot.docChanges().length);
    }
  });
}
```

**Expected:** Each listener invokes multiple times (initial + updates)
**Problem:** Multiple listeners firing for same changes

### Detect Duplicates in Array

```javascript
function checkDuplicates(arr, name) {
  const ids = arr.map(item => item.id);
  const uniqueIds = new Set(ids);

  if (ids.length !== uniqueIds.size) {
    console.error(`❌ DUPLICATES in ${name}!`);
    console.log('Total items:', ids.length);
    console.log('Unique items:', uniqueIds.size);
    console.log('Duplicate IDs:', ids.filter((id, i) => ids.indexOf(id) !== i));
    return true;
  }

  return false;
}

// Call after every update
function filterAndRenderBoxes() {
  checkDuplicates(allBoxes, 'allBoxes');
  // ... rest of function
}
```

---

## Memory Leaks

### The Hidden Cost

Each uncleaned listener:
- Maintains connection to Firestore
- Holds references to callback functions and closures
- Prevents garbage collection
- Consumes network bandwidth on every update

**If user stays on admin panel for 1 hour and performs 100 operations:**
- Without cleanup: 300+ active listeners (3 per operation)
- With cleanup: 3 active listeners (boxes, reports, volunteers)

### Detection

```javascript
// Track all listeners globally
window.__activeListeners = [];

function loadBoxes() {
  const unsubscribe = onSnapshot(q, (snapshot) => { ... });
  window.__activeListeners.push({ type: 'boxes', unsubscribe });
}

// Check in console
console.log('Active listeners:', window.__activeListeners.length);
```

---

## Testing Checklist

### Verify Fix Works

1. **Clear browser cache** (or use Incognito)
2. **Load admin panel** - should see 2 boxes
3. **Check console:** Should see exactly 3 "Creating listener" messages
4. **Soft delete 1 box** - should see 1 box remaining (not 2, not 4)
5. **Check console:** Should see "Cleaning up old listener" if using cleanup pattern
6. **Edit a box** - count should stay the same
7. **Refresh page** - everything should work consistently

### Performance Test

1. Load admin panel
2. Perform 50 operations (soft delete, edit, etc)
3. Check: `window.__activeListeners.length`
4. **Expected with cleanup:** 3 listeners
5. **Expected without cleanup:** 150+ listeners

---

## References

- [Firebase onSnapshot Documentation](https://firebase.google.com/docs/firestore/query-data/listen)
- [ISSUE_1.md](../ISSUE_1.md) - Active bug tracker
- [LISTENER_CLEANUP_PATTERN.md](LISTENER_CLEANUP_PATTERN.md) - Implementation guide
