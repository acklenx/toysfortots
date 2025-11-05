#!/bin/bash

# Check Test Setup Status
# This script verifies what is installed and what needs to be installed

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "=========================================="
echo "Test Setup Status Check"
echo "=========================================="
echo ""

MISSING=0

# Check Node.js
echo -n "Node.js: "
if command -v node &> /dev/null; then
    echo -e "${GREEN}✓${NC} $(node --version)"
else
    echo -e "${RED}✗ NOT INSTALLED${NC}"
    MISSING=$((MISSING + 1))
fi

# Check npm
echo -n "npm: "
if command -v npm &> /dev/null; then
    echo -e "${GREEN}✓${NC} $(npm --version)"
else
    echo -e "${RED}✗ NOT INSTALLED${NC}"
    MISSING=$((MISSING + 1))
fi

# Check Java
echo -n "Java: "
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2)
    echo -e "${GREEN}✓${NC} $JAVA_VERSION"
else
    echo -e "${RED}✗ NOT INSTALLED${NC} (required for Firebase Emulators)"
    echo -e "  ${YELLOW}→ Install with: sudo apt install default-jre${NC}"
    MISSING=$((MISSING + 1))
fi

# Check Playwright package
echo -n "Playwright package: "
if [ -d "node_modules/@playwright/test" ]; then
    PW_VERSION=$(npm list @playwright/test --depth=0 2>/dev/null | grep @playwright/test | grep -oP '@\K[0-9.]+')
    echo -e "${GREEN}✓${NC} v$PW_VERSION"
else
    echo -e "${RED}✗ NOT INSTALLED${NC}"
    echo -e "  ${YELLOW}→ Install with: npm install${NC}"
    MISSING=$((MISSING + 1))
fi

# Check Playwright browsers
echo -n "Playwright browsers: "
if [ -d "$HOME/.cache/ms-playwright/chromium-"* ] 2>/dev/null; then
    BROWSER_DIR=$(ls -d $HOME/.cache/ms-playwright/chromium-* 2>/dev/null | head -1)
    if [ -n "$BROWSER_DIR" ]; then
        echo -e "${GREEN}✓${NC} Chromium installed"
    else
        echo -e "${YELLOW}⚠ Partially installed${NC}"
        echo -e "  ${YELLOW}→ Complete with: npx playwright install chromium${NC}"
        MISSING=$((MISSING + 1))
    fi
else
    echo -e "${RED}✗ NOT INSTALLED${NC}"
    echo -e "  ${YELLOW}→ Install with: npx playwright install chromium${NC}"
    MISSING=$((MISSING + 1))
fi

# Check system dependencies for Playwright
echo -n "Playwright system deps: "
DEPS_MISSING=0
for lib in libnspr4 libnss3 libasound2t64; do
    if ! dpkg -l | grep -q "^ii  $lib"; then
        DEPS_MISSING=$((DEPS_MISSING + 1))
    fi
done

if [ $DEPS_MISSING -eq 0 ]; then
    echo -e "${GREEN}✓${NC} All required libraries installed"
else
    echo -e "${RED}✗ MISSING $DEPS_MISSING libraries${NC}"
    echo -e "  ${YELLOW}→ Install with: sudo apt-get install libnspr4 libnss3 libasound2t64${NC}"
    MISSING=$((MISSING + 1))
fi

# Check Firebase tools
echo -n "Firebase tools: "
if [ -d "node_modules/firebase-tools" ]; then
    FB_VERSION=$(npm list firebase-tools --depth=0 2>/dev/null | grep firebase-tools | grep -oP '@\K[0-9.]+')
    echo -e "${GREEN}✓${NC} v$FB_VERSION"
else
    echo -e "${RED}✗ NOT INSTALLED${NC}"
    echo -e "  ${YELLOW}→ Install with: npm install${NC}"
    MISSING=$((MISSING + 1))
fi

# Check test files
echo -n "Test files: "
if [ -d "tests/e2e" ]; then
    TEST_COUNT=$(find tests/e2e -name "*.spec.js" 2>/dev/null | wc -l)
    if [ $TEST_COUNT -gt 0 ]; then
        echo -e "${GREEN}✓${NC} $TEST_COUNT test files found"
    else
        echo -e "${RED}✗ No test files found${NC}"
        MISSING=$((MISSING + 1))
    fi
else
    echo -e "${RED}✗ Test directory not found${NC}"
    MISSING=$((MISSING + 1))
fi

# Check Playwright config
echo -n "Playwright config: "
if [ -f "playwright.config.js" ]; then
    echo -e "${GREEN}✓${NC} Found"
else
    echo -e "${RED}✗ NOT FOUND${NC}"
    MISSING=$((MISSING + 1))
fi

# Check Firebase config
echo -n "Firebase config: "
if [ -f "firebase.json" ]; then
    echo -e "${GREEN}✓${NC} Found"
else
    echo -e "${RED}✗ NOT FOUND${NC}"
    MISSING=$((MISSING + 1))
fi

# Check emulator script
echo -n "Emulator start script: "
if [ -f "start-emulators.sh" ]; then
    echo -e "${GREEN}✓${NC} Found"
else
    echo -e "${YELLOW}⚠ NOT FOUND${NC}"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""

if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}✓ All dependencies are installed!${NC}"
    echo ""
    echo "You're ready to run tests:"
    echo ""
    echo "  ${BLUE}1.${NC} Start emulators: ${YELLOW}./start-emulators.sh${NC}"
    echo "  ${BLUE}2.${NC} Run tests:       ${YELLOW}npm test${NC}"
    echo ""
else
    echo -e "${RED}✗ Missing $MISSING dependencies${NC}"
    echo ""
    echo "To install all missing dependencies, run:"
    echo ""
    echo "  ${YELLOW}./setup-tests.sh${NC}"
    echo ""
    echo "Or install manually using the commands shown above."
    echo ""
fi

echo "=========================================="
