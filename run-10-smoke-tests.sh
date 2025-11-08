#!/bin/bash

# Run smoke tests 10 times to test for flakiness

for i in 1 2 3 4 5 6 7 8 9 10; do
  echo ""
  echo "========================================="
  echo "=== Smoke Test Run $i of 10 ==="
  echo "========================================="
  npm run test:smoke 2>&1 | tee /tmp/smoke-run-$i.log
  pkill -f "http-server.*playwright-report" 2>/dev/null || true
  echo ""
  echo "Run $i complete. Summary:"
  grep -E "flaky|passed|failed" /tmp/smoke-run-$i.log | grep -v "Step\|Running\|Box tests" | tail -n 2 || echo "Tests completed"
  sleep 1
done

echo ""
echo "================================================"
echo "  FINAL REPORT: 10 TEST RUNS COMPLETE"
echo "================================================"
echo ""
for i in 1 2 3 4 5 6 7 8 9 10; do
  echo "Run $i:"
  grep -E "flaky|passed" /tmp/smoke-run-$i.log | grep -v "Step\|Running\|Box tests" | tail -n 2
done
