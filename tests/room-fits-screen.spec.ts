import { test, expect } from '@playwright/test';
import { skipInDbIntegration } from './helpers/ci-skip';
import { createDemoPartyRoom } from './helpers/demo-room';
import { hideConfigBanner } from './helpers/config-banner';

skipInDbIntegration(test);

// UX audit (7 Oct 2026), finding U-20 (and R-13): a room is an app, not a document. The room's shell was `min-h-screen` inside a
// <main> that already has 6rem of padding for the fixed navbar, so the document was always 96px taller than the window and the chat
// input started below the fold at every desktop size (840px in an 800px window). The room is the screen minus the navbar now, and
// its panels (the game, the chat, the people) scroll inside it. A demo-mode party room (no Supabase), as its host.

for (const [width, height] of [[1280, 800], [1366, 768], [1920, 1080], [1024, 768]] as const) {
  test(`at ${width} x ${height} the room is the window: no page scroll, and the message box is on the first screen`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await createDemoPartyRoom(page);
    await page.waitForTimeout(600); // the lobby's entrance
    const read = await page.evaluate(() => {
      const de = document.documentElement;
      const input = document.querySelector<HTMLElement>('input[aria-label="Type a message"]');
      const box = input?.getBoundingClientRect();
      return { document: de.scrollHeight, window: window.innerHeight, scrollable: de.scrollHeight > window.innerHeight, inputTop: box?.top ?? null, inputBottom: box?.bottom ?? null, hasInput: !!input };
    });
    expect(read.hasInput, 'the sidebar has a message box').toBe(true);
    expect(read.document, 'the document is not taller than the window').toBeLessThanOrEqual(read.window);
    expect(read.scrollable, 'the page does not scroll').toBe(false);
    expect(read.inputTop, 'the message box starts on the screen').toBeGreaterThanOrEqual(0);
    expect(read.inputBottom, 'and ends on it').toBeLessThanOrEqual(read.window);
  });
}

test('on a phone the room adds no height of its own: the lobby is the window, not 96px more', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createDemoPartyRoom(page);
  await page.waitForTimeout(600);
  const read = await page.evaluate(() => ({ document: document.documentElement.scrollHeight, window: window.innerHeight }));
  // Its content may be taller than the screen (a phone's header wraps); the shell must not be the reason.
  expect(read.document, 'the lobby fits the phone screen').toBeLessThanOrEqual(read.window + 1);
});

test('a tall activity scrolls inside the room, and the chat stays on the screen', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await createDemoPartyRoom(page);
  await page.locator('button[aria-label="Switch game activity"]').click();
  await page.locator('button[aria-label="Select Team Maker"]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.waitForTimeout(600);
  const read = await page.evaluate(() => {
    const de = document.documentElement;
    const input = document.querySelector<HTMLElement>('input[aria-label="Type a message"]');
    const box = input?.getBoundingClientRect();
    return { pageScrolls: de.scrollHeight > window.innerHeight, inputBottom: box?.bottom ?? null, window: window.innerHeight };
  });
  expect(read.pageScrolls, 'the page does not scroll, even in a short window with a tall activity').toBe(false);
  expect(read.inputBottom, 'the message box is on the screen').toBeLessThanOrEqual(read.window);
});

test('an empty chat says so, and the line goes away with the first message', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await createDemoPartyRoom(page);
  const empty = page.getByText('No messages yet. Say hello!');
  await expect(empty).toBeVisible();
  const input = page.getByPlaceholder('Type a message...');
  await input.fill('hello from the host');
  await input.press('Enter');
  await expect(page.getByText('hello from the host')).toBeVisible();
  await expect(empty).toHaveCount(0);
});

test('a classroom room is the window too', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.goto('/create?type=classroom');
  await hideConfigBanner(page);
  await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 30000 });
  await page.click('[data-testid="create-room-button-client"]');
  await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45000 });
  await hideConfigBanner(page);
  await expect(page.locator('input[aria-label="Type a message"]')).toBeVisible({ timeout: 30000 });
  const read = await page.evaluate(() => {
    const box = document.querySelector<HTMLElement>('input[aria-label="Type a message"]')!.getBoundingClientRect();
    return { document: document.documentElement.scrollHeight, window: window.innerHeight, inputBottom: box.bottom };
  });
  expect(read.document).toBeLessThanOrEqual(read.window);
  expect(read.inputBottom).toBeLessThanOrEqual(read.window);
});

test('a landscape phone (wide enough for md, too short for a fixed box) keeps the page scroll, and the chat is reachable', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await createDemoPartyRoom(page);
  const input = page.locator('input[aria-label="Type a message"]');
  await expect(input).toBeAttached();
  const overflow = await page.evaluate(() => {
    const shell = document.querySelector('main > div');
    return shell ? getComputedStyle(shell).overflow : null;
  });
  expect(overflow, 'the room is not a clipped fixed box on a short screen').not.toBe('hidden');
  await input.scrollIntoViewIfNeeded();
  await expect(input).toBeInViewport();
});
