import { test, expect, type Page } from '@playwright/test';

// The Update Score overlay of the Tournament tool was a plain `fixed inset-0` div: no dialog role or name (a screen reader said
// nothing when it opened), focus stayed on the page behind it (a keyboard user tabbed through the bracket under the backdrop), and
// Escape did nothing. It is the site's `Dialog` now, as every other modal is. Found by the contrast scan of the tool's states.

async function openScoreDialog(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.goto('/tools/tournament');
  await page.getByPlaceholder(/participant names/i).fill('Alpha\nBravo\nCharlie\nDelta');
  await page.getByRole('button', { name: /Generate Bracket/ }).evaluate((el) => (el as HTMLElement).click());
  const match = page.locator('[data-match-ready="true"]').first();
  await expect(match).toBeVisible();
  await match.evaluate((el) => (el as HTMLElement).click());
}

test.describe('Tournament: the Update Score dialog', () => {
  test('is a dialog with a name, and focus moves into it', async ({ page }) => {
    await openScoreDialog(page);
    const dialog = page.getByRole('dialog', { name: 'Update Score' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(':focus'), 'focus is inside the dialog').toHaveCount(1);
  });

  test('keeps focus inside while Tab is pressed', async ({ page }) => {
    await openScoreDialog(page);
    const dialog = page.getByRole('dialog', { name: 'Update Score' });
    await expect(dialog).toBeVisible();
    // two score fields, Cancel and Save: seven presses go round the dialog more than once, and leave a dialog that does not trap
    // focus somewhere on the bracket. The trap parks focus on a guard element for an instant when it wraps, hence the poll.
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Tab');
      await expect.poll(() => dialog.locator(':focus').count(), { message: `after Tab ${i + 1}, focus is inside the dialog`, timeout: 2000 }).toBe(1);
    }
  });

  test('Escape closes it, and Cancel and the score fields still work', async ({ page }) => {
    await openScoreDialog(page);
    const dialog = page.getByRole('dialog', { name: 'Update Score' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    await page.locator('[data-match-ready="true"]').first().evaluate((el) => (el as HTMLElement).click());
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);

    await page.locator('[data-match-ready="true"]').first().evaluate((el) => (el as HTMLElement).click());
    await dialog.getByRole('spinbutton').nth(0).fill('3');
    await dialog.getByRole('spinbutton').nth(1).fill('1');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('scores that cannot be saved are explained inside the dialog, where a screen reader can hear them', async ({ page }) => {
    // While a modal is open everything outside it is hidden from assistive technology, the toaster included, so a toast would be
    // seen but never announced.
    await openScoreDialog(page);
    const dialog = page.getByRole('dialog', { name: 'Update Score' });
    await dialog.getByRole('button', { name: 'Save' }).click(); // 0 : 0, which an elimination match cannot end on
    await expect(dialog, 'the dialog stays open').toBeVisible();
    const alert = dialog.getByRole('alert');
    await expect(alert).toContainText("can't be tied");
    await dialog.getByRole('spinbutton').nth(0).fill('2');
    await expect(alert, 'the message goes once a score changes').toHaveCount(0);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);
  });
});
