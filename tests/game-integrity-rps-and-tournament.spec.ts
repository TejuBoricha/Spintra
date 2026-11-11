import { test, expect, type Page } from '@playwright/test';
import { skipInDbIntegration } from './helpers/ci-skip';

skipInDbIntegration(test);

// Audit G-12: Tournament bracket reset confirmation guard.
// Resetting an active tournament wipes all bracket progress and match scores.
// If the bracket has recorded scores or winners, clicking "Start over" must prompt
// for confirmation with a Dialog so users don't accidentally lose progress.
// If no matches have been played yet, it resets immediately without prompt.

async function generateTournament(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.goto('/tools/tournament');
  await page.getByPlaceholder(/participant names/i).fill('Player 1\nPlayer 2\nPlayer 3\nPlayer 4');
  await page.getByRole('button', { name: /Generate Bracket/ }).click();
  await expect(page.locator('[data-match-ready="true"]').first()).toBeVisible();
}

test.describe('Tournament Reset Confirmation Guard (Audit G-12)', () => {
  test('unscored tournament resets immediately on Start over without prompt', async ({ page }) => {
    await generateTournament(page);

    // No matches scored yet. Clicking "Start over" should reset immediately.
    const startOverBtn = page.getByRole('button', { name: 'Start over' });
    await expect(startOverBtn).toBeVisible();
    await startOverBtn.click();

    // Verify back to setup state (participant textarea visible)
    await expect(page.getByPlaceholder(/participant names/i)).toBeVisible();
    // Verify no confirmation dialog appeared
    await expect(page.getByRole('dialog', { name: 'Start a New Tournament?' })).toHaveCount(0);
  });

  test('scored tournament requires confirmation before resetting', async ({ page }) => {
    await generateTournament(page);

    // Open first match and score it
    const match = page.locator('[data-match-ready="true"]').first();
    await match.click();

    const scoreDialog = page.getByRole('dialog', { name: 'Update Score' });
    await expect(scoreDialog).toBeVisible();
    await scoreDialog.getByRole('spinbutton').nth(0).fill('3');
    await scoreDialog.getByRole('spinbutton').nth(1).fill('1');
    await scoreDialog.getByRole('button', { name: 'Save' }).click();
    await expect(scoreDialog).toHaveCount(0);

    // Verify match is marked completed with a winner
    await expect(page.locator('[data-match-status="completed"]').first()).toBeVisible();
    await expect(page.locator('text=won').first()).toBeVisible();

    // Now click "Start over"
    const startOverBtn = page.getByRole('button', { name: 'Start over' });
    await startOverBtn.click();

    // Confirmation dialog must appear
    const confirmDialog = page.getByRole('dialog', { name: 'Start a New Tournament?' });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('clear the current bracket and erase all recorded match results');

    // Clicking "Keep Bracket" cancels the reset
    await confirmDialog.getByRole('button', { name: 'Keep Bracket' }).click();
    await expect(confirmDialog).toHaveCount(0);

    // Verify tournament is still active with recorded scores and winner
    await expect(page.locator('[data-match-status="completed"]').first()).toBeVisible();
    await expect(page.locator('text=won').first()).toBeVisible();

    // Click "Start over" again
    await startOverBtn.click();
    await expect(confirmDialog).toBeVisible();

    // Clicking "Reset Bracket" confirms reset
    await confirmDialog.getByRole('button', { name: 'Reset Bracket' }).click();
    await expect(confirmDialog).toHaveCount(0);

    // Tournament is wiped and setup form is back
    await expect(page.getByPlaceholder(/participant names/i)).toBeVisible();
  });
});
