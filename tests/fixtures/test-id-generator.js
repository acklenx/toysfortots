/**
 * Test ID Generator
 * Creates unique IDs for test data to prevent collisions in parallel execution
 */

let testCounter = 0;

/**
 * Generate a unique test ID combining worker ID, timestamp, and counter
 * Format: W{worker}_{timestamp}_{counter}
 */
export function generateTestId(prefix = '') {
  testCounter++;
  // Use multiple sources to get worker ID for maximum uniqueness
  const workerId = process.env.TEST_WORKER_INDEX ||
                   process.env.PLAYWRIGHT_WORKER_INDEX ||
                   process.env.TEST_PARALLEL_INDEX ||
                   Math.floor(Math.random() * 10000);
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 10000);
  const id = `W${workerId}_${timestamp}_${testCounter}_${randomSuffix}`;
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Generate unique username for tests
 */
export function generateUsername(base = 'testuser') {
  return `${base}${generateTestId()}`;
}

/**
 * Generate unique box ID for tests
 */
export function generateBoxId(base = 'BOX') {
  return `${base}_${generateTestId()}`;
}

/**
 * Reset counter (useful for test isolation, though not required with unique IDs)
 */
export function resetTestCounter() {
  testCounter = 0;
}
