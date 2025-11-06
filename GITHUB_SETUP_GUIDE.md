# 🚀 GitHub Setup Guide

Complete this guide to get your GitHub project fully set up with Issues, Project Board, and automated workflows!

---

## ✅ Step 1: Push Your Changes

```bash
git push origin main
```

This will:
- Update README with links
- Add Issue templates
- Enable GitHub Actions for automated testing
- Add PR template

---

## 🏷️ Step 2: Create Labels

Go to: **https://github.com/acklenx/toysfortots/labels**

Click **"New label"** and create these:

| Label | Color | Description |
|-------|-------|-------------|
| `priority:critical` | `#d73a4a` (red) | Critical priority - blocking work |
| `priority:high` | `#d93f0b` (orange) | High priority - important for next release |
| `priority:medium` | `#fbca04` (yellow) | Medium priority - nice to have soon |
| `priority:low` | `#0e8a16` (green) | Low priority - future consideration |
| `enhancement` | `#0075ca` (blue) | New feature or request |
| `bug` | `#d73a4a` (red) | Something isn't working |
| `testing` | `#5319e7` (purple) | Related to testing |
| `ui/ux` | `#d876e3` (pink) | User interface/experience |
| `admin` | `#7057ff` (purple) | Admin features |
| `security` | `#ee0701` (red) | Security related |
| `integration` | `#1d76db` (blue) | Integration with external services |
| `architecture` | `#006b75` (teal) | Architectural changes |
| `mobile` | `#0e8a16` (green) | Mobile-specific |
| `documentation` | `#0075ca` (blue) | Documentation improvements |

**Quick tip:** GitHub has default labels too - you can use those as well!

---

## 📊 Step 3: Create Project Board

### Option A: GitHub Projects (New - Recommended)

1. Go to: **https://github.com/acklenx/toysfortots/projects**
2. Click **"New project"**
3. Choose **"Board"** view
4. Name it: **"Toys for Tots Development"**
5. Add description: "Project roadmap and task tracking"

**Default columns will be:**
- 📋 **Todo** - Not started
- 🚧 **In Progress** - Currently working on
- ✅ **Done** - Completed

### Option B: Classic Projects (Simpler)

1. Go to: **https://github.com/acklenx/toysfortots/projects**
2. Click **"Link a project"** → **"Create a new project"**
3. Choose **"Team backlog"** template
4. Customize columns as needed

---

## 🎫 Step 4: Create Top Priority Issues

Open the guide at: **.github/create-issues.md** (in your repo after pushing)

Or use this direct link after pushing:
**https://github.com/acklenx/toysfortots/blob/main/.github/create-issues.md**

### Quick Create (Top 3):

#### Issue 1: QR Code → Google Sheets
1. Go to: https://github.com/acklenx/toysfortots/issues/new?template=feature_request.md
2. Copy content from `.github/create-issues.md` section 1
3. Add labels: `enhancement`, `priority:critical`, `integration`
4. Create issue
5. Add to Project Board

#### Issue 2: Fix Page Appearance
1. Go to: https://github.com/acklenx/toysfortots/issues/new?template=bug_report.md
2. Copy content from `.github/create-issues.md` section 2
3. Add labels: `bug`, `priority:high`, `ui/ux`
4. Create issue
5. Add to Project Board

#### Issue 3: Hamburger Menu
1. Go to: https://github.com/acklenx/toysfortots/issues/new?template=feature_request.md
2. Copy content from `.github/create-issues.md` section 3
3. Add labels: `enhancement`, `priority:high`, `ui/ux`
4. Create issue
5. Add to Project Board

**Continue for remaining issues as needed!**

---

## 🤖 Step 5: Verify GitHub Actions

After pushing, GitHub Actions should automatically run.

Check at: **https://github.com/acklenx/toysfortots/actions**

You should see:
- ✅ **Tests** workflow running
- Green checkmark when tests pass

If it fails:
- Click on the workflow run
- Review the logs
- May need to configure Firebase emulator settings

---

## 📝 Step 6: Link Issues to PROJECT_TODO.md

Once issues are created, update **PROJECT_TODO.md** with links:

```markdown
### 🔗 QR Code → Google Sheets Integration
- [ ] **Link QR codes to Google Sheets entries** [#1](https://github.com/acklenx/toysfortots/issues/1)
```

---

## 🎯 Step 7: Configure Project Board Automation (Optional)

In your Project Board settings:

1. **Auto-add items:**
   - New issues automatically added to "Todo"
   - New PRs automatically added to "In Progress"

2. **Auto-move items:**
   - When PR merged → Move to "Done"
   - When issue closed → Move to "Done"

3. **Auto-archive:**
   - Archive items closed > 14 days ago

---

## 💡 Tips for Success

### Using Issues Effectively:
- **Reference issues in commits:** `git commit -m "Fix footer positioning #2"`
- **Close issues automatically:** `git commit -m "Fixes #2 - footer now sticky"`
- **Link PRs to issues:** In PR description, write `Fixes #2`
- **Use milestones:** Group issues by release (v1.0, v2.0)

### Project Board Best Practices:
- **Move cards daily** - Keep board up to date
- **Add notes** - Use for ideas not ready for issues
- **Filter views** - Create filtered views by label
- **Weekly review** - Review board weekly in team meetings

### GitHub Actions:
- **Badge in README** - Shows test status
- **Protect main branch** - Require tests to pass before merge
- **Notifications** - Enable GitHub notifications for CI failures

---

## 🎉 You're All Set!

After completing these steps, you'll have:
- ✅ Professional GitHub project setup
- ✅ Issue tracking system
- ✅ Visual project board
- ✅ Automated testing
- ✅ Standardized workflows

**Next:** Start working through issues in priority order!

---

## 📚 Additional Resources

- [GitHub Projects Docs](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Writing Good Issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/creating-an-issue)
- [Managing Labels](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work)

---

*Created with ❤️ using Claude Code*
