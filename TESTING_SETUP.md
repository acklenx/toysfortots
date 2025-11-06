# Testing Setup Guide

## Installing Java for Firebase Emulators

Firebase emulators require Java Runtime Environment (JRE) to be installed.

### Install Java on WSL/Ubuntu

Run these commands in your terminal:

```bash
sudo apt update
sudo apt install default-jre
```

Verify installation:
```bash
java -version
```

You should see output like:
```
openjdk version "11.0.x" ...
```

### Install Playwright System Dependencies

```bash
sudo npx playwright install-deps
```

Or install specific libraries:
```bash
sudo apt-get install libnspr4 libnss3 libasound2t64
```

## Running the Full Test Suite

### Step 1: Start Firebase Emulators

In **Terminal 1**, start the emulators:

```bash
cd ~/toysfortots
./start-emulators.sh
```

Wait for the message:
```
✔  All emulators ready!
```

You can view the Emulator UI at: http://localhost:4000

### Step 2: Run Tests

In **Terminal 2**, run the tests:

```bash
cd ~/toysfortots
npm test
```

### Alternative: Single Terminal

If you prefer a single terminal, run emulators in background:

```bash
cd ~/toysfortots
./start-emulators.sh &
sleep 10  # Wait for emulators to start
npm test
```

Stop emulators when done:
```bash
pkill -f firebase
```

## Quick Smoke Test

To verify the test framework works without emulators:

```bash
npm run test:smoke
```

This runs a simplified test that doesn't require Firebase.

## Troubleshooting

### Issue: "Java command not found"
**Solution**: Install Java (see above)

### Issue: "Emulators won't start"
**Solution**:
```bash
pkill -f firebase  # Kill any stuck processes
./start-emulators.sh  # Restart
```

### Issue: "Browser not found"
**Solution**:
```bash
npx playwright install chromium
```

### Issue: "Tests timing out"
**Solution**: Increase timeout in `playwright.config.js` or ensure emulators are running

### Issue: Port already in use
**Solution**:
```bash
# Check what's using port 5000
lsof -i :5000
# Kill the process
kill -9 <PID>
```

## Test Commands Reference

```bash
npm test              # Run all tests (headless)
npm run test:headed   # Run with visible browser
npm run test:ui       # Interactive UI mode
npm run test:debug    # Step-through debugging
npm run test:report   # View HTML report
npm run test:smoke    # Quick smoke test (no emulators)
```

## What Gets Tested

### Current Test Status (as of Nov 5, 2025)

- ✅ **Login/Authentication** - 12/12 passing
  - Form display and toggles
  - Sign up/sign in flows
  - Error handling
  - Password validation
  - Authorization checks

- ✅ **Dashboard** - 13/13 passing
  - Authentication redirects
  - Volunteer information display
  - Box status displays (good, problem, pickup alert)
  - Filtering (my boxes vs all boxes)
  - Clear status functionality

- ✅ **Box Action Center & Status Pages** - 19/19 passing
  - Public box action center (/box) - 5 tests
  - Public status page views - 4 tests
  - Authenticated status/history views - 10 tests
  - Report displays (problems, pickups, timestamps)
  - Status badges (New/Cleared)

- ⏳ **Location Setup** - Not yet tested
- ⏳ **Home Page** - Not yet tested
- ⏳ **Email Notifications** - Skipped (Mailgun not configured)

**Total: 44/44 passing (100%)**

### Test Organization

Tests are organized by authentication requirements:
- **Public tests** - No authentication needed
- **Authenticated tests** - Require user login and authorization
- Each authenticated test suite creates its own test user with proper authorization

## CI/CD Note

For CI/CD, emulators will start automatically. Set `CI=true` environment variable.
