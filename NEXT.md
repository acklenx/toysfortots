# Dashboard & Admin Panel UX Improvements

## Admin Page (`/public/admin/index.html`)

### 1. Rename "Display Name" column to "Name"
- Location: Column header in volunteer table
- Just a simple text change

### 2. Make Name column clickable
- Should link to dashboard for that volunteer (like Boxes column does)
- Pattern to follow: See how the Boxes column creates the link with `?volunteer=...` parameter
- Apply same pattern to the Name column

## Dashboard Page (`/public/dashboard/index.html`)

### 3. Fix dropdown to show actual name being viewed
**Current behavior**: When navigating from admin page using "View Boxes" link, the correct boxes display but dropdown shows "My Boxes" selected.

**Desired behavior**:
- Dropdown should show the name of whoever's boxes are currently displayed
- Even if it's "my own" boxes, show my actual name instead of "My Boxes"
- Keep "My Boxes" at top of dropdown list for convenience, but don't auto-select it

**Solution approach**:
- After boxes are rendered, read the `boxesTitle` or the volunteer parameter to see whose boxes are displayed
- Update the dropdown value to match that person's name
- This solves the problem for all cases (navigating from admin, direct access, etc.)

**Key insight**: The boxes are already displaying correctly, we just need to sync the dropdown selection to match what's being shown.

## Files to modify:
- `/public/admin/index.html` - column header + make Name clickable
- `/public/dashboard/index.html` - sync dropdown after rendering boxes
