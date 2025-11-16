# End-to-End Test Suites Documentation

## Overview

This document describes the comprehensive End-to-End (E2E) test suites for the Toys for Tots application. We have two main E2E test suites:

1. **Production E2E Tests** - Run against the live production site
2. **Local E2E Tests** - Run against Firebase emulators

Both suites use festive North Pole themed test data for easy identification and fun testing experience.

## Production E2E Test Suite

### Purpose
Tests the complete volunteer journey on the LIVE production site at https://toysfortots.mcl1311.com

### ⚠️ IMPORTANT WARNING
**These tests CREATE REAL TEST DATA in the production database!** The data is clearly marked with "TEST" prefixes and uses festive North Pole addresses, but it will remain in production unless manually cleaned up.

### Running Production E2E Tests

```bash
# Run full production E2E suite (recommended)
npm run test:production-e2e

# Alternative: Direct playwright command
npx playwright test --config=playwright.production-e2e.config.cjs
```

### Test Configuration
- **Single Worker**: Tests run sequentially with realistic timing
- **Longer Timeouts**: Accounts for production latencies
- **Full Evidence**: Always captures traces, screenshots, and videos
- **No Retries**: Prevents duplicate test data creation

### Test Data Theme
All test data uses a festive North Pole theme:

#### Test Users:
- 🎅 **Santa Claus** - Primary test volunteer
- 🦌 **Rudolph** - Secondary volunteer for permission testing
- ⛄ **Frosty the Snowman** - Unauthorized user testing
- 🎄 **The Grinch** - Additional multi-user scenarios (local only)

#### Test Locations:
- **Santa's Workshop** - North Pole, AK
- **Reindeer Stable** - North Pole, AK
- **Elf Village Toy Store** - North Pole, AK
- **Gingerbread House Bakery** - Rovaniemi, Lapland
- **Snowglobe Emporium** - Tromsø, Norway

### Test Scenarios Covered

1. **New Volunteer Signup**
   - QR code scanning simulation
   - Account creation
   - Box provisioning with passcode
   - Authorization flow

2. **Dashboard Operations**
   - Viewing provisioned boxes
   - Editing own boxes
   - Viewing other volunteers' boxes

3. **Public Reporting**
   - Anonymous box status reporting
   - Pickup requests
   - Report management

4. **Multi-User Permissions**
   - Cross-user visibility
   - Edit vs View permissions
   - Unauthorized access handling

5. **Edge Cases**
   - Missing box IDs
   - Invalid box IDs
   - Session persistence

### Production Test Passcode
Update the `PASSCODE` variable in `tests/production/production-e2e.spec.js` with the actual production passcode before running.

### Cleanup
Test data remains in production and is clearly marked with:
- "TEST" prefix in box IDs
- "TEST BOX" suffix in labels
- "(TEST)" suffix in user display names

Manual cleanup may be required through the Firebase Console if needed.

## Local E2E Test Suite (Emulator)

### Purpose
Comprehensive E2E tests running against Firebase emulators for safe, repeatable testing.

### Running Local E2E Tests

```bash
# Start Firebase emulators first
./start-emulators.sh

# Run E2E tests with single worker (recommended for E2E)
npm run test:e2e:local

# Run with default configuration
npm run test:e2e

# Run with UI for debugging
npx playwright test tests/e2e/e2e-full-journey.spec.js --ui
```

### Key Differences from Production
- **Auto Cleanup**: Data cleared before and after tests
- **Faster Execution**: No rate limiting
- **Safe to Run Repeatedly**: No production impact
- **Extended Scenarios**: Includes advanced concurrent user testing

### Additional Test Scenarios (Local Only)

1. **Concurrent User Interactions**
   - Multiple browser contexts
   - Simultaneous operations
   - Race condition handling

2. **Rapid Operations**
   - Quick navigation
   - Fast edit cycles
   - Performance under load

3. **Session Persistence**
   - Cookie handling
   - Multi-tab sessions
   - Auth state management

## Test Commands Summary

```bash
# Production Tests
npm run test:production          # Smoke tests only (READ-ONLY)
npm run test:production-e2e      # Full E2E (CREATES TEST DATA)

# Local Tests
npm run test:e2e                 # E2E with default workers
npm run test:e2e:local          # E2E with single worker
npm run test:smart              # All tests with smart retry
npm test                        # Standard test suite
```

## Test Results

### Screenshots and Videos
- Production E2E: `test-results-production-e2e/`
- Local E2E: `test-results/`

### Reports
- Production E2E: `playwright-report-production-e2e/`
- Local E2E: `playwright-report/`

View reports:
```bash
npx playwright show-report playwright-report-production-e2e
```

## Best Practices

### For Production Testing
1. **Schedule Wisely**: Run during low-traffic periods
2. **Monitor Impact**: Check for rate limiting or performance impact
3. **Document Runs**: Keep track of when tests were run
4. **Clean Up Periodically**: Remove old test data if accumulating
5. **Update Passcode**: Keep production passcode current

### For Local Testing
1. **Always Start Fresh**: Ensure emulators are running
2. **Check Data Cleanup**: Verify test data is cleared
3. **Run Before Commits**: Use local E2E as pre-commit check
4. **Debug with UI**: Use `--ui` flag for interactive debugging

## Troubleshooting

### Common Issues

#### Production Tests Failing
- **Wrong Passcode**: Update `PASSCODE` in test file
- **Rate Limiting**: Reduce test frequency
- **Site Changes**: Update selectors if UI changed
- **Network Issues**: Check internet connection

#### Local Tests Failing
- **Emulators Not Running**: Start with `./start-emulators.sh`
- **Port Conflicts**: Check ports 5000, 8080, 9099, 5001
- **Stale Data**: Run `clearTestData()` manually
- **Auth Issues**: Clear browser context

### Debug Commands

```bash
# Run specific test
npx playwright test -g "Santa explores the dashboard"

# Debug mode
npx playwright test --debug

# Headed mode (see browser)
npx playwright test --headed

# Slow motion
npx playwright test --headed --slow-mo=1000
```

## Test Data Identification

All test data is easily identifiable:

### Visual Markers
- 🎅 Santa emoji for workshop
- 🦌 Reindeer emoji for stable
- 🧝 Elf emoji for village
- 🍪 Cookie emoji for bakery
- ❄️ Snowflake emoji for snowglobe shop

### Text Markers
- "TEST_" prefix in all box IDs
- "(TEST BOX)" suffix in labels
- "(TEST)" suffix in user names
- North Pole/Lapland/Norway addresses

## Security Considerations

### Production Testing
- Test data is PUBLIC and visible on the live site
- Use non-sensitive test data only
- Avoid testing during critical business hours
- Monitor for any security warnings

### Local Testing
- Emulator data is isolated
- No production impact
- Safe for security testing
- Can test edge cases freely

## Future Enhancements

Potential improvements for the test suites:

1. **Automated Cleanup**: Add cleanup job for old production test data
2. **Performance Metrics**: Capture and track page load times
3. **Visual Regression**: Add screenshot comparison
4. **API Testing**: Direct Firestore and Cloud Function tests
5. **Load Testing**: Simulate multiple concurrent users
6. **Accessibility Testing**: Add WCAG compliance checks
7. **Cross-Browser**: Add Safari and Firefox testing
8. **Mobile Testing**: Add mobile viewport tests

## Contact

For questions or issues with the test suites:
- Create an issue in the GitHub repository
- Email: toysfortots@qlamail.com

---

*Happy Testing! May your tests be merry and bright!* 🎄✨