#!/bin/bash

# Smoke test runner - runs box tests serially first, then other tests in parallel
# This avoids Firestore emulator consistency issues while keeping most tests fast

set -e

echo "🧪 Running smoke tests in optimized order..."
echo ""

# Step 1: Run box tests serially (workers=1) to avoid Firestore emulator issues
echo "📦 Step 1: Running box tests serially (workers=1)..."
npx playwright test tests/e2e/box-and-status.spec.js \
  --config=playwright.smoke.config.js \
  --workers=1

echo ""
echo "✅ Box tests completed"
echo ""

# Step 2: Run all other smoke tests in parallel (workers=4)
echo "⚡ Step 2: Running other tests in parallel (workers=4)..."
npx playwright test \
  tests/e2e/authorize.spec.js \
  tests/e2e/home.spec.js \
  tests/e2e/login.spec.js \
  tests/e2e/setup.spec.js \
  --config=playwright.smoke.config.js \
  --workers=4

echo ""
echo "✅ All smoke tests completed!"
