# Quick Start: E2E Testing Setup

## Prerequisites Installation

Run the automated setup script to install all dependencies:

```bash
./setup-tests.sh
```

This script will install:
- Java Runtime Environment (for Firebase Emulators)
- Playwright system dependencies
- Playwright Chromium browser

**Note:** The script requires `sudo` access for system-level installations.

## Manual Installation (Alternative)

If you prefer to install manually:

### 1. Install Java
```bash
sudo apt update
sudo apt install -y default-jre
java -version  # Verify installation
```

### 2. Install Playwright System Dependencies
```bash
sudo apt-get install -y libnspr4 libnss3 libasound2t64
```

### 3. Install Playwright Browsers
```bash
npx playwright install chromium
```

## Running Tests

### Method 1: Two Terminal Approach (Recommended)

**Terminal 1 - Start Firebase Emulators:**
```bash
./start-emulators.sh
```
Wait for: `✔ All emulators ready!`

**Terminal 2 - Run Tests:**
```bash
npm test                 # All tests (headless)
npm run test:headed      # With visible browser
npm run test:ui          # Interactive UI mode
npm run test:debug       # Step-through debugging
```

### Method 2: Single Terminal

```bash
# Start emulators in background
./start-emulators.sh &

# Wait for emulators to start
sleep 10

# Run tests
npm test

# Stop emulators when done
pkill -f firebase
```

## Test Commands Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests headless |
| `npm run test:headed` | Run with visible browser |
| `npm run test:ui` | Interactive Playwright UI |
| `npm run test:debug` | Debug mode with step-through |
| `npm run test:report` | View HTML report of last run |

## Test Suite Overview

**Total: 69+ comprehensive E2E tests**

### Test Files
- `login.spec.js` (12 tests) - Authentication flows
- `dashboard.spec.js` (13 tests) - Volunteer dashboard
- `setup.spec.js` (15 tests) - Location provisioning
- `box-and-status.spec.js` (12+ tests) - Box action center & status
- `home.spec.js` (17 tests) - Home page & location display

### What Gets Tested
✅ User authentication (email, Google OAuth flows)
✅ Authorization checks
✅ Form validation
✅ Box provisioning workflow
✅ Report creation and display
✅ Status filtering
✅ Navigation and redirects
✅ Anonymous access
✅ Error handling
✅ Edge cases (missing IDs, unauthorized users, etc.)

## Running Specific Tests

### Single Test File
```bash
npx playwright test tests/e2e/login.spec.js
```

### Single Test by Name
```bash
npx playwright test -g "should display login form"
```

### Specific Test Suite
```bash
npx playwright test tests/e2e/dashboard.spec.js --headed
```

## Firebase Emulator Ports

When emulators are running:
- **Emulator UI**: http://localhost:4000
- **Hosting**: http://localhost:5000
- **Auth**: localhost:9099
- **Firestore**: localhost:8080
- **Functions**: localhost:5001

## Troubleshooting

### Issue: Java not found
```bash
sudo apt install default-jre
```

### Issue: Browser dependencies missing
```bash
sudo npx playwright install-deps chromium
```

### Issue: Emulators won't start
```bash
pkill -f firebase  # Kill stuck processes
./start-emulators.sh  # Restart
```

### Issue: Port already in use
```bash
lsof -i :5000  # Check what's using port
kill -9 <PID>  # Kill the process
```

### Issue: Tests timing out
- Ensure emulators are running and accessible
- Increase timeout in test: `test('...', async ({ page }) => { ... }, { timeout: 30000 })`

## Test Results

After running tests, check:
- **Console output**: Real-time test progress
- **test-results/**: Screenshots, videos, traces of failures
- **playwright-report/**: HTML report (view with `npm run test:report`)

## CI/CD Integration

For CI/CD pipelines, the emulators start automatically when `CI=true`:

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright
  run: npx playwright install chromium --with-deps

- name: Run tests
  run: npm test
  env:
    CI: true
```

## Best Practices

1. **Always start emulators first** before running tests
2. **Run tests sequentially** (current config uses 1 worker to avoid conflicts)
3. **Check emulator UI** (http://localhost:4000) when debugging
4. **Use headed mode** (`--headed`) when developing new tests
5. **Clean up regularly**: Stop emulators between test runs if experiencing issues

## Next Steps

1. ✅ Run the setup script: `./setup-tests.sh`
2. ✅ Start emulators: `./start-emulators.sh`
3. ✅ Run your first test: `npm test`
4. ✅ View the report: `npm run test:report`

## Additional Resources

- Full documentation: [tests/README.md](tests/README.md)
- Testing setup guide: [TESTING_SETUP.md](TESTING_SETUP.md)
- Playwright docs: https://playwright.dev/
- Firebase Emulator Suite: https://firebase.google.com/docs/emulator-suite

---

**Ready to test!** 🎭🧪

Run `./setup-tests.sh` to begin.
