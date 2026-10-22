import { test, expect, type Page } from '@playwright/test';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), finding U-29: the Join dialog, the way into every multiplayer session, was rough in the details. The code
// boxes got labels (U-05), its arrow stopped bouncing under reduced motion (U-25) and its disabled button lost the olive (U-17, which
// ux-polish.spec.ts covers on the home page's button); what this adds is the close button, a 12px glyph in a 32px target even under a
// finger, and the hint line above the boxes (small capitals with wide tracking), plus the disabled "ENTER GAME" button in the dialog.

async function openJoin(page: Page) {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.goto('/');
  await page.waitForLoadState('load');
  await hideConfigBanner(page);
  await page.getByRole('button', { name: 'JOIN', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(400); // its entrance
}

for (const [who, options, smallest] of [
  ['a mouse', {}, 32],
  ['a finger', { hasTouch: true }, 44],
] as const) {
  test(`the close button is at least ${smallest}px for ${who}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options });
    const page = await context.newPage();
    await openJoin(page);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'the context is what the test says it is').toBe(who === 'a finger');
    // the layout size, not the painted box: the dialog is still scaling in when it is first read
    const size = await page.getByRole('dialog').getByRole('button', { name: 'Close' }).evaluate((el) => ({ w: (el as HTMLElement).offsetWidth, h: (el as HTMLElement).offsetHeight }));
    expect(Math.min(size.w, size.h), `the close button is ${size.w} by ${size.h}px`).toBeGreaterThanOrEqual(smallest);
    await context.close();
  });
}

test.describe('the hint and the disabled button', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the hint is 14px or more and stays on one line at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 }); // the navbar's JOIN is in the phone menu below 768px
    await openJoin(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const hint = page.getByText('Enter the 6-character code');
    const style = await hint.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { size: parseFloat(cs.fontSize), height: el.getBoundingClientRect().height, line: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 };
    });
    expect(style.size, 'font size').toBeGreaterThanOrEqual(14);
    expect(style.height / style.line, 'lines of text').toBeLessThan(1.5);
  });

  test('the disabled ENTER GAME button is a neutral block, not olive', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openJoin(page);
    const button = page.getByRole('button', { name: /ENTER GAME/ });
    await expect(button).toBeDisabled();
    const style = await button.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { image: cs.backgroundImage, color: cs.backgroundColor, opacity: cs.opacity };
    });
    const nums = (style.color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    expect(style.image, 'no gradient left').toBe('none');
    expect(Math.max(...nums) - Math.min(...nums), `background ${style.color} is grey`).toBeLessThan(0.12 * 255);
    expect(style.opacity).toBe('1');
  });
});
