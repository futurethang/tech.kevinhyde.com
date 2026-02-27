import { test, expect } from '@playwright/test';
import { autoplayTurns, startTwoPlayerGame } from '../helpers/game-lab';

test('disconnect-reconnect: opponent disconnect notice appears and clears on reconnect', async ({
  browser,
}) => {
  test.setTimeout(5 * 60 * 1000);

  const session = await startTwoPlayerGame(browser);

  await autoplayTurns(session.pageA, session.pageB, {
    turnLimit: 6,
    stepDelayMs: 250,
    idleLimit: 15,
    stopOnGameOver: false,
  });

  await session.pageA.close();
  await expect(session.pageB.getByTestId('game-opponent-disconnected')).toBeVisible({
    timeout: 10_000,
  });

  const reconnectedPageA = await session.contextA.newPage();
  await reconnectedPageA.goto(session.gameUrl, { waitUntil: 'domcontentloaded' });
  await expect(reconnectedPageA.getByTestId('game-screen')).toBeVisible({ timeout: 15_000 });

  await expect(session.pageB.getByTestId('game-opponent-disconnected')).toBeHidden({
    timeout: 10_000,
  });

  await Promise.all([reconnectedPageA.close(), session.contextA.close(), session.contextB.close()]);
});
