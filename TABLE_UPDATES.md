# Live Table Updates - Design & Implementation Notes

## Overview

This document captures the design decisions and implementation approach for live data updates in the admin panel's Box Management table. The goal is to provide visual feedback when data changes in real-time without requiring page refreshes.

## Update Flash Animation

### What We Built

Created a subtle, elegant flash animation for existing rows when their data updates:

**Visual Sequence:**
1. Row background flashes light yellow 3 times (0.6s per flash = 1.8s total)
2. Updated cell text becomes **bold** and black immediately
3. Text unbolds at 1.75s (just before animation completes)
4. All visual indicators clear by 1.8s

**Test Page:** `/public/test/table-flash.html`

### Design Decisions

**Why 3 flashes?**
- 2 flashes felt too quick to notice
- 3 flashes provides clear visual feedback without being annoying
- Gives user time to spot the change

**Why light yellow (`#fefce8`)?**
- Subtle enough not to be jarring
- Yellow is universally associated with "attention/highlight"
- Doesn't interfere with existing color coding (red for problems, green for resolved)

**Why bold text immediately?**
- Makes the new value stand out
- User sees what changed, not just where
- Black color ensures readability against yellow background

**Why unbold before animation ends?**
- Smooth transition back to normal state
- Prevents abrupt visual change
- Feels more polished

### Technical Implementation

#### Anti-Shift Technique

Critical requirement: Cell width must not change when text becomes bold.

**Solution:** Use CSS pseudo-element to reserve space for bold text:

```css
.cell-content {
	display: inline-block;
	min-width: fit-content;
}

/* Hidden duplicate for width calculation */
.cell-content::after {
	content: attr(data-text);
	font-weight: bold;
	height: 0;
	visibility: hidden;
	overflow: hidden;
	user-select: none;
	pointer-events: none;
	display: block;
}
```

This creates an invisible bold version that reserves width, preventing layout shift.

#### Animation Timing

```javascript
// Immediate: Update content and make bold
content.textContent = newValue;
content.setAttribute('data-text', newValue);
row.classList.add('flashing');
content.classList.add('bold');

// 1750ms: Unbold (during 3rd flash)
setTimeout(() => content.classList.remove('bold'), 1750);

// 1800ms: Cleanup
setTimeout(() => row.classList.remove('flashing'), 1800);
```

#### CSS Animation

```css
@keyframes flash-yellow {
	0%, 100% { background-color: transparent; }
	50% { background-color: #fefce8; }
}

.flashing {
	animation: flash-yellow 0.6s ease-in-out 3;
}
```

### Multiple Simultaneous Updates

The animation handles multiple rows updating at once gracefully:
- Each row animates independently
- No visual interference between rows
- Synchronized timing creates cohesive effect
- Test with "Update 3 Rows" button on test page

## New Row Insertion (TODO)

### Visual Requirements

When a new box is added to the system, it should appear in the table with clear indication that it's new.

### Proposed Behavior

**Option A: Slide In from Top**
- New row appears at top of table
- Slides down with smooth animation (300ms)
- Flashes green 2 times to indicate "new"
- Sorts into proper position after animation

**Option B: Fade In at Sorted Position**
- Table re-sorts to include new row
- New row starts with 0 opacity
- Fades in over 500ms
- Flash yellow 3 times (same as updates)
- Green left border for 3 seconds to indicate "new"

**Option C: Pop In with Scale**
- Row appears at sorted position
- Starts at 95% scale, grows to 100% (200ms)
- Background starts light green, fades to yellow, then transparent
- Bold text for 2 seconds

### Recommended Approach: Option B with Green Border

**Why:**
- Keeps table sorted (less confusing for users)
- Fade-in is less jarring than slide/pop
- Green left border clearly indicates "new" without interfering with row colors
- Familiar pattern (similar to GitHub notifications)

**Implementation sketch:**
```css
@keyframes fade-in-new {
	0% { opacity: 0; transform: translateY(-10px); }
	100% { opacity: 1; transform: translateY(0); }
}

.new-row {
	animation: fade-in-new 0.5s ease-out;
	border-left: 4px solid var(--t4t-green);
}

.new-row-flash {
	animation: fade-in-new 0.5s ease-out,
	           flash-yellow 0.6s ease-in-out 3 0.5s;
}
```

**Timing:**
- 0-500ms: Fade in
- 500-2700ms: Flash yellow 3 times
- Green border stays for 3 seconds total
- User can dismiss early with click

### Data Considerations

- New row must be inserted at correct sorted position
- May need to paginate to new page if table is full
- Should scroll row into view if outside viewport

## Row Deletion (TODO)

### Visual Requirements

When a box is removed from the system, it should disappear gracefully with clear indication of what's being removed.

### Proposed Behavior

**Option A: Fade Out with Red Flash**
- Row flashes red 2 times (danger indicator)
- Fades out over 500ms
- Collapses vertically to 0 height
- Removes from DOM after animation

**Option B: Slide Out to Right**
- Row background turns light red
- Slides to the right with fade (400ms)
- Collapses height (200ms)
- Removes from DOM

**Option C: Strikethrough with Collapse**
- Row grays out (50% opacity)
- Red strikethrough line animates across (300ms)
- Collapses vertically (300ms)
- Removes from DOM

### Recommended Approach: Option A with Fade Out

**Why:**
- Red flash clearly indicates deletion (danger color)
- Fade + collapse feels smooth and intentional
- Not too fast (user can see what was deleted)
- Not too slow (doesn't delay UI)

**Implementation sketch:**
```css
@keyframes flash-red-delete {
	0%, 100% { background-color: transparent; }
	50% { background-color: #fee2e2; }
}

@keyframes fade-out-collapse {
	0% { opacity: 1; max-height: 60px; }
	50% { opacity: 0; max-height: 60px; }
	100% { opacity: 0; max-height: 0; padding: 0; margin: 0; }
}

.deleting-row {
	animation: flash-red-delete 0.4s ease-in-out 2,
	           fade-out-collapse 0.6s ease-in-out 0.8s;
	animation-fill-mode: forwards;
}
```

**Timing:**
- 0-800ms: Flash red 2 times
- 800-1400ms: Fade out and collapse
- 1400ms: Remove from DOM

### Undo Considerations

**Important:** If we implement undo functionality, the deletion animation should:
1. NOT remove from DOM until undo window expires
2. Show "Undo" button during animation
3. Reverse animation if undo clicked
4. Only remove from Firestore after undo window (e.g., 5 seconds)

This would require:
- Keeping row in DOM with `.deleted` class
- Toast notification with undo button
- Reverse animation on undo
- Firestore batch delete with delay

## Integration with Admin Panel

### Current State

Admin panel (`/public/admin/index.html`) currently:
- Uses manual refresh (no live updates)
- Renders full table on each data load
- No Firestore snapshot listeners

### Required Changes for Live Updates

1. **Add Firestore Snapshot Listeners**
   ```javascript
   const locationsRef = collection(db, locationsCollectionPath);
   const q = query(locationsRef, orderBy('created', 'desc'));

   onSnapshot(q, (snapshot) => {
     snapshot.docChanges().forEach((change) => {
       if (change.type === 'added') {
         handleNewRow(change.doc);
       } else if (change.type === 'modified') {
         handleRowUpdate(change.doc);
       } else if (change.type === 'removed') {
         handleRowDelete(change.doc);
       }
     });
   });
   ```

2. **Track Current State**
   - Keep `allBoxes` array in sync with Firestore
   - Use `data-box-id` attribute to find rows
   - Compare old vs new values to determine what changed

3. **Handle Edge Cases**
   - Don't animate initial page load (only after ready)
   - Pause animations during user search/filter
   - Handle pagination correctly
   - Deal with sorted columns
   - Respect user's current page position

### Performance Considerations

- **Debounce rapid updates:** If same row updates multiple times quickly, queue animations
- **Limit active animations:** Maximum 5 rows animating simultaneously
- **Virtual scrolling:** For 100+ rows, only animate visible rows
- **Offline handling:** Queue updates when offline, animate when reconnected

## Testing Strategy

### Test Page Features

Current test page (`/public/test/table-flash.html`) includes:
- Manual single update
- Auto-updates every 2 seconds
- Triple simultaneous update
- Update logging

### Needed Test Scenarios

For full implementation, test page should add:
- **New row insertion** button
- **Row deletion** button
- **Rapid updates** (same row updates 5 times in 2 seconds)
- **Mixed operations** (insert + update + delete simultaneously)
- **Pagination** handling
- **Sorting** change during animation
- **Search/filter** during animation

## Open Questions

1. **Should animations respect user's "reduce motion" preference?**
   - Check `prefers-reduced-motion` media query
   - Fall back to instant updates with simple color change

2. **How to handle updates to currently edited rows?**
   - Block animations if edit modal is open for that row
   - Or show "Data changed" warning in modal

3. **Should we throttle Firestore updates?**
   - Current concern: If many volunteers active, lots of updates
   - Solution: Use Firestore cache, update in batches

4. **Audio feedback?**
   - Subtle "ping" sound for new boxes?
   - Different sound for problems?
   - Make it optional (settings toggle)

## Next Steps

1. ✅ Finalize update flash animation (DONE)
2. ⬜ Implement new row insertion animation
3. ⬜ Implement row deletion animation
4. ⬜ Add snapshot listeners to admin panel
5. ⬜ Test with real-time Firestore data
6. ⬜ Add performance monitoring
7. ⬜ Test with multiple browsers
8. ⬜ Add user preference for animations (on/off)

## References

- Test page: `/public/test/table-flash.html`
- Admin panel: `/public/admin/index.html`
- CSS variables: `/public/css/style.css`
- Firebase patterns: `/public/js/firebase-init.js`
