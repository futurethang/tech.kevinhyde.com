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
        '**/dist/**',
        '**/scripts/**',
        'vitest.config.ts',
        'src/index.ts', // Entry point - not unit testable
        'src/services/team-service.ts', // Placeholder - will be replaced with Supabase
      ],
      thresholds: {
        // Phase 3 thresholds - lower due to placeholder DB service functions
        // Will increase when Supabase integration is added
        statements: 80,
        branches: 80,
        functions: 50,
        lines: 80,
      },
    },
    // Fail fast in CI
    bail: process.env.CI ? 1 : 0,
  },
});
