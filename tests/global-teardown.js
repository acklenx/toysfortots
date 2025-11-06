/**
 * Global Teardown - Runs once after all tests
 * Clears all test data for cleanup
 */

import { clearTestData } from './fixtures/firebase-helpers.js';

export default async function globalTeardown() {
  console.log('🧹 Global Teardown: Clearing all test data...');
  await clearTestData();
  console.log('✅ Test data cleared');
}
