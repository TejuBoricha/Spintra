import { test, expect, type Page, type Locator } from '@playwright/test';

// Enter confirms a composition in an input method (Japanese, Chinese, Korean), so that press belongs to the input method:
// a handler that reads `key === "Enter"` and acts on it sends, adds or saves a half-typed word (the review of wave 1a found
// 15 such fields; `isImeKey` in src/lib/keyboard.ts is the guard, and the Lucky Wheel rename field had it first).
//
// The composition is real: Chromium is told through the DevTools protocol that an input method has a word in flight, and
// then reports the next key press the way it does for a person typing (the keydown arrives with isComposing true, which
// every case checks first, so the cases cannot pass by accident if that ever changes). Each case then commits the word and
// presses Enter again: that one is the field's own and must still act. The first press is checked on its own, right after it
// (a buggy first Enter clears the field, so the end state alone would look the same as a correct run).

/** Starts a composition in the field, presses Enter, and says whether the page saw that Enter as part of the composition. */
async function enterWhileComposing(page: Page, field: Locator) {
  // The page's handlers are attached when React has hydrated the field: an Enter before that does nothing on any build, which
  // would let the guard-less code pass this case by accident.
  await expect.poll(() => field.evaluate((el) => Object.keys(el).some((key) => key.startsWith('__reactProps$')))).toBe(true);
  await page.evaluate(() => {
    (window as unknown as { __imeKeys: boolean[] }).__imeKeys = [];
    document.addEventListener('keydown', (e) => (window as unknown as { __imeKeys: boolean[] }).__imeKeys.push(e.isComposing), true);
  });
  await field.focus();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'に', selectionStart: 1, selectionEnd: 1 });
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => (window as unknown as { __imeKeys: boolean[] }).__imeKeys), 'the browser flagged that Enter as part of the composition').toEqual([true]);
  await page.waitForTimeout(500); // a handler that wrongly acted has rendered by now (a toast takes a moment to mount)
  return cdp;
}

/** Commits the word the way an input method does when the person confirms it. */
async function commit(cdp: Awaited<ReturnType<typeof enterWhileComposing>>) {
  await cdp.send('Input.insertText', { text: 'に' });
}

test.describe('Enter that confirms an input-method composition does not submit the field', () => {
  test('Lucky Wheel: adding an entry', async ({ page }) => {
    await page.goto('/tools/lucky-wheel');
    const entries = page.getByRole('heading', { name: /Entries \(\d+\)/ });
    await expect(entries).toContainText('(5)');
    const cdp = await enterWhileComposing(page, page.getByPlaceholder('New entry...'));
    await expect(entries, 'no entry added by the Enter that confirmed the composition').toContainText('(5)');
    await commit(cdp);
    await page.keyboard.press('Enter');
    await expect(entries, 'the next Enter is the field\'s own').toContainText('(6)');
  });

  test('Team Maker: adding a player to a team', async ({ page }) => {
    await page.goto('/tools/team-maker');
    await page.locator('textarea').first().fill('Alex\nJordan\nTaylor\nMorgan');
    await page.getByRole('button', { name: /Generate Teams/ }).evaluate((el) => (el as HTMLElement).click());
    const members = page.locator('li');
    await expect(members.first()).toBeVisible();
    const before = await members.count();
    const cdp = await enterWhileComposing(page, page.getByLabel('Add a player to Team 1').first());
    await expect(members, 'no player added by the Enter that confirmed the composition').toHaveCount(before);
    await commit(cdp);
    await page.keyboard.press('Enter');
    await expect(members, 'the next Enter is the field\'s own').toHaveCount(before + 1);
  });

  test('Word Scramble: submitting a guess', async ({ page }) => {
    await page.goto('/tools/word-scramble');
    const cdp = await enterWhileComposing(page, page.getByPlaceholder('Your guess...'));
    // One read, not a retrying assertion: a toast goes away by itself after a few seconds, which would turn this into a pass.
    expect(await page.getByText('Not quite. Try again.').count(), 'no guess judged for the Enter that confirmed the composition').toBe(0);
    await commit(cdp);
    await page.keyboard.press('Enter');
    await expect(page.getByText('Not quite. Try again.').first(), 'the next Enter is the field\'s own').toBeVisible();
  });

  test('Settings: saving the display name (Enter leaves the field)', async ({ page }) => {
    await page.goto('/settings');
    const name = page.locator('#settings-display-name');
    const cdp = await enterWhileComposing(page, name);
    await expect(name, 'still being typed in').toBeFocused();
    await commit(cdp);
    await page.keyboard.press('Enter');
    await expect(name, 'the second Enter leaves the field').not.toBeFocused();
  });
});
