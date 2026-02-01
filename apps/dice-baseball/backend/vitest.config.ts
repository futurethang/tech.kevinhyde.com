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
        'src/scripts/**', // Standalone scripts for manual testing
        'src/services/team-service.ts', // Mocked in tests, placeholder for Supabase
        'src/services/game-service.ts', // Mocked in tests, in-memory for MVP
      ],
      thresholds: {
        // Phase 6 thresholds - services are mocked placeholders awaiting Supabase
        // Core game engine and routes are well tested
        // Will increase when real database integration is added
        statements: 75,
        branches: 70,
        functions: 50,
        lines: 75,
      },
    },
    // Fail fast in CI
    bail: process.env.CI ? 1 : 0,
  },
});
