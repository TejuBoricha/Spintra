import { test, expect } from '@playwright/test';
import { BYE_PLAYER, isByePlayer, playerLabel } from '../src/lib/tournament-engine';

// Audit T-14 and T-13 on the standalone tournament page.
// T-14: a player with a bye is paired with the placeholder "__BYE__". The page showed that
//       placeholder as text, and (it compared against "BYE", not "__BYE__") treated the bye
//       match as a playable one that could be clicked and re-scored.
// T-13: match cards were plain divs with a click handler, so a keyboard user could never
//       reach or score a match. They are real buttons now (disabled for a bye), as in the
//       in-room Tournament.

test('the bye placeholder is labelled, not shown raw', () => {
  expect(isByePlayer(BYE_PLAYER)).toBe(true);
  expect(isByePlayer('Alice')).toBe(false);
  expect(isByePlayer(null)).toBe(false);
  expect(playerLabel(BYE_PLAYER)).toBe('BYE');
  expect(playerLabel('Alice')).toBe('Alice');
  expect(playerLabel(null)).toBeNull();
});

test('a bye match says BYE, cannot be scored, and the real match can be scored from the keyboard', async ({ page }) => {
  await page.goto('/tools/tournament', { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nBravo\nCharlie');
  await page.getByRole('radio', { name: 'Single Elim' }).click();
  await page.getByRole('button', { name: 'Generate Bracket' }).click();

  const byeMatch = page.locator('[data-testid="tournament-match"][data-match-bye="true"]');
  await expect(byeMatch).toHaveCount(1);
  // The raw placeholder is nowhere on the page; the match says BYE.
  await expect(page.getByText('__BYE__')).toHaveCount(0);
  await expect(byeMatch).toContainText('BYE');
  // It cannot be scored: it is a disabled button, so neither a click nor the keyboard opens an editor.
  await expect(byeMatch).toBeDisabled();
  await byeMatch.click({ force: true });
  await expect(page.locator('input[type="number"]')).toHaveCount(0);

  // The match between two real players is a button with a name, reached and operated by keyboard.
  const real = page.locator('[data-testid="tournament-match"][data-match-ready="true"]:not([data-match-status="completed"])');
  await expect(real).toHaveCount(1);
  await expect(real).toBeEnabled();
  await expect(real).toHaveAttribute('aria-label', /^Record score: .+ vs .+$/);
  await real.focus();
  await expect(real).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('input[type="number"]').first()).toBeVisible({ timeout: 5000 });
});

// Code review of PR #68: the Swiss view still blocked scoring with a substring test
// ("BYE"), so a player named BYE (or any name with those capitals) had a match card
// that was an enabled button doing nothing, and the Swiss event could never finish.
test('a player named BYE plays a Swiss match like anyone else', async ({ page }) => {
  await page.goto('/tools/tournament', { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/Enter participant names/).fill('BYE\nAlpha\nBravo\nCharlie');
  await page.getByRole('radio', { name: 'Swiss' }).click();
  await page.getByRole('button', { name: 'Generate Bracket' }).click();

  const theirs = page.getByRole('button', { name: /^Record score: (BYE vs .+|.+ vs BYE)$/ });
  await expect(theirs).toHaveCount(1);
  await expect(theirs).toBeEnabled();
  await theirs.click();
  await expect(page.locator('input[type="number"]').first()).toBeVisible({ timeout: 5000 });
});

// A later-round match still waiting for a player ("Alpha vs TBD") was an enabled
// button that opened the score editor, and saving it failed with "scores can't be
// tied". (A round with nobody in it yet is not drawn at all.)
test('a match still waiting for a player cannot be opened', async ({ page }) => {
  await page.goto('/tools/tournament', { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/Enter participant names/).fill('Alpha\nBravo\nCharlie\nDelta');
  await page.getByRole('radio', { name: 'Single Elim' }).click();
  await page.getByRole('button', { name: 'Generate Bracket' }).click();

  // Score one semi-final: its winner goes into the final, which still waits for the other.
  await page.locator('[data-testid="tournament-match"][data-match-ready="true"]').first().click();
  const scores = page.locator('input[type="number"]');
  await scores.nth(0).fill('3');
  await scores.nth(1).fill('1');
  await page.getByRole('button', { name: 'Save' }).click();

  const waiting = page.locator('[data-testid="tournament-match"][data-match-ready="false"]');
  await expect(waiting).toHaveCount(1, { timeout: 5000 }); // the final
  await expect(waiting).toContainText('TBD');
  await expect(waiting).toBeDisabled();
  await expect(waiting).not.toHaveAttribute('aria-label', /Record score/);
  await waiting.click({ force: true });
  await expect(page.locator('input[type="number"]')).toHaveCount(0);
});
