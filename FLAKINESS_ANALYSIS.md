# Test Flakiness Analysis

## Summary (3 Test Runs with 4 Workers)

**Total Tests**: 75
**Consistently Failing (3/3)**: 3 tests
**Flaky (1-2/3)**: 12 tests  
**Consistently Passing**: 60 tests

## Consistently Failing Tests (100% failure rate)

### 1. Box Action Center (/box) > should display box information
- **Failures**: 3/3
- **Pattern**: Element stuck in "Loading location data..." state
- **Root Cause**: Data not loading from Firestore, likely race condition
- **Fix Priority**: HIGH - suggests underlying code issue

### 2. Dashboard Page > should display boxes with pickup alert status
- **Failures**: 3/3
- **Pattern**: `.box-card` elements not found
- **Root Cause**: Dashboard not rendering boxes, possibly data not loading
- **Fix Priority**: HIGH - suggests underlying code issue

### 3. Setup Page > should redirect to status page if box already exists
- **Failures**: 3/3
- **Pattern**: Timeout waiting for URL redirect
- **Root Cause**: Redirect logic not executing properly
- **Fix Priority**: HIGH - suggests underlying code issue

## Flaky Tests (33-67% failure rate)

### Dashboard Tests (Loading state issues)
1. **should display dashboard for authorized user** (2/3 failures)
   - Error: `net::ERR_ABORTED` on page load
   
2. **should display message when no boxes exist** (2/3 failures)
   - Stuck in "Loading..." state

3. **should display boxes with good status** (2/3 failures)
   - Stuck in "Loading..." state

4. **should display boxes with problem status** (1/3 failures)
   - Stuck in "Loading..." state

5. **should sign out user when sign out button clicked** (1/3 failures)
   - Timing issue

6. **should show clear status button for pending reports** (1/3 failures)
   - Element not found

7. **should have view history link** (1/3 failures)
   - Element not found

8. **should filter boxes by volunteer** (1/3 failures)
   - Stuck in "Loading..." state

### Status Page Tests
1. **should display contact information** (1/3 failures)
   - Data not loading properly

2. **Authenticated View > should display multiple reports** (1/3 failures)
   - Data loading race condition

3. **Authenticated View > should display problem reports with styling** (2/3 failures)
   - Elements not found

4. **Authenticated View > should display pickup alerts correctly** (2/3 failures)
   - Data not rendering

## Root Cause Analysis

### Primary Issue: Race Conditions in Data Loading
Most failures show elements stuck in "Loading..." state, indicating:
1. Firestore queries not completing
2. No proper wait for data to load before assertions
3. Race conditions between test data setup and page queries

### Secondary Issue: Page Load Failures
- Some dashboard tests fail with `net::ERR_ABORTED`
- Suggests timing issue with parallel test execution

## Hypothesis
The dashboard and status pages load data from Firestore on page load. With 4 parallel workers:
1. Multiple tests seed/clear data simultaneously
2. Firestore emulator may have contention
3. Pages query before data is fully committed
4. Tests assert before async data loads complete

## Fix Strategy

### Phase 1: Fix Underlying Code (Not Tests)
1. **Add proper loading state management** in dashboard/status pages
2. **Add retry logic** for Firestore queries
3. **Ensure data commitment** before returning from seed functions
4. **Add waitForFunction** in code to ensure data loads

### Phase 2: Improve Test Robustness  
1. Add proper waits for data to appear (not just timeouts)
2. Use `waitForFunction` to poll for data loading completion
3. Consider sequential test execution for data-heavy tests

### Phase 3: Validate
1. Run with 1 worker to isolate parallelism issues
2. Run with 2, then 4 workers to find breaking point
3. Aim for 5 consecutive clean runs with 4 workers
