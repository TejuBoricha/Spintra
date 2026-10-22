import { test, expect, type Page } from '@playwright/test';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), wave 2: U-17 (a disabled button reads as an odd khaki block and does not say why), U-10 (one sentence
// broken into columns that wrap on their own) and the two result-state defects of U-19 that the contrast scan cannot see (the
// percentage that runs into the option text, and the most important line of Guess Number set at 12px).

async function open(page: Page, path: string, init?: () => void) {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  if (init) await page.addInitScript(init);
  await page.goto(path);
  await page.waitForLoadState('load');
  await hideConfigBanner(page);
  await page.waitForTimeout(400);
}

/** How colourful a CSS colour is, 0 (grey) to 1 (a pure hue), from its rgb() or color() string. */
function saturation(color: string): number {
  const nums = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  if (nums.length < 3) return 0;
  const scale = color.startsWith('color(') || color.startsWith('oklab') ? 1 : 255;
  const [r, g, b] = nums.map((n) => n / scale);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

test.describe('U-17: a disabled main button is a neutral block', () => {
  for (const [path, name] of [
    ['/tools/team-maker', /Generate Teams/],
    ['/tools/tournament', /Generate Bracket/],
    ['/tools/name-draw', /Draw One/],
    ['/', /^Join$/],
  ] as const) {
    for (const theme of ['dark', 'light'] as const) {
      test(`${path} (${theme}): ${name}`, async ({ page }) => {
        await page.addInitScript(([t]) => localStorage.setItem('spintra-theme', t), [theme]);
        await open(page, path);
        const button = page.getByRole('button', { name }).first();
        await expect(button).toBeDisabled();
        const style = await button.evaluate((el) => {
          const cs = getComputedStyle(el);
          return { image: cs.backgroundImage, color: cs.backgroundColor, opacity: cs.opacity, filter: cs.filter };
        });
        expect(style.image, 'no gradient or brand fill left on a disabled button').toBe('none');
        expect(saturation(style.color), `background ${style.color} is grey`).toBeLessThan(0.12);
        expect(style.opacity, 'not faded: a faded saturated fill is what looks khaki').toBe('1');
        expect(['none', 'grayscale(0)'], 'no grey-out filter either').toContain(style.filter);
      });
    }
  }

  test('Team Maker and Tournament say why the button is disabled, and stop saying it when it is not', async ({ page }) => {
    await open(page, '/tools/team-maker');
    const why = page.getByText('Add some names to make teams.');
    await expect(why).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate Teams/ })).toHaveAccessibleDescription('Add some names to make teams.');
    await page.locator('textarea').first().fill('Alex\nJordan');
    await expect(why).toHaveCount(0);

    await open(page, '/tools/tournament');
    const need = page.getByText('Add at least two participants to make a bracket.');
    await expect(need).toBeVisible();
    await page.getByPlaceholder(/participant names/i).fill('Alpha\nBravo');
    await expect(need).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Generate Bracket/ })).toBeEnabled();
  });
});

test.describe('U-10: one sentence is one element', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  async function sentence(page: Page, startsWith: string) {
    return page.evaluate((start) => {
      const el = Array.from(document.querySelectorAll('p')).find((p) => (p.textContent ?? '').trim().startsWith(start));
      if (!el) return null;
      return { text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(), display: getComputedStyle(el).display, links: el.querySelectorAll('a').length };
    }, startsWith);
  }

  test('the banner on every tool page', async ({ page }) => {
    await open(page, '/tools/dice');
    const banner = await sentence(page, 'Want to play with friends?');
    expect(banner?.text).toBe('Want to play with friends? Create a Multiplayer Room to invite them!');
    expect(banner?.display, 'a block of text, not a flex row whose children wrap on their own').toBe('block');
    expect(banner?.links).toBe(1);
  });

  test('the badge in the home hero', async ({ page }) => {
    await open(page, '/');
    const badge = await sentence(page, 'Free games and group tools');
    expect(badge?.text).toBe('Free games and group tools, played in one shared room');
    expect(badge?.display).not.toBe('flex');
    expect(badge?.display).not.toBe('inline-flex');
  });
});

test.describe('U-19: result states', () => {
  test('Would You Rather: after voting, the option text and its percentage do not touch', async ({ page }) => {
    await open(page, '/tools/would-you-rather');
    const first = page.locator('main button').filter({ hasText: /./ }).nth(1);
    await first.evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByText(/^\d+%$/).first()).toBeVisible();
    const gaps = await page.evaluate(() => {
      const out: number[] = [];
      for (const button of Array.from(document.querySelectorAll('main button'))) {
        const percent = Array.from(button.querySelectorAll('span')).find((s) => /^\d+%$/.test((s.textContent ?? '').trim()));
        if (!percent) continue;
        const label = button.querySelector('span'); // the option text is the first span; the bar between the two is a div
        if (!label || label === percent) { out.push(-999); continue; }
        out.push(Math.round(percent.getBoundingClientRect().left - label.getBoundingClientRect().right));
      }
      return out;
    });
    expect(gaps.length, 'both options show a percentage').toBe(2);
    for (const gap of gaps) expect(gap, 'at least 8px between the option text and the percentage').toBeGreaterThanOrEqual(8);
  });

  test('Guess Number: the feedback is body text, not a 12px badge', async ({ page }) => {
    await open(page, '/tools/guess-number', () => {
      Math.random = () => 0.5; // the number is 26: 1 is too low
    });
    await page.getByPlaceholder(/Enter 1-/).fill('1');
    await page.getByRole('button', { name: 'Guess', exact: true }).evaluate((el) => (el as HTMLElement).click());
    const hint = page.getByText(/Too low/);
    await expect(hint).toBeVisible();
    const size = await hint.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });
});
