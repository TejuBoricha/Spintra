import { test, expect } from '@playwright/test';
import { hideConfigBanner } from './helpers/config-banner';
import { contrastProblems } from './helpers/pixel-contrast';

// UX audit (7 Oct 2026), finding U-04, continued from pixel-contrast.spec.ts and pixel-contrast-states.spec.ts: a party room as
// its host sees it (demo mode, no Supabase: the lobby, the activity picker, and the first screen of each of the 14 activities),
// both themes, a phone and a desktop. The first scan of this found the same classes of problem as the tool pages: white text on
// amber, yellow, teal, cyan and lime gradients, pale text colours made for the dark page, a wheel pointer in the page's own text
// colour over a dark rim (invisible in the light theme), and a placeholder die dimmed to 40% opacity.
//
// Not covered: what each activity shows after the host acts (a question, a winner, a bracket), a second player's view, and
// Spintra City, whose board is dark in both themes.

const ACTIVITIES = [
  'Team Maker',
  'Lucky Wheel',
  'Name Draw',
  'Tournament',
  'Coin Flip',
  'Dice Roller',
  'Guess Number',
  'Rock Paper Scissors',
  'Truth or Dare',
  'Would You Rather',
  'Never Have I Ever',
  'Trivia',
  'Bingo',
  'Word Scramble',
];

for (const [theme, width, height] of [['dark', 1280, 800], ['light', 1280, 800], ['dark', 390, 844], ['light', 390, 844]] as const) {
  test.describe(`${theme} theme, ${width}px wide`, () => {
    test.use({ viewport: { width, height }, colorScheme: theme, reducedMotion: 'reduce' });
    test('a party room: the lobby, the picker and every activity have enough contrast', async ({ page }) => {
      test.setTimeout(180_000);
      await page.addInitScript(([t]) => {
        localStorage.setItem('spintra-theme', t);
        localStorage.setItem('spintra-cookie-consent', 'denied');
      }, [theme]);
      await page.goto('/create?type=party');
      await hideConfigBanner(page);
      await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 30000 });
      await page.click('[data-testid="create-room-button-client"]');
      await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45000 });
      await hideConfigBanner(page);
      await page.waitForTimeout(1500); // the room has joined and its lobby has rendered

      const problems: Record<string, string[]> = {};
      const check = async (state: string) => {
        const found = await contrastProblems(page);
        if (found.length) problems[state] = found;
      };
      const switchGame = page.locator('button[aria-label="Switch game activity"]');

      await check('lobby');
      await switchGame.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await check('the activity picker');
      for (const name of ACTIVITIES) {
        if (!(await page.locator(`button[aria-label="Select ${name}"]`).count())) await switchGame.click();
        await page.locator(`button[aria-label="Select ${name}"]`).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await page.waitForTimeout(1000); // the activity's first render and its entrance
        await check(name);
        await switchGame.click();
      }
      expect(problems).toEqual({});
    });
  });
}
