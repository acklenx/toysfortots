// Jest setup file for unit tests
// This file runs before each test file

// Setup DOM environment
global.document = window.document;
global.window = window;
global.navigator = window.navigator;

// Mock console methods if needed for cleaner test output
// Uncomment if you want to suppress console output during tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
