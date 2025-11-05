#!/bin/bash

# Comprehensive Test Setup Script for Toys for Tots
# This script installs all dependencies needed for E2E testing

set -e  # Exit on error

echo "=========================================="
echo "Toys for Tots - E2E Test Setup"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running in WSL
if grep -qi microsoft /proc/version; then
    echo -e "${GREEN}✓${NC} Running in WSL/Linux environment"
else
    echo -e "${YELLOW}⚠${NC} Not running in WSL, but continuing..."
fi

echo ""
echo "=========================================="
echo "Step 1: Installing Java (for Firebase Emulators)"
echo "=========================================="
echo ""

if command -v java &> /dev/null; then
    echo -e "${GREEN}✓${NC} Java is already installed:"
    java -version 2>&1 | head -1
else
    echo "Installing Java Runtime Environment..."
    sudo apt update
    sudo apt install -y default-jre
    echo -e "${GREEN}✓${NC} Java installed successfully"
    java -version 2>&1 | head -1
fi

echo ""
echo "=========================================="
echo "Step 2: Installing Playwright System Dependencies"
echo "=========================================="
echo ""

echo "Installing required system libraries for Playwright..."
sudo apt-get install -y libnspr4 libnss3 libasound2t64 libatk-bridge2.0-0 libatk1.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2

echo -e "${GREEN}✓${NC} System dependencies installed"

echo ""
echo "=========================================="
echo "Step 3: Installing Playwright Browsers"
echo "=========================================="
echo ""

echo "Installing Chromium browser for Playwright..."
npx playwright install chromium
echo -e "${GREEN}✓${NC} Playwright browsers installed"

echo ""
echo "=========================================="
echo "Step 4: Verifying Installation"
echo "=========================================="
echo ""

# Check Node.js
if command -v node &> /dev/null; then
    echo -e "${GREEN}✓${NC} Node.js: $(node --version)"
else
    echo -e "${RED}✗${NC} Node.js not found!"
    exit 1
fi

# Check npm packages
if [ -d "node_modules/@playwright/test" ]; then
    echo -e "${GREEN}✓${NC} Playwright test package installed"
else
    echo -e "${RED}✗${NC} Playwright test package not found!"
    exit 1
fi

if [ -d "node_modules/firebase-tools" ]; then
    echo -e "${GREEN}✓${NC} Firebase tools installed"
else
    echo -e "${RED}✗${NC} Firebase tools not found!"
    exit 1
fi

# Check Java
if command -v java &> /dev/null; then
    echo -e "${GREEN}✓${NC} Java installed"
else
    echo -e "${RED}✗${NC} Java not found!"
    exit 1
fi

# Check test files
if [ -d "tests/e2e" ]; then
    TEST_COUNT=$(find tests/e2e -name "*.spec.js" | wc -l)
    echo -e "${GREEN}✓${NC} Found ${TEST_COUNT} test files"
else
    echo -e "${RED}✗${NC} Test directory not found!"
    exit 1
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo ""
echo "1. Start Firebase Emulators (in Terminal 1):"
echo "   ${YELLOW}./start-emulators.sh${NC}"
echo ""
echo "2. Run tests (in Terminal 2):"
echo "   ${YELLOW}npm test${NC}                 # Run all tests (headless)"
echo "   ${YELLOW}npm run test:headed${NC}      # Run with visible browser"
echo "   ${YELLOW}npm run test:ui${NC}          # Interactive UI mode"
echo "   ${YELLOW}npm run test:debug${NC}       # Debug mode"
echo ""
echo "3. View test results:"
echo "   ${YELLOW}npm run test:report${NC}      # View HTML report"
echo ""
echo "=========================================="
echo "Quick Test (without emulators):"
echo "   ${YELLOW}npx playwright test tests/e2e/login.spec.js --grep 'should display login form'${NC}"
echo "=========================================="
echo ""
