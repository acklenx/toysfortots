# 📝 Creating GitHub Issues from PROJECT_TODO.md

This guide helps you create GitHub Issues for the items in PROJECT_TODO.md.

## 🚀 Top Priority Issues to Create First

### 1. QR Code → Google Sheets Integration
**Issue Title:** `[FEATURE] QR Code → Google Sheets Integration`

**Labels:** `enhancement`, `priority:critical`, `integration`

**Description:**
```markdown
## 🎯 Feature Description
Enable QR codes to link directly to Google Sheets entries containing pre-filled location and contact information.

## 💡 Why is this needed?
Many locations are already tracked in a Google Sheet. Manual re-entry is time-consuming and error-prone.

## 🎨 Proposed Solution
- Parse Google Sheets API or CSV export
- Match box IDs to spreadsheet rows
- Auto-populate setup form when QR code has associated data
- Allow manual override if needed
- Handle updates when spreadsheet changes

## 📋 Acceptance Criteria
- [ ] Google Sheets can be linked to the app
- [ ] QR codes can reference spreadsheet row IDs
- [ ] Setup form auto-fills from spreadsheet data
- [ ] Manual editing still works
- [ ] Changes to spreadsheet sync automatically

## 📌 Priority
- [x] 🚨 Critical (top priority)

## 🔗 Related
See PROJECT_TODO.md
```

---

### 2. Fix Page Appearance Inconsistencies
**Issue Title:** `[BUG] Page appearance inconsistencies across site`

**Labels:** `bug`, `priority:high`, `ui/ux`

**Description:**
```markdown
## 🐛 Bug Description
Different pages have inconsistent styling, spacing, and layout.

## 📋 Steps to Reproduce
1. Visit /dashboard
2. Visit /setup
3. Visit /status
4. Notice different header/footer styles, spacing, colors

## ✅ Expected Behavior
All pages should have consistent:
- Header/footer styling
- Spacing and margins
- Font sizes and colors
- Button styles
- Layout patterns

## ❌ Actual Behavior
Pages look different, some footers float, spacing varies

## 📝 Subtasks
- [ ] Audit all pages for visual differences
- [ ] Create standardized CSS variables
- [ ] Fix footer positioning (should be at bottom)
- [ ] Standardize spacing
- [ ] Test on mobile and desktop

## 📌 Priority
- [x] ⚠️ High (affects user experience)
```

---

### 3. Add Hamburger Menu for Authenticated Users
**Issue Title:** `[FEATURE] Add hamburger menu for authenticated users`

**Labels:** `enhancement`, `priority:high`, `ui/ux`

**Description:**
```markdown
## 🎯 Feature Description
Replace hidden icon navigation with a proper hamburger menu for authenticated users.

## 💡 Why is this needed?
Current navigation is hidden in icons, making it hard to discover features.

## 🎨 Proposed Solution
- Add hamburger icon (☰) in header for authenticated users
- Slide-out menu with clear navigation items:
  - 🏠 Dashboard
  - ➕ Setup New Box
  - 📦 View All Boxes
  - 👤 Profile
  - 🚪 Sign Out
- Mobile-friendly design
- Smooth animations

## 📋 Acceptance Criteria
- [ ] Hamburger icon visible when logged in
- [ ] Menu slides out smoothly
- [ ] All nav items work correctly
- [ ] Works on mobile and desktop
- [ ] Accessible via keyboard

## 📌 Priority
- [x] ⚠️ High (improves navigation)
```

---

### 4. Create Admin Dashboard
**Issue Title:** `[FEATURE] Admin dashboard for managing locations, reports, and users`

**Labels:** `enhancement`, `priority:high`, `admin`, `security`

**Description:**
```markdown
## 🎯 Feature Description
Create a true admin page at /admin/ for managing all aspects of the system.

## 💡 Why is this needed?
Need ability to edit/delete locations, reports, and manage volunteer access.

## 🎨 Proposed Solution
Create /admin/ page with:
- **Locations Management**
  - View all locations with search/filter
  - Edit location details
  - Delete locations (with confirmation)

- **Reports Management**
  - View all submitted reports
  - Delete inappropriate/spam reports
  - Mark reports as resolved

- **Volunteer Management**
  - View all authorized volunteers
  - Remove volunteer access
  - View volunteer activity

- **Statistics Dashboard**
  - Total boxes
  - Total reports
  - Active volunteers

## 📋 Acceptance Criteria
- [ ] Admin route created and protected
- [ ] Admin role/permission system implemented
- [ ] Can view/edit/delete all locations
- [ ] Can view/delete all reports
- [ ] Can manage volunteer access
- [ ] Statistics dashboard shows key metrics
- [ ] All actions have confirmation dialogs
- [ ] Cloud Functions created for admin operations

## 🔒 Security Requirements
- [ ] Admin role separate from regular volunteers
- [ ] Protected with separate authentication
- [ ] All admin actions logged

## 📌 Priority
- [x] ⚠️ High (important for maintenance)
```

---

### 5. Create Production E2E Test Suite
**Issue Title:** `[TESTING] Production E2E test suite for live environment`

**Labels:** `testing`, `priority:medium`

**Description:**
```markdown
## 🎯 Feature Description
Create E2E tests that can safely run against production at https://toysfortots.mcl1311.com

## 💡 Why is this needed?
Need to verify production is working without breaking real data.

## 🎨 Proposed Solution
- Create tests/e2e-production/ directory
- Use themed test data (North Pole address, "Buddy the Elf" volunteer)
- Graceful cleanup that won't leave test data
- Can run daily via cron/GitHub Actions
- Sends notifications on failure

## 📋 Acceptance Criteria
- [ ] Production test suite created
- [ ] Uses safe, recognizable test data
- [ ] Cleans up after itself
- [ ] Can be scheduled to run daily
- [ ] Sends alerts on failure
- [ ] Doesn't affect real volunteer data

## 📌 Priority
- [x] 📝 Medium (important for confidence)
```

---

### 6. Convert to Progressive Web App (PWA)
**Issue Title:** `[FEATURE] Convert to Progressive Web App (PWA)`

**Labels:** `enhancement`, `priority:medium`, `mobile`

**Description:**
```markdown
## 🎯 Feature Description
Make the app installable on mobile devices as a PWA.

## 💡 Why is this needed?
Volunteers use mobile devices in the field - PWA enables offline access and native-like experience.

## 🎨 Proposed Solution
- Add manifest.json with app metadata
- Include app icons (multiple sizes)
- Create service worker for offline support
- Enable "Add to Home Screen" functionality
- Cache critical assets

## 📋 Acceptance Criteria
- [ ] manifest.json created
- [ ] App icons generated (192x192, 512x512, etc.)
- [ ] Service worker caches assets
- [ ] Can be installed on iOS
- [ ] Can be installed on Android
- [ ] Works offline (at least shows cached pages)
- [ ] Shows install prompt

## 📌 Priority
- [x] 📝 Medium (improves mobile experience)
```

---

### 7. Migrate to Single Page Application (SPA)
**Issue Title:** `[REFACTOR] Migrate to Single Page Application architecture`

**Labels:** `refactor`, `priority:medium`, `architecture`

**Description:**
```markdown
## 🎯 Feature Description
Replace directory-based routing with client-side SPA routing.

## 💡 Why is this needed?
- Reduce page reloads
- Improve navigation speed
- Eliminate duplicate header/footer code
- Better user experience

## 🎨 Proposed Solution
- Use History API for routing
- Centralize page templates
- Consider lightweight framework (Preact, Alpine.js) or vanilla JS router
- Lazy-load pages as needed

## 📋 Acceptance Criteria
- [ ] Client-side routing implemented
- [ ] All pages work without reload
- [ ] Back/forward buttons work
- [ ] URLs still work (bookmarkable)
- [ ] No duplicate header/footer code
- [ ] Load times improved
- [ ] SEO not negatively impacted

## 📌 Priority
- [x] 📝 Medium (improves architecture)

## ⚠️ Breaking Change
This is a major refactor - needs careful planning and testing.
```

---

## 🎯 How to Create These Issues

1. **Go to:** https://github.com/acklenx/toysfortots/issues/new/choose

2. **Choose template:** Feature Request or Bug Report

3. **Copy/paste** the content from above

4. **Add labels** as specified

5. **Create issue**

6. **Add to Project Board** (optional but recommended)

---

## 📊 Recommended Labels

Create these labels in your repo:
- `priority:critical` (red)
- `priority:high` (orange)
- `priority:medium` (yellow)
- `priority:low` (green)
- `enhancement` (blue)
- `bug` (red)
- `testing` (purple)
- `ui/ux` (pink)
- `admin` (brown)
- `security` (red)
- `integration` (blue)
- `architecture` (gray)
- `mobile` (green)

---

## 💡 Tips

- Link issues to PROJECT_TODO.md
- Use milestones to group related issues
- Reference issues in commits with `#123`
- Close issues automatically with "Fixes #123" in commit messages
