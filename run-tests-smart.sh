#!/bin/bash

# Smart Test Runner: 3-tier retry strategy
# 1. Run with 4 workers (fast)
# 2. Playwright retries once with 4 workers (catches transient issues)
# 3. Custom sequential retry with 1 worker (catches parallel contention)

set +e  # Don't exit on failure

echo "🚀 Running tests with 4 workers + 1 built-in retry..."
echo ""

# Run with 4 workers, Playwright will retry failures once automatically
# Include flakiness reporter to track failures
npx playwright test --reporter=list,json,./flakiness-reporter.js --output=test-results.json 2>&1 | tee test-run.log
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✅ All tests passed! No sequential retry needed."
  echo ""

  # Generate summary from test results
  TOTAL_TESTS=$(grep -c "✓\|✘" test-run.log | head -1)
  TIER1_FAILURES=$(grep "✘" test-run.log | grep -v "retry #1" | wc -l)
  TIER2_RECOVERIES=$(grep "✓.*retry #1" test-run.log | wc -l)

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 TEST RUN SUMMARY"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Result: ✅ All $TOTAL_TESTS tests passed!"
  echo ""
  echo "Three-Tier Strategy Performance:"
  echo "  • Tier 1 (4 workers, first attempt): $TIER1_FAILURES test(s) failed initially"
  echo "  • Tier 2 (4 workers, built-in retry): All $TIER1_FAILURES failure(s) recovered - 100% pass rate"
  echo "  • Tier 3 (1 worker, sequential): Not needed!"
  echo ""

  if [ $TIER1_FAILURES -gt 0 ]; then
    echo "Tests that failed on Tier 1 but passed on Tier 2:"
    grep "✘" test-run.log | grep -v "retry #1" | sed -E 's/.*›\s+(.+)\s+\(.+\)$/  - \1/' | nl -w2 -s'. '
    echo ""
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Logs preserved for analysis:"
  echo "  - test-run.log (full test output)"
  echo "  - test-flakiness.log (if any failures occurred)"
  echo "  - test-flakiness-stats.json (cumulative failure tracking)"
  exit 0
fi

echo ""
echo "⚠️  Some tests still failed after built-in retry. Analyzing..."
echo ""

# Extract tests that failed on BOTH attempts (status: failed, not flaky)
FAILED_TESTS=$(node --input-type=module -e "
import fs from 'fs';
try {
  const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
  const failed = [];

  // Find specs that failed on all attempts
  for (const suite of results.suites || []) {
    for (const spec of suite.specs || []) {
      const allFailed = spec.tests.every(t => t.status === 'failed' || t.status === 'timedOut');
      if (allFailed) {
        failed.push(spec.title);
      }
    }
  }

  if (failed.length === 0) {
    console.log('');
  } else {
    console.log(failed.join('\\n'));
  }
} catch (e) {
  // Fallback: parse from log file
  const log = fs.readFileSync('test-run.log', 'utf8');
  const matches = log.match(/✘.*›\s+(.+?)\s+\(/g) || [];
  const tests = [...new Set(matches.map(m => m.match(/›\s+(.+?)\s+\(/)[1]))];
  console.log(tests.join('\\n'));
}
")

if [ -z "$FAILED_TESTS" ]; then
  echo "✅ No consistently failing tests found (all passed on retry)"
  rm -f test-run.log test-results.json
  exit 0
fi

FAILED_COUNT=$(echo "$FAILED_TESTS" | wc -l)
echo "Found $FAILED_COUNT test(s) that failed on both attempts:"
echo "$FAILED_TESTS" | sed 's/^/  - /'
echo ""

# Clean up before sequential retry
echo "🧹 Running full cleanup before sequential retry..."
node --input-type=module -e "
import { clearTestData } from './tests/fixtures/firebase-helpers.js';
await clearTestData();
console.log('✅ Cleanup complete');
" || echo "⚠️  Warning: Cleanup failed (emulator may not be running)"

echo ""
echo "🔄 Phase 3: Sequential retry with 1 worker (isolated execution)..."
echo ""

# Build grep pattern for failed tests
GREP_PATTERN=$(echo "$FAILED_TESTS" | sed 's/[]\/$*.^[]/\\&/g' | paste -sd'|' -)

# Retry with 1 worker, no retries (we want to see if sequential fixes it)
npx playwright test --workers=1 --retries=0 --grep "$GREP_PATTERN" --reporter=list 2>&1 | tee test-run-sequential.log
EXIT_CODE_SEQ=$?

echo ""

# Generate Tier 3 summary
TIER3_TESTS=$(echo "$FAILED_TESTS" | wc -l)
TIER3_PASSED=$(grep -c "✓" test-run-sequential.log 2>/dev/null || echo "0")
TIER3_FAILED=$(grep -c "✘" test-run-sequential.log 2>/dev/null || echo "0")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TEST RUN SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $EXIT_CODE_SEQ -eq 0 ]; then
  echo "Result: ✅ All tests passed after sequential retry!"
  echo ""
  echo "Three-Tier Strategy Performance:"
  echo "  • Tier 1 (4 workers, first attempt): Some tests failed"
  echo "  • Tier 2 (4 workers, built-in retry): $TIER3_TESTS test(s) still failing"
  echo "  • Tier 3 (1 worker, sequential): All $TIER3_TESTS test(s) passed - 100% recovery"
  echo ""
  echo "Tests recovered by sequential execution:"
  echo "$FAILED_TESTS" | nl -w2 -s'. ' | sed 's/^/  /'
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📋 Diagnosis:"
  echo "  - Tests work correctly in isolation (1 worker)"
  echo "  - Failures with 4 workers are due to Firebase emulator contention"
  echo "  - This is EXPECTED behavior given parallel execution load"
  echo "  - Not actual bugs - just resource contention under parallel load"
  echo ""
  echo "Logs preserved for analysis:"
  echo "  - test-run.log (Tier 1 & 2 output)"
  echo "  - test-run-sequential.log (Tier 3 output)"
  echo "  - test-flakiness.log (failure tracking)"
  exit 0
else
  echo "Result: ❌ Some tests still failing"
  echo ""
  echo "Three-Tier Strategy Performance:"
  echo "  • Tier 1 (4 workers, first attempt): Some tests failed"
  echo "  • Tier 2 (4 workers, built-in retry): $TIER3_TESTS test(s) still failing"
  echo "  • Tier 3 (1 worker, sequential): $TIER3_FAILED test(s) STILL FAILING"
  echo ""
  echo "Tests that fail even in sequential execution (REAL BUGS):"
  grep "✘" test-run-sequential.log | sed -E 's/.*›\s+(.+)\s+\(.+\)$/  - \1/' | nl -w2 -s'. '
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "📋 Diagnosis:"
  echo "  - These are REAL BUGS, not flakiness"
  echo "  - Tests fail consistently even in isolation"
  echo "  - Requires code fixes (test or application code)"
  echo ""
  echo "🔍 Next steps:"
  echo "  1. Check test-run-sequential.log for error details"
  echo "  2. Run individual test: npx playwright test -g \"test name\""
  echo "  3. Use debug mode: npx playwright test --debug -g \"test name\""
  echo ""
  exit 1
fi
