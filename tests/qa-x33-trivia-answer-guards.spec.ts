import { test, expect, chromium, type Page, type Route } from '@playwright/test';
import { acceptCookieBanner, skipIfDemoMode, BASE } from './qa-city-helpers';

// Audit G-3 and G-4 (client half).
// G-3: the answer buttons only locked once the server had echoed the answer back, so
//      clicking several options quickly sent several answers; a wrong one and the right
//      one both scored ("participation" and "win" are different awards).
// G-4: an answer that reached the room after the next question had started was counted
//      as an answer to the NEW question, locking the player out of it. Answers now carry
//      their question number and receivers ignore one for a different question.

async function hostStartsTrivia(page: Page) {
  await page.goto(`${BASE}/create?type=trivia`);
  await acceptCookieBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  await skipIfDemoMode(page);
  return page.url().split('/room/')[1].split(/[?#]/)[0];
}

const isAnswerSend = (url: string, body: string | null) => url.includes('send_room_event') && (body ?? '').includes('trivia_answer');

test('clicking every answer at once sends one answer', async ({ page }) => {
  test.setTimeout(90_000);
  await hostStartsTrivia(page);
  await page.getByRole('button', { name: /start trivia/i }).click({ timeout: 30000 });
  await expect(page.getByText(/^Question 1$/)).toBeVisible({ timeout: 15000 });

  const sent: string[] = [];
  page.on('request', (req) => {
    if (req.method() === 'POST' && isAnswerSend(req.url(), req.postData())) sent.push(req.postData() ?? '');
  });

  // All four buttons in one JavaScript task, before the server can echo the first answer back.
  await page.evaluate(() => document.querySelectorAll<HTMLElement>('[data-testid="trivia-option"]').forEach((b) => b.click()));
  await page.waitForTimeout(3000);

  expect(sent.length, `answers sent: ${sent.length}`).toBe(1);
  expect(sent[0]).toContain('"questionNum":1');
});

test('an answer that arrives after the next question has started does not lock the player out of it', async ({ page }) => {
  test.setTimeout(120_000);
  await hostStartsTrivia(page);
  const code = page.url().split('/room/')[1].split(/[?#]/)[0];

  const browser = await chromium.launch();
  const guest = await (await browser.newContext()).newPage();
  const held: Route[] = [];
  try {
    // The guest's answer is held on its way to the server, like a slow connection.
    await guest.route('**/rpc/send_room_event*', async (route) => {
      if (isAnswerSend(route.request().url(), route.request().postData())) held.push(route);
      else await route.continue();
    });
    await guest.goto(`${BASE}/room/${code}`);
    await acceptCookieBanner(guest);
    await expect(guest.getByText('Live', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: /start trivia/i }).click();
    await expect(guest.getByText(/^Question 1$/)).toBeVisible({ timeout: 15000 });

    await guest.locator('[data-testid="trivia-option"]').first().click();
    await expect.poll(() => held.length, { timeout: 10000 }).toBe(1);

    // The host moves on while the guest's answer is still on the way.
    await page.getByRole('button', { name: /next question/i }).click();
    await expect(guest.getByText(/^Question 2$/)).toBeVisible({ timeout: 15000 });

    // Now the late answer (for question 1) gets through.
    await held[0].continue();
    await guest.waitForTimeout(4000);

    // The guest can still answer question 2, and nobody has an answer counted for it.
    const options = guest.locator('[data-testid="trivia-option"]');
    for (let i = 0; i < 4; i++) await expect(options.nth(i)).toBeEnabled();
    // The host's tally for question 2 has no answer in it (it would read "0 / 1 answered correctly").
    await expect(page.getByText(/\/ 1 answered correctly/)).toHaveCount(0);
  } finally {
    await browser.close();
  }
});
