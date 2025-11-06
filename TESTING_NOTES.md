# Testing Notes & Conventions

## Performance Settings

**IMPORTANT: Always use multiple workers for test runs**
- Use at least 4 workers, preferably 8
- NEVER use just 1 worker - it's too slow
- Command: `npx playwright test --workers=8`

## Authentication vs Authorization

### Key Distinction
- **Authenticated** = Any random person who created a username/password
- **Authorized** = User who has been approved/given permission in the system

### Page Access Rules

#### Setup Page (`/setup`)
- **Authenticated users** (not authorized) CAN see this page
- **Must show passcode field** at the top for authentication
- This is how unauthorized users become authorized

#### General Pages
- Most other pages require BOTH authentication AND authorization
- Authenticated-only users should see very limited content

## Future Enhancement (After Tests Pass)

**Dedicated Authorization Flow**
When an authenticated but unauthorized user tries to access protected pages:
1. Redirect to dedicated authorization page
2. User authenticates there (enters passcode, etc.)
3. Then proceeds to intended destination

## User Display Convention (All Pages)

**For Debugging & Sanity:**
- Show authenticated username at bottom of every page
- If authenticated but NOT authorized: add asterisk after username (e.g., "username*")
- This helps with debugging and is useful in production too

Example:
```
Authenticated & Authorized: "john.doe"
Authenticated but NOT Authorized: "jane.smith*"
```

## Test Status (as of Nov 5, 2025)

**73/76 passing (96%)**

### Passing ✅
- Login: 12/12
- Dashboard: 13/13
- Box-and-status: 19/19
- Home: 28/29
- Setup: 14/17

### Failing ❌
1. Home: "should connect to Firebase emulators in localhost"
2. Setup: "should redirect unauthenticated users to login" *(likely auth vs authorized issue)*
3. Setup: "should require contact info on submission"

## Test Organization

Tests should be organized into:
1. **Public** - No authentication needed
2. **Authenticated** - Login required, but not necessarily authorized
3. **Authorized** - Both authenticated AND authorized required

Each test suite should have proper beforeEach setup for creating users with appropriate permissions.
