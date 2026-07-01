import { test, expect } from '@playwright/test';

// Regression test for the audited bug: double-elimination losers were never
// fed into the losers bracket, so the bracket dead-ended and no tournament
// winner could ever be declared. This plays a full 4-player double-elim
// bracket through to completion (winners bracket -> losers bracket -> grand
// final) and asserts a champion is eventually crowned.
test('double-elimination bracket feeds losers through and crowns a champion', async ({ page }) => {
  await page.goto('/tools/tournament', { waitUntil: 'networkidle' });

  await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nBravo\nCharlie\nDelta');
  await page.getByRole('tab', { name: 'Double Elim' }).click();
  await page.getByRole('button', { name: 'Generate Bracket' }).click();

  const readyUnplayedMatch = page
    .locator('[data-testid="tournament-match"][data-match-ready="true"]:not([data-match-status="completed"])')
    .first();

  // 4-player double elim needs exactly 6 decisive matches to finish:
  // 2 winners-R1 + 1 winners-final + 1 losers-R1 + 1 losers-final + 1 grand final.
  for (let i = 0; i < 6; i++) {
    if (await page.getByText('Tournament Champion').isVisible().catch(() => false)) break;

    await expect(readyUnplayedMatch).toBeVisible({ timeout: 10_000 });
    await readyUnplayedMatch.click();

    const scoreInputs = page.locator('input[type="number"]');
    await scoreInputs.nth(0).fill('1');
    await scoreInputs.nth(1).fill('0');
    await page.getByRole('button', { name: 'Save' }).click();
  }

  await expect(page.getByText('Tournament Champion')).toBeVisible();
});
