import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

export interface GameLabSession {
  contextA: BrowserContext;
  contextB: BrowserContext;
  pageA: Page;
  pageB: Page;
  gameUrl: string;
}

export interface AutoplayOptions {
  turnLimit: number;
  stepDelayMs: number;
  idleLimit: number;
  stopOnGameOver?: boolean;
}

export interface AutoplayResult {
  turnsTaken: number;
  idleCycles: number;
  gameOver: boolean;
}

export async function quickDevLogin(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/apps\/dice-baseball\/auth$/);
  await page.getByTestId('auth-quick-login').click();
  await expect(page).toHaveURL(/\/apps\/dice-baseball\/?$/);
}

export async function openPlayPage(page: Page): Promise<void> {
  await page.getByTestId('nav-play-link').click();
  await expect(page).toHaveURL(/\/apps\/dice-baseball\/play\/?$/);
}

export async function createGameAndGetJoinCode(hostPage: Page): Promise<string> {
  await hostPage.getByTestId('play-create-game').click();
  const codeLocator = hostPage.getByTestId('play-created-join-code');
  await expect(codeLocator).toBeVisible();
  const joinCode = (await codeLocator.innerText()).trim();
  expect(joinCode).toMatch(/^[A-Z0-9]{6}$/);
  return joinCode;
}

export async function joinGame(visitorPage: Page, joinCode: string): Promise<void> {
  await visitorPage.getByTestId('play-join-code-input').fill(joinCode);
  await visitorPage.getByTestId('play-join-game').click();
  await expect(visitorPage).toHaveURL(/\/apps\/dice-baseball\/game\//);
}

export async function startTwoPlayerGame(browser: Browser): Promise<GameLabSession> {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await Promise.all([quickDevLogin(pageA), quickDevLogin(pageB)]);
  await Promise.all([openPlayPage(pageA), openPlayPage(pageB)]);

  const joinCode = await createGameAndGetJoinCode(pageA);
  await joinGame(pageB, joinCode);
  await expect(pageA).toHaveURL(/\/apps\/dice-baseball\/game\//);
  const gameUrl = pageA.url();

  return { contextA, contextB, pageA, pageB, gameUrl };
}

export async function tryRoll(page: Page): Promise<boolean> {
  if (!/\/apps\/dice-baseball\/game\//.test(page.url())) {
    return false;
  }

  const rollButton = page.getByTestId('game-roll-button');
  if ((await rollButton.count()) === 0) {
    return false;
  }

  if ((await rollButton.isVisible()) && (await rollButton.isEnabled())) {
    await rollButton.click();
    return true;
  }

  return false;
}

export async function isGameOver(page: Page): Promise<boolean> {
  return (await page.getByTestId('game-over-screen').count()) > 0;
}

export async function autoplayTurns(
  pageA: Page,
  pageB: Page,
  options: AutoplayOptions
): Promise<AutoplayResult> {
  let turnsTaken = 0;
  let idleCycles = 0;
  let gameOver = false;

  while (turnsTaken < options.turnLimit && idleCycles < options.idleLimit) {
    const rolledA = await tryRoll(pageA);
    const rolledB = rolledA ? false : await tryRoll(pageB);

    if (rolledA || rolledB) {
      turnsTaken++;
      idleCycles = 0;
      await pageA.waitForTimeout(options.stepDelayMs);

      if (options.stopOnGameOver !== false) {
        const gameOverA = await isGameOver(pageA);
        const gameOverB = await isGameOver(pageB);
        if (gameOverA || gameOverB) {
          gameOver = true;
          break;
        }
      }
      continue;
    }

    idleCycles++;
    await pageA.waitForTimeout(250);
  }

  if (!gameOver) {
    const gameOverA = await isGameOver(pageA);
    const gameOverB = await isGameOver(pageB);
    gameOver = gameOverA || gameOverB;
  }

  return { turnsTaken, idleCycles, gameOver };
}
