import { defineConfig, devices } from '@playwright/test';

const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 5173);
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 3001);
const baseURL =
  process.env.E2E_BASE_URL ?? `http://127.0.0.1:${FRONTEND_PORT}/apps/dice-baseball`;

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'iphone12',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'pixel5',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: [
    {
      command: `CORS_ORIGIN=http://127.0.0.1:${FRONTEND_PORT} PORT=${BACKEND_PORT} GAME_SIM_MODE=${process.env.E2E_GAME_SIM_MODE ?? 'deterministic'} GAME_SIM_SEED=${process.env.E2E_GAME_SIM_SEED ?? 'playwright-seed'} npm run dev`,
      cwd: '../backend',
      port: BACKEND_PORT,
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
    {
      command: `VITE_API_URL=http://127.0.0.1:${BACKEND_PORT}/api VITE_WS_URL=http://127.0.0.1:${BACKEND_PORT} npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT}`,
      cwd: '.',
      port: FRONTEND_PORT,
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    },
  ],
});
