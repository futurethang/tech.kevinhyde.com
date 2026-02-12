import { test, expect, type Page } from '@playwright/test';

const TURN_LIMIT = Number(process.env.E2E_MAX_TURNS ?? 60);
const STEP_DELAY_MS = Number(process.env.E2E_STEP_DELAY_MS ?? 700);
const IDLE_LIMIT = Number(process.env.E2E_IDLE_LIMIT ?? 25);

async function quickDevLogin(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/apps\/dice-baseball\/auth$/);
  await page.getByRole('button', { name: /Quick Dev Login/i }).click();
  await expect(page).toHaveURL(/\/apps\/dice-baseball\/?$/);
}

async function openPlayPage(page: Page): Promise<void> {
  await page.locator('a[href$="/play"]').first().click();
  await expect(page).toHaveURL(/\/apps\/dice-baseball\/play\/?$/);
}

async function createGameAndGetJoinCode(hostPage: Page): Promise<string> {
  await hostPage.getByRole('button', { name: /^Create Game$/ }).click();
  await expect(hostPage.getByText(/Share this code/i)).toBeVisible();

  const joinCode = (await hostPage.locator('span.text-3xl.font-mono.font-bold').first().innerText()).trim();
  expect(joinCode).toMatch(/^[A-Z0-9]{6}$/);
  return joinCode;
}

async function joinGame(visitorPage: Page, joinCode: string): Promise<void> {
  await visitorPage.getByPlaceholder(/Enter 6-character code/i).fill(joinCode);
  await visitorPage.getByRole('button', { name: /^Join Game$/ }).click();
  await expect(visitorPage).toHaveURL(/\/apps\/dice-baseball\/game\//);
}

async function tryRoll(page: Page): Promise<boolean> {
  if (!/\/apps\/dice-baseball\/game\//.test(page.url())) {
    return false;
  }

  const buttons = page.locator('button:has-text("ROLL DICE"), button:has-text(" = ")');
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    if ((await button.isVisible()) && (await button.isEnabled())) {
      await button.click();
      return true;
    }
  }

  return false;
}

test('autoplay two-player game in visible browser', async ({ browser }) => {
  test.setTimeout(5 * 60 * 1000);

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await Promise.all([quickDevLogin(pageA), quickDevLogin(pageB)]);
  await Promise.all([openPlayPage(pageA), openPlayPage(pageB)]);

  const joinCode = await createGameAndGetJoinCode(pageA);
  await joinGame(pageB, joinCode);
  await expect(pageA).toHaveURL(/\/apps\/dice-baseball\/game\//);

  let turnsTaken = 0;
  let idleCycles = 0;

  while (turnsTaken < TURN_LIMIT && idleCycles < IDLE_LIMIT) {
    const rolledA = await tryRoll(pageA);
    const rolledB = rolledA ? false : await tryRoll(pageB);

    if (rolledA || rolledB) {
      turnsTaken++;
      idleCycles = 0;
      await pageA.waitForTimeout(STEP_DELAY_MS);

      const gameOverA = await pageA.getByText(/GAME OVER/i).count();
      const gameOverB = await pageB.getByText(/GAME OVER/i).count();
      if (gameOverA > 0 || gameOverB > 0) {
        break;
      }
      continue;
    }

    idleCycles++;
    await pageA.waitForTimeout(300);
  }

  expect(turnsTaken).toBeGreaterThan(0);

  await Promise.all([contextA.close(), contextB.close()]);
});
