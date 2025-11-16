#!/bin/bash
# Run E2E tests multiple times to check for flakiness

echo "=== E2E Test Stability Check ==="
echo "Running tests 5 times..."
echo ""

PASS_COUNT=0
FAIL_COUNT=0

for i in {1..5}; do
  echo "▶ Run $i/5"

  if npx playwright test tests/e2e/e2e-full-journey.spec.js --workers=1 > /tmp/test-run-$i.log 2>&1; then
    RESULT=$(grep -E "[0-9]+ passed" /tmp/test-run-$i.log | tail -1)
    echo "  ✓ PASSED - $RESULT"
    ((PASS_COUNT++))
  else
    RESULT=$(grep -E "[0-9]+ (passed|failed)" /tmp/test-run-$i.log | tail -1)
    echo "  ✗ FAILED - $RESULT"
    ((FAIL_COUNT++))
    # Show which tests failed
    grep -E "✗|failed" /tmp/test-run-$i.log | head -5
  fi

  # Show any flakiness warnings
  if grep -q "⚠️" /tmp/test-run-$i.log; then
    grep "⚠️" /tmp/test-run-$i.log | head -3
  fi

  echo ""
done

echo "=== Summary ==="
echo "Passed: $PASS_COUNT/5"
echo "Failed: $FAIL_COUNT/5"

if [ $FAIL_COUNT -eq 0 ]; then
  echo "✅ All runs passed - tests are stable!"
  exit 0
else
  echo "⚠️  Some runs failed - tests need stabilization"
  exit 1
fi
