import { test, expect, type Page } from '@playwright/test';
import { WORD_SCRAMBLE_WORDS } from '../src/lib/utils';
import { WORD_SCRAMBLE_ALTERNATES, lettersKey } from '../src/lib/word-scramble-anagrams';
import { skipInDbIntegration } from './helpers/ci-skip';

skipInDbIntegration();

// Audit G-11 on /tools/word-scramble: unscrambling FOREST as SOFTER (or MARBLE as RAMBLE,
// CANDLE as LANCED ...) was answered "Not quite". The page draws a random word, so the test
// reads the jumbled letters, and skips until it shows a word that has other real spellings.

const lettersOnScreen = async (page: Page) =>
  (await page.getByTestId('scramble-letters').innerText()).replace(/\s+/g, '');

async function skipUntil(page: Page, wanted: (letters: string) => boolean): Promise<string> {
  for (let i = 0; i < 40; i++) {
    await expect.poll(() => lettersOnScreen(page), { timeout: 15000 }).toMatch(/^[A-Z]{5,}$/);
    const letters = await lettersOnScreen(page);
    if (wanted(letters)) return letters;
    await page.getByRole('button', { name: /^skip$/i }).click();
    // The card slides out before the next word's card comes in (AnimatePresence "wait"), so
    // until the letters change the screen still shows the word that was skipped.
    await expect.poll(() => lettersOnScreen(page), { timeout: 15000 }).not.toBe(letters);
  }
  throw new Error('the page never showed a word of the kind this test needs');
}

const hasAlternates = (letters: string) =>
  Object.keys(WORD_SCRAMBLE_ALTERNATES).some((w) => lettersKey(w) === lettersKey(letters));

test('another real word made from the same letters solves it, and is what the page shows', async ({ page }) => {
  await page.goto('/tools/word-scramble');
  const letters = await skipUntil(page, hasAlternates);
  const word = (WORD_SCRAMBLE_WORDS as readonly string[]).find((w) => lettersKey(w) === lettersKey(letters))!;
  const other = WORD_SCRAMBLE_ALTERNATES[word][0];

  // Letters that are not a word are still refused.
  const input = page.getByPlaceholder('Your guess...');
  await input.fill(lettersKey(word).split('').reverse().join(''));
  await input.press('Enter');
  await expect(page.getByText('Not quite. Try again.')).toBeVisible();

  await input.fill(other.toLowerCase());
  await input.press('Enter');
  await expect(page.getByText(`${other}!`, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /next word/i })).toBeVisible();
});

test('the drawn word itself still solves it', async ({ page }) => {
  await page.goto('/tools/word-scramble');
  const letters = await skipUntil(page, () => true);
  const word = (WORD_SCRAMBLE_WORDS as readonly string[]).find((w) => lettersKey(w) === lettersKey(letters))!;
  const input = page.getByPlaceholder('Your guess...');
  await input.fill(word);
  await input.press('Enter');
  await expect(page.getByText(`${word}!`, { exact: true })).toBeVisible();
});
