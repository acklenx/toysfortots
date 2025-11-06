export default {
  testEnvironment: 'jsdom',
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/public/js/__tests__/**/*.test.js'
  ],
  collectCoverageFrom: [
    'public/js/**/*.js',
    '!public/js/firebase-init.js', // Exclude Firebase config
    '!public/js/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.js'],
  testTimeout: 5000,
  transform: {} // Disable transformation to use native ES modules
};
