import { test, expect } from '@playwright/test';

// WCAG 2.5.3, Label in Name: a control's accessible name has to contain the text it shows. Each Lucky Wheel
// template button shows "<label>" and "<N> entries", but carried aria-label='Apply "<label>" template (replaces
// current entries)', which leaves "N entries" out. axe-core 4.14 reports that as label-content-name-mismatch
// (serious); the version pinned before it did not, so tests/ux-axe.spec.ts only caught it after a dependency bump.
// This test checks the rule directly, so it holds on any axe-core version.

test("each Lucky Wheel template button's accessible name contains the text it shows", async ({ page }) => {
  await page.goto('/tools/lucky-wheel', { waitUntil: 'networkidle' });

  const buttons = page.getByRole('heading', { name: 'Templates', exact: true }).locator('xpath=..').getByRole('button');
  const count = await buttons.count();
  expect(count, 'the Templates panel has its template buttons').toBeGreaterThanOrEqual(3);

  for (let i = 0; i < count; i++) {
    const shown = (await buttons.nth(i).innerText()).replace(/\s+/g, ' ').trim();
    expect(shown, `template button ${i + 1} shows text`).not.toBe('');
    // getByRole matches the accessible name as a case-insensitive, whitespace-normalised substring.
    await expect(page.getByRole('button', { name: shown }), `a button named like "${shown}"`).toHaveCount(1);
  }
});
