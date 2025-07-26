// Test setup file
// This file runs before each test suite

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/zeabur_demo';

// Global test timeout
jest.setTimeout(30000);

// Global test setup
const TestUtils = require('./helpers/testUtils');

beforeAll(async () => {
  // Setup test database
  await TestUtils.setupTestDatabase();
});

// Clean up after each test
afterEach(async () => {
  // Clean up test data
  await TestUtils.cleanupTestDatabase();
});