import { test, expect, chromium, type Page } from '@playwright/test';
import { acceptCookieBanner, skipIfDemoMode, sql, BASE } from './qa-city-helpers';

// Audit G-10, in a real room: Guess the Number (1) did not start by itself, so every guess
// failed ("No secret number has been set for this room yet") until the host found "Reset
// Number", and (2) never ended: after one player found the number everyone else could "win"
// too, because the server keeps answering "correct" for the same secret. Now the host's
// client starts the first round, and the first correct guess ends the round for everyone
// until the host starts the next one. The two rules themselves are in guess-number-round.spec.

async function guest(browser: Awaited<ReturnType<typeof chromium.launch>>, code: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${BASE}/room/${code}`);
  await acceptCookieBanner(page);
  await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 30000 });
  return page;
}

// The secret the server holds for the room, read from Postgres: the one authoritative sign that a
// round has started. The host's own screen is not: it shows its number before the server has
// saved it, so a guess made the moment the number appears can be refused ("No secret number has
// been set"). A first version of this test waited on the screen and failed once in a full-suite
// run on a loaded machine (the host never saw the guess); the cause was not reproduced in 28
// repeats, and this version no longer depends on the screen being ahead of the server.
async function startedSecret(host: Page, code: string): Promise<number> {
  const read = () => sql(`select secret from guess_number_secrets where room_code='${code}'`);
  await expect.poll(read, { timeout: 30000 }).toMatch(/^\d{1,3}$/);
  // The host announces the new round right after saving it. Let that reach every client before
  // the first guess, or the announcement would clear a guess made in the same instant.
  await host.waitForTimeout(1500);
  const n = Number(read());
  await expect(host.getByTestId('guess-secret')).toHaveText(String(n), { timeout: 30000 });
  return n;
}

async function guess(page: Page, n: number) {
  const input = page.locator('#guess-input');
  await input.fill(String(n));
  await input.press('Enter');
}

test('the first round starts by itself, and the first correct guess ends it for everyone', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE}/create?type=party`);
  await acceptCookieBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  await skipIfDemoMode(page);
  const code = page.url().split('/room/')[1].split(/[?#]/)[0];

  const browser = await chromium.launch();
  try {
    const ann = await guest(browser, code);
    const bo = await guest(browser, code);
    await expect(page.getByText(/People \(3\)/)).toBeVisible({ timeout: 30000 });

    // The host opens Guess Number and does NOT touch "Reset Number": a secret is there anyway.
    await page.getByRole('button', { name: /switch game activity/i }).click({ timeout: 30000 });
    await page.getByRole('button', { name: /^select guess number$/i }).click();
    const n = await startedSecret(page, code);
    const wrong = n === 50 ? 51 : 50;

    // A wrong guess is checked against it (this is the call that used to be refused).
    await expect(ann.locator('#guess-input')).toBeVisible({ timeout: 30000 });
    await guess(ann, wrong);
    for (const p of [page, ann, bo]) {
      await expect(p.getByText(wrong > n ? 'Too High' : 'Too Low')).toHaveCount(1, { timeout: 15000 });
    }
    await expect(bo.locator('#guess-input')).toBeEnabled();

    // Ann finds it: the round is over for everyone, and Bo can no longer guess.
    await guess(ann, n);
    for (const p of [page, ann, bo]) {
      await expect(p.getByRole('status').filter({ hasText: `guessed it: ${n}!` })).toBeVisible({ timeout: 15000 });
    }
    await expect(ann.locator('#guess-input')).toBeDisabled();
    await expect(bo.locator('#guess-input')).toBeDisabled();
    await expect(bo.getByRole('button', { name: /^guess$/i })).toBeDisabled();
    await expect(page.getByText('Correct!')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /start next round/i })).toBeVisible();

    // The result survives a refresh: the round is replayed from the shared log, still over.
    await bo.reload();
    await expect(bo.getByRole('status').filter({ hasText: `guessed it: ${n}!` })).toBeVisible({ timeout: 30000 });
    await expect(bo.locator('#guess-input')).toBeDisabled();

    // The host starts the next round: the result is gone and guessing is open again.
    await page.getByRole('button', { name: /start next round/i }).click();
    for (const p of [page, ann, bo]) {
      await expect(p.getByRole('status').filter({ hasText: 'guessed it' })).toHaveCount(0, { timeout: 15000 });
    }
    await expect(bo.locator('#guess-input')).toBeEnabled({ timeout: 15000 });
    await expect(page.getByText('No guesses yet. Take a shot!')).toBeVisible();
    await expect(page.getByTestId('guess-secret')).toHaveText(/^\d{1,3}$/, { timeout: 15000 });
  } finally {
    await browser.close();
  }
});

test('a host who refreshes keeps the round they were in instead of starting a new one', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${BASE}/create?type=party`);
  await acceptCookieBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  await skipIfDemoMode(page);
  const code = page.url().split('/room/')[1].split(/[?#]/)[0];

  const browser = await chromium.launch();
  try {
    const ann = await guest(browser, code);
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: /switch game activity/i }).click({ timeout: 30000 });
    await page.getByRole('button', { name: /^select guess number$/i }).click();
    const n = await startedSecret(page, code);
    const wrong = n === 50 ? 51 : 50;

    await guess(ann, wrong);
    await expect(page.getByText(wrong > n ? 'Too High' : 'Too Low')).toHaveCount(1, { timeout: 15000 });

    // The host reloads: the same secret comes back from the server and the guess is still listed
    // (a new round would have cleared it).
    await page.reload();
    await expect(page.getByTestId('guess-secret')).toHaveText(String(n), { timeout: 30000 });
    await expect(page.getByText(wrong > n ? 'Too High' : 'Too Low')).toHaveCount(1, { timeout: 15000 });

    // And the guest's next guess is still checked against that same number.
    await guess(ann, n);
    await expect(page.getByRole('status').filter({ hasText: `guessed it: ${n}!` })).toBeVisible({ timeout: 15000 });
  } finally {
    await browser.close();
  }
});
