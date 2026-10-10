import fs from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { GLOBAL_ERROR_CSS } from '../src/app/global-error-styles';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026): three small findings with one behaviour each.

test.describe('U-07: Settings says "updated" only when the name changed', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('leaving the name field without changing it shows no toast', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
    await page.goto('/settings');
    const name = page.getByLabel('Display name');
    await expect(name).not.toHaveValue('');
    await name.focus();
    await expect(name).toBeFocused();
    await page.keyboard.press('Tab'); // leave it, having typed nothing
    await expect(name).not.toBeFocused(); // the blur has happened
    await page.waitForTimeout(700); // a toast, if one were coming, is up well before this
    // Read at one instant, not with a retrying assertion: toHaveCount(0) keeps polling for 5 s and the
    // toast clears itself after about 4 s, so on the old code (which does toast) it passed anyway.
    expect(await page.getByText('Display name updated!').count(), 'no toast after an unchanged blur').toBe(0);
  });

  test('changing the name and leaving the field says so once', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
    await page.goto('/settings');
    const name = page.getByLabel('Display name');
    await expect(name).not.toHaveValue('');
    await name.fill('Quiz Master');
    await page.keyboard.press('Tab');
    await expect(page.getByText('Display name updated!')).toHaveCount(1);
    await expect(name).toHaveValue('Quiz Master');
  });
});

// U-08: if the root layout fails, global-error.tsx replaces it and the site's stylesheet is not loaded
// (that layout is what imports it). The first version used the site's CSS variables and a fixed
// white-at-60% paragraph, which was white on white with a light device theme. The crash path cannot be
// triggered from outside, so this checks the two things that matter: the component's source uses none of
// the site's variables and uses the classes the CSS styles, and the CSS itself, put on the same markup in a
// real browser with no other stylesheet, gives readable text in both colour schemes.
test.describe('U-08: the crash page is readable with no site stylesheet', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'global-error.tsx'), 'utf8');
  const markup =
    '<div class="ge-wrap"><div class="ge-card"><h1>Something went wrong</h1><p>The app hit an unexpected error. Try reloading the page.</p><button class="ge-btn">Try again</button></div></div>';
  const SITE_VARIABLES = /var\(--(background|foreground|gradient-brand|text-on-lime|border)\b/;

  test("the component uses none of the site's CSS variables, and the classes the CSS styles", () => {
    expect(source).not.toMatch(SITE_VARIABLES);
    expect(GLOBAL_ERROR_CSS).not.toMatch(SITE_VARIABLES);
    for (const cls of ['ge-wrap', 'ge-card', 'ge-btn']) expect(source, `the component uses .${cls}`).toContain(`"${cls}"`);
    expect(source).toContain('GLOBAL_ERROR_CSS');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme} device theme: the heading and the explanation are at least 4.5 : 1`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: scheme });
      const page = await context.newPage();
      await page.setContent(`<!doctype html><html lang="en"><head><style>${GLOBAL_ERROR_CSS}</style></head><body>${markup}</body></html>`);
      const ratios = await page.evaluate(() => {
        const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const lum = ([r, g, b]: number[]) => {
          const f = (c: number) => {
            c /= 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (a: number[], b: number[]) => {
          const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
          return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
        };
        const card = rgb(getComputedStyle(document.querySelector('.ge-card')!).backgroundColor);
        const h1 = rgb(getComputedStyle(document.querySelector('h1')!).color);
        const p = rgb(getComputedStyle(document.querySelector('p')!).color);
        const buttonText = rgb(getComputedStyle(document.querySelector('.ge-btn')!).color);
        return { heading: ratio(h1, card), explanation: ratio(p, card), button: ratio(buttonText, [226, 247, 42]) };
      });
      expect(ratios.heading, 'heading against its card').toBeGreaterThanOrEqual(4.5);
      expect(ratios.explanation, 'explanation against its card').toBeGreaterThanOrEqual(4.5);
      expect(ratios.button, 'button text against its fill').toBeGreaterThanOrEqual(4.5);
      await context.close();
    });
  }
});

// U-25: the stylesheet's prefers-reduced-motion rule does not reach framer-motion's JavaScript-driven
// animation, and 11 of them loop forever. The Join button's arrow bobs sideways for as long as the dialog is
// open; with a device that asks for less motion it must stay still, and (so this cannot pass by never moving)
// it must move when motion is allowed.
test.describe('U-25: framer-motion respects the reduced-motion setting', () => {
  async function arrowPositions(page: Page) {
    await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
    await page.goto('/');
    await hideConfigBanner(page);
    await page.getByRole('button', { name: 'JOIN', exact: true }).click();
    const arrow = page.getByRole('button', { name: /enter game/i }).locator('span', { hasText: '→' }).last();
    await expect(arrow).toBeVisible();
    const read = () => arrow.evaluate((el) => getComputedStyle(el).transform);
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      seen.add(await read());
      await page.waitForTimeout(300);
    }
    return seen;
  }

  test.describe('motion allowed', () => {
    test.use({ reducedMotion: 'no-preference' });
    test('the arrow moves', async ({ page }) => {
      expect((await arrowPositions(page)).size, 'the arrow takes more than one position').toBeGreaterThan(1);
    });
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('the arrow stays still', async ({ page }) => {
      expect((await arrowPositions(page)).size, 'the arrow takes one position').toBe(1);
    });
  });
});

// Code review of the accessibility wave: the wheel's entry names were clickable spans (invisible to a keyboard).
// They are buttons now; the rename field that replaces one drew no outline, and when it closed the focus fell to
// the top of the page. Enter and Escape give the focus back to the entry; the open field shows an outline.
test.describe('Lucky wheel: renaming an entry by keyboard', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Escape and Enter return focus to the entry, and the open field shows an outline', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
    await page.goto('/tools/lucky-wheel');
    await hideConfigBanner(page);
    const rename = page.getByRole('button', { name: /^Rename / }).first();
    await expect(rename).toBeVisible();
    const id = await rename.getAttribute('id');
    await rename.focus();
    await page.keyboard.press('Enter'); // opens the field
    const field = page.locator('input:focus');
    await expect(field).toHaveAttribute('maxlength', '40');
    expect(await field.evaluate((el) => getComputedStyle(el).outlineStyle), 'the open field draws an outline').not.toBe('none');
    await field.fill('Typed then cancelled');
    await page.keyboard.press('Escape');
    await expect(page.locator(`#${id}`), 'Escape gives the focus back to the entry').toBeFocused();
    await expect(page.locator(`#${id}`), 'Escape cancels: the typed name is not kept').not.toHaveAttribute('aria-label', /Typed then cancelled/);
    await page.keyboard.press('Enter');
    await expect(field).toHaveAttribute('maxlength', '40');
    await field.fill('Zed');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Rename Zed' }), 'Enter keeps the new name and returns the focus').toBeFocused();
  });
});
