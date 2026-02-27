import { test, expect } from '@playwright/test';
import { autoplayTurns, startTwoPlayerGame } from '../helpers/game-lab';

test('screenshots: capture game-over screen for both players', async ({ browser }) => {
  test.setTimeout(10 * 60 * 1000);

  const session = await startTwoPlayerGame(browser);
  const result = await autoplayTurns(session.pageA, session.pageB, {
    turnLimit: Number(process.env.E2E_FULLGAME_TURNS ?? 280),
    stepDelayMs: Number(process.env.E2E_STEP_DELAY_MS ?? 120),
    idleLimit: Number(process.env.E2E_IDLE_LIMIT ?? 40),
    stopOnGameOver: true,
  });

  expect(result.gameOver).toBe(true);

  // Wait for game-over screen to render
  const pageAGameOver = session.pageA.getByTestId('game-over-screen');
  const pageBGameOver = session.pageB.getByTestId('game-over-screen');

  await Promise.race([
    pageAGameOver.waitFor({ timeout: 10_000 }).catch(() => {}),
    pageBGameOver.waitFor({ timeout: 10_000 }).catch(() => {}),
  ]);

  // Capture screenshots of final state for both players
  await session.pageA.screenshot({ path: `e2e/screenshots/gameover-playerA.png` });
  await session.pageB.screenshot({ path: `e2e/screenshots/gameover-playerB.png` });

  await Promise.all([session.contextA.close(), session.contextB.close()]);
});
