import { test, expect, type Page } from '@playwright/test';
import { SITE_PAGES } from './site-routes';
import { hideConfigBanner } from './helpers/config-banner';
import { skipInDbIntegration } from './helpers/ci-skip';

skipInDbIntegration(test);

// UX audit (7 Oct 2026), finding U-23: the same action had several names. Starting a room was "HOST", "HOST GAME", "Create Room"
// and "Create a Multiplayer Room" in different places; the live-room list was "LIVE ROOMS", "Live Rooms" and "Explore Games";
// the tools hub was "TOOLS", "Quick Tools" and "Browse tools". Each action now has one name, in sentence case (the navbar sets
// it in capitals with CSS, which an assistive technology does not read), wherever it appears:
//   /create  -> "Create a room"       (a teacher's page says "Create a classroom": a different audience, one name on that page)
//   /explore -> "Explore"
//   /tools   -> "Tools"
//   the code dialog -> "Join a room" (opens it) and "Join" (sends the code).

const NAMES: Record<string, string[]> = {
  '/create': ['Create a room', 'Create a classroom'],
  '/explore': ['Explore'],
  '/tools': ['Tools'],
};

// What the first four were called before: none may come back as a link or button, in any case.
const RETIRED = /^(host|host game|create room|create a multiplayer room|live rooms|quick tools|explore games|join room|enter game)$/i;

async function visibleActions(page: Page) {
  return page.evaluate(() => {
    const out: { tag: string; href: string; name: string }[] = [];
    for (const el of Array.from(document.querySelectorAll('a[href], button'))) {
      // The error cards are next steps in a sentence of their own ("Browse tools" after a missing page): left to U-18.
      // Anything hidden from assistive technology (the Create page's test hook) is not a name a visitor meets.
      if (el.closest('[data-error-state], [aria-hidden="true"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const name = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
      out.push({ tag: el.tagName.toLowerCase(), href: el.getAttribute('href') ?? '', name });
    }
    return out;
  });
}

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test.describe(`${width}px wide`, () => {
    test.use({ viewport: { width, height } });
    for (const path of SITE_PAGES) {
      test(`${path}: one name for each action`, async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
        await page.goto(path);
        await page.waitForLoadState('load');
        await hideConfigBanner(page);
        if (width < 768) {
          // On a phone the navbar's actions are in the menu.
          await page.getByRole('button', { name: 'Open menu' }).click();
          await expect(page.getByRole('button', { name: 'Join a room', exact: true })).toBeVisible();
        }
        const actions = await visibleActions(page);
        expect(actions.length, 'measured the page').toBeGreaterThan(3);

        const wrong: string[] = [];
        for (const a of actions) {
          // A link to the page itself, not to one of its modes: /create?type=party is the card "Party Mode", not the action.
          const allowed = NAMES[a.href];
          if (a.tag === 'a' && allowed && !allowed.includes(a.name)) wrong.push(`link ${a.href} is "${a.name}", expected ${allowed.map((n) => `"${n}"`).join(' or ')}`);
          if (RETIRED.test(a.name)) wrong.push(`${a.tag} "${a.name}" is a retired name`);
        }
        expect(wrong, `${path} at ${width}px`).toEqual([]);
      });
    }
  });
}

test('the navbar names the same four actions on a wide screen and in the phone menu', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await hideConfigBanner(page);
  const nav = page.getByRole('navigation').first();
  const wide = {
    explore: await nav.getByRole('link', { name: 'Explore', exact: true }).count(),
    tools: await nav.getByRole('link', { name: 'Tools', exact: true }).count(),
    create: await nav.getByRole('link', { name: 'Create a room', exact: true }).count(),
    join: await nav.getByRole('button', { name: 'Join a room', exact: true }).count(),
  };
  expect(wide).toEqual({ explore: 1, tools: 1, create: 1, join: 1 });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await hideConfigBanner(page);
  await page.getByRole('button', { name: 'Open menu' }).click();
  for (const [role, name] of [['link', 'Explore'], ['link', 'Tools'], ['link', 'Create a room'], ['button', 'Join a room']] as const) {
    await expect(page.getByRole(role, { name, exact: true }).first(), `${name} in the phone menu`).toBeVisible();
  }
});

test('the code dialog is "Join a room" and its button "Join"', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await hideConfigBanner(page);
  await page.getByRole('button', { name: 'Join a room', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Join a room' })).toBeVisible();
  // The arrow after the word is decoration, hidden from assistive technology.
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Join', exact: true })).toBeVisible();
});
