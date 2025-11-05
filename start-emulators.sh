#!/bin/bash

# Start Firebase Emulators for Testing
# This script starts the Firebase emulators needed for E2E tests

echo "Starting Firebase Emulators..."
echo ""
echo "Emulator UI will be available at: http://localhost:4000"
echo "Hosting will be available at: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the emulators"
echo ""

npx firebase emulators:start --only hosting,auth,firestore,functions
