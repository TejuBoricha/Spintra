import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { hideConfigBanner } from './helpers/config-banner';
import { skipInDbIntegration } from './helpers/ci-skip';

skipInDbIntegration(test);

// UX audit (7 Oct 2026), wave 5 (minor findings), first batch:
//   U-30  the navbar's icon buttons are 44px below 1024px (they were 40px)
//   U-31  the navbar's labels are sentence case at 14px, not 12px capitals with wide tracking
//   U-34  full-height boxes use the small viewport (min-h-svh), not 100vh (min-h-screen)
//   U-36  the Tournament tool spells out its formats and templates ("Single elimination", "8 players")
//   U-38  the phone menu has one primary action: "Create a room"; "Join a room" is the secondary
//   U-39  the name boxes' placeholders are short; the examples are in the helper text beside them

async function open(page: import('@playwright/test').Page, url: string) {
  await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
  await page.goto(url);
  await page.waitForLoadState('load');
  await hideConfigBanner(page);
  await page.waitForTimeout(500); // the navbar's entrance and hydration
}

for (const width of [390, 768]) {
  test(`U-30: the navbar's icon buttons are at least 44px at ${width}px wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page, '/');
    const nav = page.locator('nav').first();
    const controls = [
      nav.getByRole('button', { name: 'Open menu' }),
      nav.getByRole('button', { name: /^Switch to (light|dark) theme$/ }),
      nav.getByRole('link', { name: /^Spintra/ }).first(),
    ];
    // "What's new" and Settings join the bar from the sm breakpoint
    if (width >= 640) controls.push(nav.locator('button[aria-label^="What"]').first(), nav.getByRole('link', { name: 'Settings', exact: true }));
    const small: string[] = [];
    for (const control of controls) {
      await expect(control).toBeVisible();
      const box = (await control.boundingBox())!;
      if (box.width < 43.5 || box.height < 43.5) small.push(`${await control.getAttribute('aria-label') ?? (await control.textContent())?.trim()}: ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
    expect(small, 'every icon control is a 44px target').toEqual([]);
  });
}

test('U-31: the desktop navbar labels are sentence case, 14px, with normal letter spacing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, '/');
  const nav = page.locator('nav').first();
  const labels = [
    nav.getByRole('link', { name: 'Explore', exact: true }),
    nav.getByRole('link', { name: 'Tools', exact: true }),
    nav.getByRole('button', { name: 'Join a room', exact: true }),
    nav.getByRole('link', { name: 'Create a room', exact: true }),
  ];
  for (const label of labels) {
    const style = await label.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { transform: cs.textTransform, size: parseFloat(cs.fontSize), tracking: cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) };
    });
    expect(style.transform, 'no capitals').toBe('none');
    expect(style.size, 'font size').toBeGreaterThanOrEqual(14);
    expect(style.tracking, 'letter spacing (px)').toBeLessThanOrEqual(0.5);
  }
});

test('U-38: the phone menu has one primary action, Create a room, and Join a room is the secondary', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const create = page.getByRole('link', { name: 'Create a room', exact: true }).first();
  const join = page.getByRole('button', { name: 'Join a room', exact: true });
  await expect(create).toBeVisible();
  await expect(join).toBeVisible();
  const look = (l: import('@playwright/test').Locator) => l.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { image: cs.backgroundImage, color: cs.backgroundColor };
  });
  const primary = await look(create);
  const secondary = await look(join);
  expect(primary.image, 'the primary is the brand gradient').not.toBe('none');
  expect(secondary.image, 'the secondary has no gradient').toBe('none');
  const [createBox, joinBox] = [(await create.boundingBox())!, (await join.boundingBox())!];
  expect(createBox.y, 'the primary action comes first').toBeLessThan(joinBox.y);
});

test('U-36: the Tournament tool spells out its formats and templates', async ({ page }) => {
  await open(page, '/tools/tournament');
  for (const name of ['Single elimination', 'Double elimination', 'Round robin', 'Swiss']) {
    await expect(page.getByRole('radio', { name, exact: true }), `format "${name}"`).toBeVisible();
  }
  const templates = page.getByRole('heading', { name: 'Templates', exact: true }).locator('xpath=..').getByRole('button');
  const texts = (await templates.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  expect(texts.length, 'the template buttons').toBe(5);
  for (const text of texts) {
    expect(text, 'no abbreviation (Rr, Elim, 8p)').not.toMatch(/\bRr\b|\bElim\b|\b\d+p\b|^\d+-/i);
    expect(text, 'it says what and how many').toMatch(/\b\d+ (players|teams)\b/);
  }
  await templates.first().click();
  await expect(page.getByText('Single elimination template loaded!')).toBeVisible();
});

test.describe('U-39: the name boxes show a short placeholder, with the examples in the text beside them', () => {
  for (const [url, box] of [
    ['/tools/name-draw', /paste names/i],
    ['/tools/team-maker', /enter names/i],
    ['/tools/tournament', /enter participant names/i],
  ] as const) {
    test(url, async ({ page }) => {
      await open(page, url);
      const field = page.getByPlaceholder(box);
      await expect(field).toBeVisible();
      const placeholder = (await field.getAttribute('placeholder'))!;
      expect(placeholder, 'one line, no sample entries').not.toMatch(/\n/);
      expect(placeholder.length, 'short').toBeLessThanOrEqual(60);
      await expect(page.getByText(/for example (Alice, Bob|Alex, Jordan|Alpha, Bravo)/).first(), 'the examples are helper text').toBeVisible();
    });
  }
});

test('U-34: no full-height box is 100vh (min-h-screen); the small viewport is used', () => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(tsx|ts|css)$/.test(e.name) && /\bmin-h-screen\b|\bh-screen\b/.test(fs.readFileSync(full, 'utf8'))) found.push(path.relative(path.join(__dirname, '..'), full));
    }
  };
  walk(path.join(__dirname, '..', 'src'));
  expect(found, '100vh is taller than a phone shows while its address bar is visible: use min-h-svh').toEqual([]);
});
