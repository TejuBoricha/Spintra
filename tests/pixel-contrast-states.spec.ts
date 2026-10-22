import { test, expect, type Page } from '@playwright/test';
import { hideConfigBanner } from './helpers/config-banner';
import { contrastProblems } from './helpers/pixel-contrast';

// UX audit (7 Oct 2026), finding U-04, continued from pixel-contrast.spec.ts (which reads each page at rest): the same check on
// the states a tool shows after the person does something, where the colours are different: a result, a hint, a winner, a
// highlighted answer, a dialog. Found on the first scan of every state of the 14 tools: the coin flip's "Heads!" was dark ink on a
// dark badge (1.06 : 1) in the dark theme, the guess hints and the winner's name were pale tints on cream in the light theme,
// and several buttons had white text on amber, yellow, teal or lime. Both themes, a phone and a desktop.

// This gate is about pixels, not the database, so `db-integration` (the job with a real Supabase, NEXT_PUBLIC_SUPABASE_URL) leaves it
// to `validate`; the timings behind that are in .github/workflows/ci.yml. Locally it always runs.
test.skip(!!process.env.CI && !!process.env.NEXT_PUBLIC_SUPABASE_URL, 'run by the validate job, see .github/workflows/ci.yml');

type State = {
  name: string;
  path: string;
  /** Runs before the page loads (a fixed random number, so a case does not depend on luck). */
  init?: () => void;
  /** Gets the page into the state, and waits until it is there. */
  drive: (page: Page) => Promise<void>;
};

const click = (locator: ReturnType<Page['locator']>) => locator.evaluate((el) => (el as HTMLElement).click());

const STATES: State[] = [
  {
    name: 'Coin Flip: a result and the statistics',
    path: '/tools/coin-flip',
    drive: async (page) => {
      await click(page.getByRole('button', { name: /Flip Coin/ }));
      await expect(page.getByText(/^(Heads|Tails)!$/)).toBeVisible();
    },
  },
  {
    name: 'Guess Number: a hint and the guesses so far',
    path: '/tools/guess-number',
    init: () => {
      Math.random = () => 0.5; // the number is 26: 1 is too low and 50 too high
    },
    drive: async (page) => {
      const field = page.getByPlaceholder(/Enter 1-/);
      await field.fill('1');
      await click(page.getByRole('button', { name: 'Guess', exact: true }));
      await expect(page.getByText(/Too low/)).toBeVisible();
      await field.fill('50');
      await click(page.getByRole('button', { name: 'Guess', exact: true }));
      await expect(page.getByText(/Too high/)).toBeVisible();
    },
  },
  {
    name: 'Name Draw: the winner',
    path: '/tools/name-draw',
    drive: async (page) => {
      await page.getByPlaceholder(/paste names/i).fill('Ann\nBob\nCy');
      await click(page.getByRole('button', { name: /Draw One/ }));
      await expect(page.getByText('Winner!')).toBeVisible({ timeout: 15000 });
    },
  },
  {
    name: 'Team Maker: the teams',
    path: '/tools/team-maker',
    drive: async (page) => {
      await page.locator('textarea').first().fill('Alex\nJordan\nTaylor\nMorgan\nCasey\nRiley');
      await click(page.getByRole('button', { name: /Generate Teams/ }));
      await expect(page.getByLabel('Add a player to Team 1').filter({ visible: true })).toBeVisible();
    },
  },
  {
    name: 'Tournament: a bracket',
    path: '/tools/tournament',
    drive: async (page) => {
      await page.getByPlaceholder(/participant names/i).fill('Alpha\nBravo\nCharlie\nDelta');
      await click(page.getByRole('button', { name: /Generate Bracket/ }));
      await expect(page.locator('[data-match-ready="true"]').first()).toBeVisible();
    },
  },
  {
    name: 'Tournament: the Update Score dialog',
    path: '/tools/tournament',
    drive: async (page) => {
      await page.getByPlaceholder(/participant names/i).fill('Alpha\nBravo\nCharlie\nDelta');
      await click(page.getByRole('button', { name: /Generate Bracket/ }));
      await click(page.locator('[data-match-ready="true"]').first());
      await expect(page.getByText('Update Score')).toBeVisible();
    },
  },
  {
    name: 'Rock Paper Scissors: a round',
    path: '/tools/rps',
    drive: async (page) => {
      await click(page.locator('button:has-text("Rock")').first());
      await expect(page.getByText(/You Win!|AI Wins!|Draw!/).first()).toBeVisible({ timeout: 10000 });
    },
  },
  {
    name: 'Truth or Dare: a truth',
    path: '/tools/truth-or-dare',
    drive: async (page) => {
      await click(page.getByRole('button', { name: /Truth/ }).first());
      await expect(page.getByRole('button', { name: /New Truth/ })).toBeVisible();
    },
  },
  {
    name: 'Never Have I Ever: the answer',
    path: '/tools/never-have-i-ever',
    drive: async (page) => {
      await click(page.getByRole('button', { name: /I Have/ }));
      await expect(page.getByText("You've done it!")).toBeVisible();
    },
  },
  {
    name: 'Trivia: an answered question',
    path: '/tools/trivia',
    drive: async (page) => {
      await click(page.locator('main button.rounded-xl').first());
      await expect(page.getByRole('button', { name: /Next Question|See Results/ })).toBeVisible();
    },
  },
  {
    name: 'Bingo: numbers called',
    path: '/tools/bingo',
    drive: async (page) => {
      for (let i = 0; i < 12; i++) await click(page.getByRole('button', { name: 'Call Next Number' }));
      await expect(page.getByRole('button', { name: 'Call Next Number' })).toBeEnabled();
    },
  },
  {
    name: 'Word Scramble: a wrong guess and hints',
    path: '/tools/word-scramble',
    drive: async (page) => {
      await page.getByPlaceholder('Your guess...').fill('zzzzzzzz');
      await click(page.getByRole('button', { name: 'Guess', exact: true }));
      await expect(page.getByText('Not quite. Try again.').first()).toBeVisible();
      for (let i = 0; i < 3; i++) await click(page.getByRole('button', { name: /Hint/ }));
    },
  },
  {
    name: 'Dice: a roll and the statistics',
    path: '/tools/dice',
    drive: async (page) => {
      await click(page.getByRole('button', { name: /^Roll \d+d\d+/i }));
      await expect(page.getByText('Rolls distribution', { exact: false })).toBeVisible();
    },
  },
];

for (const [theme, width, height] of [['dark', 1280, 800], ['light', 1280, 800], ['dark', 390, 844], ['light', 390, 844]] as const) {
  test.describe(`${theme} theme, ${width}px wide`, () => {
    test.use({ viewport: { width, height }, colorScheme: theme, reducedMotion: 'reduce' });
    for (const state of STATES) {
      test(`${state.name}: all text has enough contrast`, async ({ page }) => {
        await page.addInitScript(([t]) => {
          localStorage.setItem('spintra-theme', t);
          localStorage.setItem('spintra-cookie-consent', 'denied');
        }, [theme]);
        if (state.init) await page.addInitScript(state.init);
        await page.goto(state.path);
        await page.waitForLoadState('load');
        await hideConfigBanner(page);
        await page.waitForTimeout(400); // hydration, so a click reaches a handler
        await state.drive(page);
        await page.waitForTimeout(700); // a toast or an entrance that the state starts
        expect(await contrastProblems(page)).toEqual([]);
      });
    }
  });
}
