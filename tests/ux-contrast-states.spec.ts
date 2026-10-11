import { test, expect, type Locator, type Page } from '@playwright/test';
import { contrastProblems, describe, newContrastDecoder } from './helpers/pixel-contrast';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit finding U-04, the states: the words a player came for appear only after they act (Heads or Tails, a score, a
// winner, a drawn name, a bracket), and those were the elements that failed (white on amber 2.0 : 1, mint on mint 1.0 : 1,
// a coin badge 1.03 : 1). tests/ux-contrast.spec.ts judges every page as it loads; this drives each tool to the state it
// is read in and judges that, in both themes. Same pixel measurement (tests/helpers/pixel-contrast.ts).

const NAMES = 'Alice\nBob\nCharlie\nDavid\nEve\nFrank\nGrace\nHeidi';
// a button with visible words (the icon-only sound button has an aria-label, not text, so hasNotText would not skip it)
const firstOption = (page: Page) => page.locator('main button').filter({ hasText: /\S/ }).first();

// `reached` is something only the state itself shows: a scenario that did not get there must fail, not pass on an empty page
type Scenario = { tool: string; state: string; run: (page: Page) => Promise<void>; reached: (page: Page) => Locator };

const SCENARIOS: Scenario[] = [
  {
    tool: 'coin-flip',
    state: 'after three flips (result badge, tally)',
    reached: (page) => page.getByText(/^\d+%$/).first(),
    run: async (page) => {
      const flip = page.getByRole('button', { name: /Flip Coin/ });
      for (let i = 0; i < 3; i++) {
        await flip.click();
        await expect(flip).toBeEnabled({ timeout: 15_000 });
      }
    },
  },
  {
    tool: 'dice',
    state: 'after a roll',
    reached: (page) => page.getByText(/history|average|total/i).first(),
    run: async (page) => {
      await page.getByRole('button', { name: /^Roll/ }).click();
      await page.waitForTimeout(2500);
    },
  },
  {
    tool: 'rps',
    state: 'after three rounds (scores)',
    reached: (page) => page.getByText(/You Win!|AI Wins!|Draw!/).first(),
    run: async (page) => {
      for (const choice of ['Rock', 'Paper', 'Scissors']) {
        await page.locator('main button', { hasText: choice }).first().click();
        await page.waitForTimeout(2200);
      }
    },
  },
  {
    tool: 'bingo',
    state: 'after calling numbers',
    reached: (page) => page.getByText('8 of 75 numbers called'),
    run: async (page) => {
      const call = page.getByRole('button', { name: 'Call Next Number' });
      for (let i = 0; i < 8; i++) await call.click();
    },
  },
  {
    tool: 'name-draw',
    state: 'names loaded and two drawn',
    reached: (page) => page.getByText('Winner!').first(),
    run: async (page) => {
      await page.locator('textarea').first().fill(NAMES);
      await page.getByRole('button', { name: 'Draw One' }).click();
      await page.waitForTimeout(2500);
      await page.getByRole('button', { name: 'Draw One' }).click();
      await page.waitForTimeout(2500);
    },
  },
  {
    tool: 'tournament',
    state: 'single elimination bracket generated',
    reached: (page) => page.getByText(/Bracket generated/),
    run: async (page) => {
      await page.locator('textarea').first().fill(NAMES);
      await page.getByRole('button', { name: 'Generate Bracket' }).click();
      await page.waitForTimeout(1200);
    },
  },
  {
    tool: 'tournament',
    state: 'round robin table generated',
    reached: (page) => page.getByText('Standings').first(),
    run: async (page) => {
      await page.locator('main button', { hasText: 'Round Robin' }).first().click();
      await page.locator('textarea').first().fill(NAMES.split('\n').slice(0, 4).join('\n'));
      await page.getByRole('button', { name: 'Generate Bracket' }).click();
      await page.waitForTimeout(1200);
    },
  },
  {
    tool: 'team-maker',
    state: 'teams generated',
    reached: (page) => page.getByText(/\d+ Teams?/).first(),
    run: async (page) => {
      await page.locator('textarea').first().fill(NAMES);
      await page.getByRole('button', { name: 'Generate Teams' }).click();
      await page.waitForTimeout(1500);
    },
  },
  {
    tool: 'lucky-wheel',
    state: 'after a spin (result)',
    reached: (page) => page.getByText('Winner!').first(),
    run: async (page) => {
      const spin = page.getByRole('button', { name: /Spin/ }).first();
      await spin.click();
      await page.waitForTimeout(1000);
      await expect(page.getByRole('button', { name: /Spin/ }).first()).toBeEnabled({ timeout: 20_000 });
      await page.waitForTimeout(800);
    },
  },
  {
    tool: 'trivia',
    state: 'after answering a question',
    reached: (page) => page.getByText(/Correct!|Not quite/).first(),
    run: async (page) => {
      await firstOption(page).click();
      await page.waitForTimeout(1200);
    },
  },
  {
    tool: 'guess-number',
    state: 'after two guesses (hints)',
    reached: (page) => page.getByText(/Too (high|low)/).first(),
    run: async (page) => {
      const input = page.locator('main input[type="number"]').first();
      for (const n of ['10', '40']) {
        await input.fill(n);
        await page.getByRole('button', { name: 'Guess', exact: true }).click();
        await page.waitForTimeout(600);
      }
    },
  },
  {
    tool: 'truth-or-dare',
    state: 'a truth card',
    reached: (page) => page.getByRole('button', { name: /New Truth/ }),
    run: async (page) => {
      await page.getByRole('button', { name: 'Truth', exact: true }).click();
      await page.waitForTimeout(900);
    },
  },
  {
    tool: 'truth-or-dare',
    state: 'a dare card',
    reached: (page) => page.getByRole('button', { name: /New Dare/ }),
    run: async (page) => {
      await page.getByRole('button', { name: 'Dare', exact: true }).click();
      await page.waitForTimeout(900);
    },
  },
  {
    tool: 'would-you-rather',
    state: 'after voting (the split)',
    reached: (page) => page.getByText(/^\d+%$/).first(),
    run: async (page) => {
      await firstOption(page).click();
      await page.waitForTimeout(1500);
    },
  },
  {
    tool: 'never-have-i-ever',
    state: 'after answering',
    reached: (page) => page.getByText(/You've done it!/),
    run: async (page) => {
      await page.getByRole('button', { name: 'I Have' }).click();
      await page.waitForTimeout(1000);
    },
  },
  {
    tool: 'word-scramble',
    state: 'after a wrong guess and a hint',
    reached: (page) => page.getByText('Not quite. Try again.'),
    run: async (page) => {
      await page.getByPlaceholder('Your guess...').fill('zzzzz');
      await page.getByRole('button', { name: 'Guess', exact: true }).click();
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: 'Hint' }).click();
      await page.waitForTimeout(700);
    },
  },
];

for (const theme of ['dark', 'light'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', colorScheme: theme });

    for (const sc of SCENARIOS) {
      test(`/tools/${sc.tool}, ${sc.state}: every piece of text passes AA contrast`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.addInitScript((t) => {
          localStorage.setItem('spintra-theme', t);
          localStorage.setItem('spintra-cookie-consent', 'denied');
        }, theme);
        const decoder = await newContrastDecoder(page);
        await page.goto(`/tools/${sc.tool}`);
        await hideConfigBanner(page);
        await page.waitForLoadState('load');
        await page.waitForTimeout(600);
        await sc.run(page);
        await expect(sc.reached(page), 'the scenario reached the state it names').toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(500);
        const { checked, unmeasured, problems } = await contrastProblems(page, decoder);
        await decoder.close();
        expect(checked, `the state has text to check (not measured: ${unmeasured.slice(0, 6).join('; ')})`).toBeGreaterThan(5);
        expect(unmeasured.length, `most text could be measured (not measured: ${unmeasured.slice(0, 8).join('; ')})`).toBeLessThanOrEqual(Math.max(8, Math.ceil((checked + unmeasured.length) * 0.15)));
        expect(describe(problems), 'text under WCAG AA contrast').toEqual([]);
      });
    }
  });
}
