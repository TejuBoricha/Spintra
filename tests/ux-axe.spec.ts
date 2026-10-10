import fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { SITE_PAGES, NOT_FOUND_PATH } from './site-routes';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), findings U-05 and U-27: controls and dialogs with no accessible name (both
// dialogs, the dice and name-draw inputs, the Trivia room's two selects, the collapse and reset icon
// buttons) and the Tools page's heading order. axe-core (WCAG 2.0 to 2.2 A and AA plus its best
// practices) must find nothing critical or serious on any page, in either theme, on a phone and on a
// desktop, nor in the dialogs once they are open.
//
// axe rates heading-order "moderate", so the impact filter alone would let a skipped heading level through
// (U-27 would never fail this gate); the rules in ALSO_FAIL fail whatever their impact.
//
// Colour contrast is switched off here on purpose: axe cannot judge text on gradients and translucent
// layers (it left 1,278 elements "needs review"), so contrast gets its own check that samples the real
// pixels (the next wave of the audit). Everything else axe checks is on.

const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ALSO_FAIL = ['heading-order'];

async function violations(page: Page): Promise<string[]> {
  await page.evaluate(axeSource);
  return page.evaluate(async (alsoFail) => {
    const axe = (window as unknown as { axe: { run: (ctx: Document, opts: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      rules: { 'color-contrast': { enabled: false } },
      resultTypes: ['violations'],
    });
    return result.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious' || alsoFail.includes(v.id))
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} element${v.nodes.length === 1 ? '' : 's'}, e.g. ${v.nodes[0].target.join(' ').slice(0, 90)}`);
  }, ALSO_FAIL);
}

async function openPage(page: Page, theme: 'dark' | 'light', path: string) {
  await page.addInitScript(([t]) => {
    localStorage.setItem('spintra-theme', t);
    localStorage.setItem('spintra-cookie-consent', 'denied');
  }, [theme]);
  await page.goto(path);
  await page.waitForLoadState('load');
  await hideConfigBanner(page); // the demo-mode warning bar covers the navbar buttons (see the helper)
  await page.waitForTimeout(400); // hydration, so client-rendered controls exist
}

const PAGES = [...SITE_PAGES, NOT_FOUND_PATH];

for (const [theme, width, height] of [['dark', 1280, 800], ['light', 1280, 800], ['dark', 390, 844]] as const) {
  test.describe(`${theme} theme, ${width}px wide`, () => {
    test.use({ viewport: { width, height }, colorScheme: theme });
    for (const path of PAGES) {
      test(`${path}: no critical, serious or heading-order accessibility violations`, async ({ page }) => {
        await openPage(page, theme, path);
        expect(await violations(page)).toEqual([]);
      });
    }
  });
}

test.describe('dialogs and the room', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the Join dialog has a name, labelled code boxes and no violations', async ({ page }) => {
    await openPage(page, 'dark', '/');
    await page.getByRole('button', { name: 'JOIN', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Join Room' })).toBeVisible();
    await expect(page.getByLabel('Room code, character 1 of 6')).toBeVisible();
    await expect(page.getByLabel('Room code, character 6 of 6')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('the What\'s next dialog has a name and no violations', async ({ page }) => {
    await openPage(page, 'dark', '/');
    await page.getByRole('button', { name: /what.s launching next/i }).click();
    await expect(page.getByRole('dialog', { name: /what.s next/i })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('the Delete my data dialog has no violations', async ({ page }) => {
    await openPage(page, 'dark', '/settings');
    await page.getByRole('button', { name: 'Delete my data' }).click();
    await expect(page.getByRole('dialog', { name: /delete my data/i })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('the dice slider and the draw count can be found by name', async ({ page }) => {
    await openPage(page, 'dark', '/tools/dice');
    await expect(page.getByRole('slider', { name: 'Number of dice' })).toBeVisible();
    await openPage(page, 'dark', '/tools/name-draw');
    await expect(page.getByLabel('Draw Count')).toBeVisible();
  });

  test('Team Maker: each team has a Hide / Show button with a name that says whether it is open', async ({ page }) => {
    await openPage(page, 'dark', '/tools/team-maker');
    await page.getByPlaceholder(/enter names/i).fill('Alex\nJordan\nTaylor\nMorgan\nCasey\nRiley');
    await page.getByRole('button', { name: /generate teams/i }).click();
    const hide = page.getByRole('button', { name: /^Hide / }).first();
    await expect(hide).toHaveAttribute('aria-expanded', 'true');
    await hide.click();
    await expect(page.getByRole('button', { name: /^Show / }).first()).toHaveAttribute('aria-expanded', 'false');
    expect(await violations(page)).toEqual([]);
  });

  test('a Trivia room: Category and Difficulty are labelled, and nothing is critical', async ({ page }) => {
    await openPage(page, 'dark', '/create?type=party');
    await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 30000 });
    await page.click('[data-testid="create-room-button-client"]');
    await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45000 });
    await page.click('button[aria-label="Switch game activity"]');
    await page.click('button[aria-label="Select Trivia"]');
    await expect(page.getByLabel('Category')).toBeVisible();
    await expect(page.getByLabel('Difficulty')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
