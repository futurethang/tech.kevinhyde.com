import { beforeAll, afterAll, beforeEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_JWT_SECRET = 'test-secret-key-for-testing-only';

beforeAll(async () => {
  // Global setup before all tests
  console.log('🧪 Starting test suite...');
});

afterAll(async () => {
  // Global cleanup after all tests
  console.log('✅ Test suite completed');
});

beforeEach(() => {
  // Reset any mocks or state before each test
});
