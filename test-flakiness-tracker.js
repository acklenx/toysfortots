/**
 * Test Flakiness Tracker
 * Logs test failures with timestamps to help identify and eliminate flaky tests
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(__dirname, 'test-flakiness.log');
const STATS_FILE = path.join(__dirname, 'test-flakiness-stats.json');

class FlakinessTracker {
  constructor() {
    this.stats = this.loadStats();
  }

  loadStats() {
    if (fs.existsSync(STATS_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  saveStats() {
    fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2));
  }

  recordFailure(testName, error, metadata = {}) {
    const timestamp = new Date().toISOString();

    // Initialize test stats if not exists
    if (!this.stats[testName]) {
      this.stats[testName] = {
        totalFailures: 0,
        firstFailure: timestamp,
        lastFailure: timestamp,
        failures: []
      };
    }

    // Update stats
    this.stats[testName].totalFailures++;
    this.stats[testName].lastFailure = timestamp;
    this.stats[testName].failures.push({
      timestamp,
      error: error.message || String(error),
      ...metadata
    });

    // Write to log file
    const logEntry = `[${timestamp}] FAILURE: ${testName}\n` +
                     `  Error: ${error.message || String(error)}\n` +
                     `  Metadata: ${JSON.stringify(metadata)}\n` +
                     `  Total failures for this test: ${this.stats[testName].totalFailures}\n\n`;

    fs.appendFileSync(LOG_FILE, logEntry);

    // Save updated stats
    this.saveStats();
  }

  recordSuccess(testName) {
    const timestamp = new Date().toISOString();

    if (!this.stats[testName]) {
      this.stats[testName] = {
        totalFailures: 0,
        totalSuccesses: 0,
        firstSuccess: timestamp
      };
    }

    this.stats[testName].totalSuccesses = (this.stats[testName].totalSuccesses || 0) + 1;
    this.saveStats();
  }

  getFlakiestTests(limit = 10) {
    return Object.entries(this.stats)
      .sort(([, a], [, b]) => b.totalFailures - a.totalFailures)
      .slice(0, limit)
      .map(([name, stats]) => ({ name, ...stats }));
  }

  generateReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      totalTests: Object.keys(this.stats).length,
      testsWithFailures: Object.values(this.stats).filter(s => s.totalFailures > 0).length,
      flakiestTests: this.getFlakiestTests(10)
    };

    const reportPath = path.join(__dirname, 'test-flakiness-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('\n=== Test Flakiness Report ===');
    console.log(`Total tests tracked: ${report.totalTests}`);
    console.log(`Tests with failures: ${report.testsWithFailures}`);
    console.log('\nFlakiest tests:');
    report.flakiestTests.forEach((test, i) => {
      console.log(`${i + 1}. ${test.name}`);
      console.log(`   Failures: ${test.totalFailures}`);
      console.log(`   Last failure: ${test.lastFailure}`);
    });

    return report;
  }

  clearStats() {
    this.stats = {};
    this.saveStats();
    if (fs.existsSync(LOG_FILE)) {
      fs.unlinkSync(LOG_FILE);
    }
  }
}

const tracker = new FlakinessTracker();
export default tracker;
