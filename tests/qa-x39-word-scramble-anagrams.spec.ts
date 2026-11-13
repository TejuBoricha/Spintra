import { test, expect, chromium, type Page } from '@playwright/test';
import { acceptCookieBanner, skipIfDemoMode, BASE } from './qa-city-helpers';
import { WORD_SCRAMBLE_ALTERNATES, lettersKey } from '../src/lib/word-scramble-anagrams';

// Audit G-11 in a real room: the host draws a word and every player's client compared a
// guess with that one word (a hash), so a player who unscrambled FOREST as SOFTER was told
// "Not quite" and could not win. The host draws at random, so this presses "New Word" until
// the guest's screen shows a word that has other real spellings. The rule itself is in
// word-scramble-anagrams.spec; the standalone page is in word-scramble-tool-anagrams.spec.

async function lettersOf(p: Page): Promise<string> {
  const tiles = p.getByTestId('scramble-letters');
  return (await tiles.count()) ? (await tiles.innerText()).replace(/\s+/g, '') : '';
}

test('in a room, another real word made from the same letters wins the round', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`${BASE}/create?type=party`);
  await acceptCookieBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 60000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 60000 });
  await skipIfDemoMode(page);
  const code = page.url().split('/room/')[1].split(/[?#]/)[0];

  const browser = await chromium.launch();
  const guest = await (await browser.newContext()).newPage();
  try {
    await guest.goto(`${BASE}/room/${code}`);
    await acceptCookieBanner(guest);
    await expect(guest.getByText('Live', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/People \(2\)/)).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: /switch game activity/i }).click({ timeout: 30000 });
    await page.getByRole('button', { name: /^select word scramble$/i }).click();

    // Draw words until the guest is looking at one with other real spellings.
    let letters = '';
    let target: string | undefined;
    for (let i = 0; i < 40 && !target; i++) {
      const before = letters;
      await page.getByRole('button', { name: /^(start|new word)$/i }).click({ timeout: 15000 });
      // A redraw of the same word can happen to jumble the same way; then the screen is unchanged.
      await expect.poll(() => lettersOf(guest), { timeout: 10000 }).not.toBe(before).catch(() => {});
      letters = await lettersOf(guest);
      target = Object.keys(WORD_SCRAMBLE_ALTERNATES).find((w) => lettersKey(w) === lettersKey(letters));
    }
    expect(target, 'no word with other spellings was drawn in 40 tries').toBeTruthy();
    const other = WORD_SCRAMBLE_ALTERNATES[target!][0];

    // Letters that are not a word are still refused, and nobody has won.
    const input = guest.getByLabel('Guess the word');
    await input.fill(lettersKey(target!).split('').reverse().join(''));
    await input.press('Enter');
    await expect(guest.getByText('Not quite. Try again.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('status').filter({ hasText: 'got it' })).toHaveCount(0);

    // The other real word wins, and everyone is told what was typed.
    await input.fill(other.toLowerCase());
    await input.press('Enter');
    for (const p of [page, guest]) {
      await expect(p.getByRole('status').filter({ hasText: `got it: ${other}` })).toBeVisible({ timeout: 15000 });
    }
  } finally {
    await browser.close();
  }
});
