import { test, expect, type Page } from '@playwright/test';
import { SITE_PAGES } from './site-routes';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), finding U-11: iOS Safari zooms the page into any text field whose font is under 16px when it is tapped, and
// leaves it zoomed. Every field was 14px (`text-sm` in the shared Input and Textarea). The shared components now use `text-base`
// (16px) on a phone and `md:text-sm` (14px) from 768px up, which changes nothing on a desktop. This reads the computed font size of
// every field a person can tap, on every page at phone width, so a new page-level field cannot bring the zoom back.

const FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]):not([type=color]), textarea, select';

async function smallFields(page: Page) {
  return page.evaluate((selector) => {
    const found: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || cs.display === 'none' || cs.visibility === 'hidden') continue;
      const size = parseFloat(cs.fontSize);
      if (size < 16) {
        const name = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.id || el.tagName.toLowerCase();
        found.push(`${el.tagName.toLowerCase()} "${name}" is ${size}px`);
      }
    }
    return found;
  }, FIELD);
}

test.describe('every text field is at least 16px on a phone (so iOS does not zoom into it)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of SITE_PAGES) {
    test(`${path}`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
      await page.goto(path);
      await page.waitForLoadState('load');
      await hideConfigBanner(page);
      await page.waitForTimeout(400); // hydration: client-rendered fields
      expect(await smallFields(page)).toEqual([]);
    });
  }

  test('the Join dialog\'s code boxes', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
    await page.goto('/');
    await hideConfigBanner(page);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Open menu' }).click(); // on a phone the navbar's JOIN is in the menu
    await page.getByRole('button', { name: /^join/i }).first().click();
    await expect(page.getByRole('dialog', { name: 'Join Room' })).toBeVisible();
    expect(await smallFields(page)).toEqual([]);
  });

  test('the fields that appear after the visitor acts (Lucky Wheel rename, Team Maker player, Tournament seeds)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
    await page.goto('/tools/lucky-wheel');
    await hideConfigBanner(page);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^Rename Prize 1/ }).evaluate((el) => (el as HTMLElement).click());
    expect(await smallFields(page), 'Lucky Wheel with a rename field open').toEqual([]);

    await page.goto('/tools/team-maker');
    await page.waitForTimeout(400);
    await page.locator('textarea').first().fill('Alex\nJordan\nTaylor\nMorgan');
    await page.getByRole('button', { name: /Generate Teams/ }).evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByLabel('Add a player to Team 1').filter({ visible: true })).toBeVisible();
    expect(await smallFields(page), 'Team Maker with teams').toEqual([]);
  });
});
