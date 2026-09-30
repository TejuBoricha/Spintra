import { test, expect } from '@playwright/test';

// Audit T-3, the parts left after the placement fix: the seeds box was a
// single-line input labelled "one per line", so only one seed could be typed, and
// the how-to said "The bracket is seeded for you" although it only follows what
// the organiser enters. The box is now multi-line and the copy says what it does.

const PLAYERS = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];

test('several seeds can be entered, one per line, and they land in standard bracket order', async ({ page }) => {
  await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

  await page.getByPlaceholder(/Enter participant names/).fill(PLAYERS.join('\n'));
  const seeds = page.getByLabel(/seeds, one per line/i);
  await seeds.fill('Hotel\nGolf');
  // A single-line input would have flattened the line break; a textarea keeps it.
  await expect(seeds).toHaveValue('Hotel\nGolf');

  await page.getByRole('radio', { name: 'Single Elim' }).click();
  await page.getByRole('button', { name: 'Generate Bracket' }).click();

  // Seeds 1 and 2 are Hotel and Golf; everyone else is drawn at random, so only
  // the seeded slots are fixed. Standard 8-bracket order is 1v8, 4v5, 2v7, 3v6:
  // Hotel opens the first match (top half) and Golf the third (bottom half), so
  // they cannot meet before the final.
  const matches = page.locator('[data-testid="tournament-match"]');
  await expect(matches.nth(3)).toBeVisible();
  const text = async (i: number) => (await matches.nth(i).innerText());
  const [m0, m1, m2, m3] = [await text(0), await text(1), await text(2), await text(3)];
  expect(m0).toContain('Hotel');
  expect(m2).toContain('Golf');
  for (const m of [m0, m1, m2, m3]) {
    expect(PLAYERS.filter((name) => m.includes(name))).toHaveLength(2);
  }
  expect(m0).not.toContain('Golf');
  expect(m1 + m3).not.toMatch(/Hotel|Golf/);
});

test('the how-to no longer claims the bracket is seeded automatically', async ({ page }) => {
  await page.goto('/tools/tournament', { waitUntil: 'domcontentloaded' });
  const body = await page.content();
  // Booleans, so a failure prints one line instead of the whole page.
  expect(/seeded for you/i.test(body)).toBe(false);
  expect(/list your top seeds first/i.test(body)).toBe(true);
  expect(/everyone else is drawn at random/i.test(body)).toBe(true);
});
