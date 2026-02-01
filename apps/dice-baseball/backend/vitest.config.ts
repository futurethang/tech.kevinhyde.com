import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        '**/__tests__/**',
        '**/types/**',
        '**/node_modules/**',
        'vitest.config.ts',
        'src/index.ts', // Entry point - not unit testable
      ],
      thresholds: {
        // Phase 2 thresholds - functions lower due to placeholder DB functions
        statements: 85,
        branches: 80,
        functions: 75,
        lines: 85,
      },
    },
    // Fail fast in CI
    bail: process.env.CI ? 1 : 0,
  },
});
