# Hamburger Menu UX Enhancement - 2025-11-09

## Summary

Improved hamburger menu UX to persist for previously authorized users even when not logged in, making it easier for returning volunteers to access the Sign In option.

## Problem

Previously, the hamburger menu was completely hidden when a user was not logged in. This meant that authorized volunteers who returned to the site while logged out had no easy way to navigate to the Sign In page - they'd have to manually type `/login` or use browser bookmarks.

## Solution

Implemented localStorage-based persistence to remember when a user has been authorized, and show a simplified hamburger menu for returning volunteers.

### Behavior

**1. New/Never Authorized Users (Current Behavior):**
- Hamburger menu is **hidden**
- Only public navigation available (MCL logo → dashboard redirect → login)

**2. Logged In Authorized Users:**
- Hamburger menu **visible** with full menu items:
  - User info display (username with * if not yet authorized)
  - Map
  - Dashboard
  - Admin Panel (if applicable)
  - New Box
  - Sign Out
- localStorage flag `t4t_wasAuthorized` set to `true`

**3. Previously Authorized Users (Not Currently Logged In) - NEW:**
- Hamburger menu **visible** with limited menu items:
  - Map
  - **Sign In** ← Easy access to login!
- Hidden items: Dashboard, Admin, New Box, Sign Out, User Info

### Implementation Details

**File: `/public/js/hamburger-menu.js`**

Added localStorage persistence on lines 98-101:
```javascript
// Remember authorization status in localStorage
if (isAuthorized) {
  localStorage.setItem('t4t_wasAuthorized', 'true');
}
```

Updated not-logged-in logic on lines 125-166:
```javascript
// Not authenticated or anonymous
// Check if user was previously authorized
const wasAuthorized = localStorage.getItem('t4t_wasAuthorized') === 'true';

if (wasAuthorized) {
  // Show hamburger for previously authorized users (not logged in)
  hamburgerBtn.style.display = 'flex';
  // ... show Map and Sign In only
} else {
  // Never authorized - hide hamburger button completely
  hamburgerBtn.style.display = 'none';
  // ... current behavior
}
```

## Files Modified

1. `public/js/hamburger-menu.js` - Added localStorage logic
2. `public/_header.html` - Updated with minified script

## Testing Manually

To test this behavior:

1. **Clear localStorage** (to simulate new user):
   ```javascript
   localStorage.removeItem('t4t_wasAuthorized');
   ```
   - Verify hamburger is hidden when not logged in ✓

2. **Log in as authorized volunteer**:
   - Visit `/login`, sign in with valid credentials
   - Dashboard should load (triggers authorization check)
   - Hamburger should show with all menu items ✓

3. **Log out**:
   - Click Sign Out in hamburger menu
   - Should redirect to `/login`
   - **Hamburger should still be visible** with Map and Sign In options ✓

4. **Close tab and return** (or reload page):
   - Open site in new tab (still logged out)
   - Hamburger should still be visible ✓
   - Can easily click hamburger → Sign In ✓

## localStorage Key

- **Key:** `t4t_wasAuthorized`
- **Value:** `"true"` (string)
- **Set when:** User successfully passes `isAuthorizedVolunteerV2` check
- **Never cleared:** Persists across sessions
- **Security:** No sensitive data stored, only a flag indicating past authorization

## Benefits

1. **Better UX for returning volunteers** - Easy access to Sign In
2. **No breaking changes** - New users still see current behavior
3. **Progressive enhancement** - Persists across browser sessions
4. **No server-side changes** - Pure client-side enhancement

## Privacy Considerations

The localStorage flag does not contain:
- ❌ User credentials
- ❌ Email addresses
- ❌ Authorization tokens
- ❌ Any personally identifiable information

It only indicates:
- ✅ "This browser was used by someone who was once authorized"

This is safe and comparable to "remember me" functionality.

## Edge Cases Handled

1. **Anonymous users** - Hamburger hidden (no localStorage flag)
2. **Not-yet-authorized users** - Hamburger shows when logged in (with * indicator), localStorage not set until authorized
3. **Authorized users** - localStorage set, hamburger persists after logout
4. **localStorage cleared** - Reverts to new-user behavior (hamburger hidden when logged out)
5. **Multiple browsers** - Each browser has independent localStorage (expected behavior)

## Future Enhancements (Optional)

- Add "Clear my data" option in hamburger menu to remove localStorage flag
- Add expiration to localStorage (e.g., clear after 30 days of inactivity)
- Store last-used username (non-sensitive) to show in hamburger when logged out

---

**Status:** ✅ Implemented and ready to commit
**Next:** Test manually in browser, then commit changes
