import { test, expect } from '@playwright/test';
import { autoplayTurns, startTwoPlayerGame } from '../helpers/game-lab';

test('fullgame autoplay: reaches game-over state', async ({ browser }) => {
  test.setTimeout(10 * 60 * 1000);

  const session = await startTwoPlayerGame(browser);
  const result = await autoplayTurns(session.pageA, session.pageB, {
    turnLimit: Number(process.env.E2E_FULLGAME_TURNS ?? 280),
    stepDelayMs: Number(process.env.E2E_STEP_DELAY_MS ?? 120),
    idleLimit: Number(process.env.E2E_IDLE_LIMIT ?? 40),
    stopOnGameOver: true,
  });

  expect(result.gameOver).toBe(true);

  await Promise.all([session.contextA.close(), session.contextB.close()]);
});
