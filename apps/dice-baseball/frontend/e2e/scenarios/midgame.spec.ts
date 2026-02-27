import { test, expect } from '@playwright/test';
import { autoplayTurns, startTwoPlayerGame } from '../helpers/game-lab';

test('midgame autoplay: sustained turn loop remains stable', async ({ browser }) => {
  test.setTimeout(5 * 60 * 1000);

  const session = await startTwoPlayerGame(browser);
  const result = await autoplayTurns(session.pageA, session.pageB, {
    turnLimit: Number(process.env.E2E_MIDGAME_TURNS ?? 60),
    stepDelayMs: Number(process.env.E2E_STEP_DELAY_MS ?? 350),
    idleLimit: Number(process.env.E2E_IDLE_LIMIT ?? 30),
  });

  expect(result.turnsTaken).toBeGreaterThan(20);

  await Promise.all([session.contextA.close(), session.contextB.close()]);
});
