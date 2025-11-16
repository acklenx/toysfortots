#!/bin/bash

# Smoke test runner - 2 tranches for optimal speed and reliability
# Tranche 1 (Sequential): 4 tests that need serial execution (1 worker)
# Tranche 2 (Parallel): 8 tests that can run in parallel (4 workers)

set -e

echo "🧪 Running smoke tests in 2 tranches..."
echo ""

# Tranche 1: Sequential smoke tests (4 tests, 1 worker)
echo "📋 Tranche 1: Running sequential smoke tests (workers=1)..."
npx playwright test --grep @smoke-sequential --workers=1 --config=playwright.smoke.config.js

echo ""
echo "✅ Tranche 1 completed (4 tests)"
echo ""

# Tranche 2: Parallel smoke tests (8 tests, 4 workers)
echo "⚡ Tranche 2: Running parallel smoke tests (workers=4)..."
npx playwright test --grep @smoke-parallel --workers=4 --config=playwright.smoke.config.js

echo ""
echo "✅ All smoke tests completed! (12 tests total)"
