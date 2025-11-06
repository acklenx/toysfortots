/**
 * Custom Playwright Reporter for tracking test flakiness
 */

import tracker from './test-flakiness-tracker.js';

class FlakinessReporter {
  constructor(options) {
    this.options = options;
  }

  onBegin(config, suite) {
    console.log(`Starting test run with ${config.workers} workers`);
  }

  onTestEnd(test, result) {
    const testName = `${test.parent.title} > ${test.title}`;
    const metadata = {
      duration: result.duration,
      retry: result.retry,
      workerIndex: result.workerIndex
    };

    if (result.status === 'failed' || result.status === 'timedOut') {
      const error = result.error || new Error(`Test ${result.status}`);
      tracker.recordFailure(testName, error, metadata);
    } else if (result.status === 'passed') {
      tracker.recordSuccess(testName);
    }
  }

  onEnd(result) {
    console.log(`\nTest run finished: ${result.status}`);

    // Generate report if there were failures
    const stats = tracker.stats;
    const failedTests = Object.entries(stats).filter(([, s]) => s.totalFailures > 0);

    if (failedTests.length > 0) {
      console.log('\n⚠️  Tests with failures in this run:');
      failedTests.forEach(([name, stat]) => {
        console.log(`   - ${name} (${stat.totalFailures} total failures)`);
      });
    }
  }
}

export default FlakinessReporter;
