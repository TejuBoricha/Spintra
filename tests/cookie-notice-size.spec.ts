import { test, expect } from '@playwright/test';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), finding U-09: on a first visit the cookie notice sat over a quarter to two fifths of a phone screen (five
// lines of text), half-covering the hero's "Explore Games" button. The notice is required, but the first screen is the product's
// pitch. It is two short sentences now, with the same facts, the Privacy Policy link, and Accept and Decline at equal weight (the
// part that must not change: a bigger Accept is the nudge the UK Children's Code singles out).

for (const [width, height, maxShare] of [[390, 844, 0.2], [320, 640, 0.28]] as const) {
  test(`at ${width}px the notice takes at most ${maxShare * 100}% of the screen`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/'); // no consent stored: the notice shows
    await hideConfigBanner(page);
    const notice = page.getByRole('region', { name: 'Cookie notice' });
    await expect(notice).toBeVisible();
    await page.waitForTimeout(600); // its entrance
    const box = (await notice.boundingBox())!;
    expect(box.height / height, `the notice is ${Math.round(box.height)}px tall on a ${height}px screen`).toBeLessThanOrEqual(maxShare);
  });
}

test('it still says what is stored, asks the one question, and offers equal choices', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await hideConfigBanner(page);
  const notice = page.getByRole('region', { name: 'Cookie notice' });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('local storage');
  await expect(notice).toContainText('May we also measure how the site is used');
  await expect(notice).toContainText('No advertising, ever.');
  await expect(notice.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/legal/privacy');
  const accept = (await notice.getByRole('button', { name: 'Accept' }).boundingBox())!;
  const decline = (await notice.getByRole('button', { name: 'Decline' }).boundingBox())!;
  expect(Math.abs(accept.width - decline.width), 'Accept and Decline are the same size').toBeLessThanOrEqual(1);
  expect(Math.abs(accept.height - decline.height)).toBeLessThanOrEqual(1);
});
