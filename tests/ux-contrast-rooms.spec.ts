import { test, expect, type Locator, type Page } from '@playwright/test';
import { GAMES } from '../src/lib/games';
import { skipIfDemoMode } from './qa-city-helpers';
import { contrastProblems, describe, newContrastDecoder, settleAndScrollThrough } from './helpers/pixel-contrast';

// UX audit finding U-04, the rooms: in a multiplayer room in the light theme the green "Live" badge failed on every screen
// (3.35 : 1) and Team Maker, Rock Paper Scissors and Trivia had more failing text, and the Spintra City lobby's empty
// seats were 2.7 : 1 in the dark theme. Each room type is opened as its host sees it, and the activities a host can drive
// alone are taken to the state they are read in (a card drawn, a winner picked, teams made), in both themes, and judged with
// the same pixel measurement as the tool pages (tests/ux-contrast.spec.ts). Rooms need the database, so this skips itself in
// a build without Supabase (CI's `validate`) and runs where the database specs run (`db-integration`).

const ROOM_TYPES = [...new Set([...GAMES.map((g) => g.type), 'party', 'city'])];

// What a host can reach alone (not Guess the Number's hints, Rock Paper Scissors results or a tournament match: those need a second player). `reached` is something only that state shows: a scenario that did not get there must fail,
// not pass on the opening screen.
type RoomScenario = { type: string; state: string; run: (page: Page) => Promise<void>; reached: (page: Page) => Locator };
const ROOM_SCENARIOS: RoomScenario[] = [
  {
    type: 'name-draw',
    state: 'a winner picked',
    run: async (page) => {
      await page.getByRole('button', { name: /Draw a Name/ }).click();
    },
    reached: (page) => page.getByText('Selected Winner'),
  },
  {
    type: 'team-maker',
    state: 'teams made',
    run: async (page) => {
      await page.getByRole('button', { name: /2 Teams/ }).click();
    },
    reached: (page) => page.getByText('Team 1').first(),
  },
  {
    type: 'truth-or-dare',
    state: 'a truth card',
    run: async (page) => {
      await page.getByRole('button', { name: /Draw Truth/ }).click();
    },
    reached: (page) => page.locator('[role="status"]').filter({ hasText: /Truth/ }).first(),
  },
  {
    type: 'truth-or-dare',
    state: 'a dare card',
    run: async (page) => {
      await page.getByRole('button', { name: /Draw Dare/ }).click();
    },
    reached: (page) => page.locator('[role="status"]').filter({ hasText: /Dare/ }).first(),
  },
  {
    type: 'never-have-i-ever',
    state: 'a statement answered',
    run: async (page) => {
      await page.getByRole('button', { name: /Next Statement/ }).click();
      await page.getByRole('button', { name: /I have/ }).click();
    },
    reached: (page) => page.getByText(/→ I have/),
  },
  {
    type: 'trivia',
    state: 'a question on screen',
    run: async (page) => {
      await page.getByRole('button', { name: 'Start Trivia' }).click();
    },
    reached: (page) => page.getByText(/easy|medium|hard/i).first(),
  },
  {
    type: 'bingo',
    state: 'numbers called',
    run: async (page) => {
      const call = page.getByRole('button', { name: 'Call Next Number' });
      for (let i = 0; i < 3; i++) await call.click();
    },
    reached: (page) => page.getByText('Called', { exact: true }),
  },
];

async function openRoom(page: Page, type: string, theme: 'dark' | 'light') {
  await page.addInitScript((t) => {
    localStorage.setItem('spintra-theme', t);
    localStorage.setItem('spintra-cookie-consent', 'denied');
  }, theme);
  await page.goto(`/create?type=${type}`);
  await page.waitForSelector('[data-testid="create-room-button"]', { timeout: 30_000 });
  await page.click('[data-testid="create-room-button"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 30_000 });
  await skipIfDemoMode(page);
  await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

async function judgePage(page: Page) {
  const decoder = await newContrastDecoder(page);
  const { checked, unmeasured, problems } = await contrastProblems(page, decoder);
  await decoder.close();
  expect(checked, `the room has text to check (not measured: ${unmeasured.slice(0, 6).join('; ')})`).toBeGreaterThan(5);
  expect(unmeasured.length, `most text could be measured (not measured: ${unmeasured.slice(0, 8).join('; ')})`).toBeLessThanOrEqual(Math.max(8, Math.ceil((checked + unmeasured.length) * 0.15)));
  expect(describe(problems), 'text under WCAG AA contrast').toEqual([]);
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', colorScheme: theme });

    for (const type of ROOM_TYPES) {
      test(`a ${type} room, as its host sees it: every piece of text passes AA contrast`, async ({ page }) => {
        test.setTimeout(150_000);
        await openRoom(page, type, theme);
        await settleAndScrollThrough(page);
        await judgePage(page);
      });
    }

    for (const sc of ROOM_SCENARIOS) {
      test(`a ${sc.type} room, ${sc.state}: every piece of text passes AA contrast`, async ({ page }) => {
        test.setTimeout(150_000);
        await openRoom(page, sc.type, theme);
        await page.waitForTimeout(800);
        await sc.run(page);
        await expect(sc.reached(page), 'the scenario reached the state it names').toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(800);
        await judgePage(page);
      });
    }
  });
}
