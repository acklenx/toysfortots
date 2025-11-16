# GitHub Actions E2E Test Fixes - 2025-11-16

## Current Status: Working on GitHub Actions Integration

**Branch:** `fix-github-actions-e2e`
**Last Working Locally:** Tag `TESTS_PASS_FLAWLESSLY_locally` (commit e6e01cf)

## CRITICAL: ALWAYS TEST LOCALLY BEFORE COMMITTING
**DO NOT commit any changes without running:**
```bash
# Terminal 1: Start emulators (if not already running)
./start-emulators.sh

# Terminal 2: Run E2E tests locally
npx playwright test tests/e2e/e2e-full-journey.spec.js --workers=1
```

**We CANNOT break local tests!** If local tests fail, fix them before committing.

---

## Problem Identified

GitHub Actions run is failing with:
```
Error: http://localhost:5000 is already used, make sure that nothing is running
on the port/url or set reuseExistingServer:true in config.webServer.
```

**Root Cause:**
- GitHub Actions workflow manually starts Firebase emulators in step "=% Setup Firebase emulators" (line 54)
- Then runs smoke tests (which work fine, reusing the server)
- Then tries to run E2E tests
- Playwright config has `webServer` that tries to START emulators (in CI mode)
- This creates a port conflict because emulators are already running

**Solution:**
Add `reuseExistingServer: true` to the `webServer` config in playwright.config.js

---

## Plan

1.  Create branch `fix-github-actions-e2e`
2.  Identify problem via `gh run view --log-failed`
3.  Update NEXT.md with plan (this file)
4. ó Fix playwright.config.js - add `reuseExistingServer: true`
5. ó Test locally to ensure no regression
6. ó Commit and push
7. ó Monitor GitHub Actions run
8. ó If still fails, analyze new error and iterate

---

## What NOT to Try

- L Don't remove the manual emulator startup in GitHub Actions (smoke tests need it)
- L Don't remove webServer from playwright config (needed for CI)
- L Don't change the workflow to start emulators twice
- L Don't commit without testing locally first

---

## Commits Made

None yet - working on first fix

---

**Created:** 2025-11-16
**Status:** =' In Progress - Fixing playwright config
**Priority:** HIGH - Get E2E tests passing in CI

---

## ITERATION 1: Fix reuseExistingServer

**Change Made:**
- File: `playwright.config.js` line 67
- Added: `reuseExistingServer: true` to webServer config

**Reason:**
GitHub Actions workflow manually starts emulators, then Playwright tries to start them again in CI mode. This causes port conflict. The `reuseExistingServer: true` flag tells Playwright to use the already-running server.

**Local Test Results:**
```
14 passed (1.2m)
Test run finished: passed
```
âœ… No regression - all tests still pass locally!

**Next Step:** Commit and push to trigger GitHub Actions

