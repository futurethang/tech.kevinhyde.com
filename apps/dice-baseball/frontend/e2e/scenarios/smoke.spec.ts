import { test, expect } from '@playwright/test';
import { autoplayTurns, startTwoPlayerGame } from '../helpers/game-lab';

test('smoke autoplay: two players can complete initial turn sequence', async ({ browser }) => {
  test.setTimeout(3 * 60 * 1000);

  const session = await startTwoPlayerGame(browser);

  // Screenshot: both players see game screen after setup
  await expect(session.pageA.getByTestId('game-screen')).toBeVisible();
  await expect(session.pageB.getByTestId('game-screen')).toBeVisible();
  await session.pageA.screenshot({ path: `e2e/screenshots/smoke-setup-playerA.png` });
  await session.pageB.screenshot({ path: `e2e/screenshots/smoke-setup-playerB.png` });

  const result = await autoplayTurns(session.pageA, session.pageB, {
    turnLimit: Number(process.env.E2E_SMOKE_TURNS ?? 10),
    stepDelayMs: Number(process.env.E2E_STEP_DELAY_MS ?? 500),
    idleLimit: Number(process.env.E2E_IDLE_LIMIT ?? 20),
  });

  expect(result.turnsTaken).toBeGreaterThan(0);

  // Screenshot: after turns with play log populated
  await session.pageA.screenshot({ path: `e2e/screenshots/smoke-after-turns-playerA.png` });
  await session.pageB.screenshot({ path: `e2e/screenshots/smoke-after-turns-playerB.png` });

  await Promise.all([session.contextA.close(), session.contextB.close()]);
});
