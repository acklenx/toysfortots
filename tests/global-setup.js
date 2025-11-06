/**
 * Global Setup - Runs once before all tests
 * Clears all test data to start with a clean slate
 */

import { clearTestData } from './fixtures/firebase-helpers.js';

export default async function globalSetup() {
  console.log('🧹 Global Setup: Clearing all test data...');
  await clearTestData();
  console.log('✅ Test data cleared');
}
