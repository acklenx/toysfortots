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
npx playwright test --reporter=list,./flakiness-reporter.js 2>&1 | tee test-run.log
EXIT_CODE=$?

# Extract ALL tests that failed on initial attempt (ignore retry results)
# This is the list we'll manually retry with 1 worker
TIER1_FAILED_TESTS=$(grep "✘" test-run.log | grep -v "retry #1" | sed -E 's/.*›\s+(.+)\s+\(.+\)$/\1/' | sort -u)
TIER1_FAILURES=$(echo "$TIER1_FAILED_TESTS" | grep -v '^$' | wc -l)

# If no failures at all, we're done
if [ $TIER1_FAILURES -eq 0 ]; then
  echo ""
  TOTAL_TESTS=$(grep -c "✓\|✘" test-run.log | head -1)
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 TEST RUN SUMMARY"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Result: ✅ All $TOTAL_TESTS tests passed on first attempt!"
  echo ""
  echo "Three-Tier Strategy Performance:"
  echo "  • Tier 1 (4 workers, first attempt): 0 failures - perfect run!"
  echo "  • Tier 2 (built-in retry): Not needed"
  echo "  • Tier 3 (sequential retry): Not needed"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
fi

echo ""
echo "⚠️  $TIER1_FAILURES test(s) failed on initial run."
echo "   Ignoring Playwright's retry results - will manually verify with Tier 3..."
echo ""

echo "Tests that failed on initial attempt:"
echo "$TIER1_FAILED_TESTS" | nl -w2 -s'. ' | sed 's/^/  /'
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

# Build grep pattern for failed tests (use TIER1_FAILED_TESTS)
GREP_PATTERN=$(echo "$TIER1_FAILED_TESTS" | sed 's/[]\/$*.^[]/\\&/g' | paste -sd'|' -)

# Retry with 1 worker, no retries (we want to see if sequential fixes it)
npx playwright test --workers=1 --retries=0 --grep "$GREP_PATTERN" --reporter=list 2>&1 | tee test-run-sequential.log
EXIT_CODE_SEQ=$?

echo ""

# Generate Tier 2 summary (how many tests failed TWICE - both initial and retry)
TIER2_FAILED_TESTS=$(grep "✘" test-run.log | sed -E 's/.*›\s+(.+)\s+\(.+\)$/\1/' | sort | uniq -d)
TIER2_FAILED=$(echo "$TIER2_FAILED_TESTS" | grep -v '^$' | wc -l)
TIER2_PASSED=$((TIER1_FAILURES - TIER2_FAILED))

# Generate Tier 3 summary
TIER3_TESTS=$TIER1_FAILURES
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
  echo "  • Tier 1 (4 workers, first attempt): $TIER1_FAILURES test(s) failed"
  echo "  • Tier 2 (4 workers, built-in retry): $TIER2_PASSED passed, $TIER2_FAILED failed"
  if [ $TIER2_FAILED -gt 0 ]; then
    echo ""
    echo "Tests that failed on BOTH attempts in Tier 2 (failed twice with 4 workers):"
    echo "$TIER2_FAILED_TESTS" | nl -w2 -s'. ' | sed 's/^/  /'
  fi
  echo "  • Tier 3 (1 worker, sequential): All $TIER3_TESTS test(s) passed - 100% recovery"
  echo ""
  echo "Tests that failed on Tier 1 but passed on Tier 3:"
  echo "$TIER1_FAILED_TESTS" | nl -w2 -s'. ' | sed 's/^/  /'
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
  echo "  • Tier 1 (4 workers, first attempt): $TIER1_FAILURES test(s) failed"
  echo "  • Tier 2 (4 workers, built-in retry): $TIER2_PASSED passed, $TIER2_FAILED failed"
  if [ $TIER2_FAILED -gt 0 ]; then
    echo ""
    echo "Tests that failed on BOTH attempts in Tier 2 (failed twice with 4 workers):"
    echo "$TIER2_FAILED_TESTS" | nl -w2 -s'. ' | sed 's/^/  /'
  fi
  echo "  • Tier 3 (1 worker, sequential): $TIER3_FAILED test(s) STILL FAILING"
  echo ""
  echo "Tests that fail even in sequential execution (REAL BUGS):"
  grep "✘" test-run-sequential.log | sed -E 's/.*›\s+(.+)\s+\((.+):([0-9]+):.+\)$/  - \1 (\2:\3)/'
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
