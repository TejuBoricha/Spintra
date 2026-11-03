import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';
import { SITE_PAGES } from './site-routes';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), finding U-11: iOS Safari zooms the page into any text field whose font is under 16px when it is tapped, and
// leaves it zoomed. Every field was 14px (`text-sm` in the shared Input and Textarea). The shared components now use `text-base`
// (16px) on a phone and `md:text-sm` (14px) from 768px up, which changes nothing on a desktop. This reads the computed font size of
// every field a person can tap, on every page at phone width, so a new page-level field cannot bring the zoom back.

const FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]):not([type=submit]):not([type=button]):not([type=file]):not([type=color]), textarea, select';

async function smallFields(page: Page) {
  return page.evaluate((selector) => {
    const found: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 1 || r.height < 1 || cs.display === 'none' || cs.visibility === 'hidden') continue;
      const size = parseFloat(cs.fontSize);
      if (size < 16) {
        const name = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.id || el.tagName.toLowerCase();
        found.push(`${el.tagName.toLowerCase()} "${name}" is ${size}px`);
      }
    }
    return found;
  }, FIELD);
}

test.describe('every text field is at least 16px on a phone (so iOS does not zoom into it)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const path of SITE_PAGES) {
    test(`${path}`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
      await page.goto(path);
      await page.waitForLoadState('load');
      await hideConfigBanner(page);
      await page.waitForTimeout(400); // hydration: client-rendered fields
      expect(await smallFields(page)).toEqual([]);
    });
  }

  test('the Join dialog\'s code boxes', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
    await page.goto('/');
    await hideConfigBanner(page);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Open menu' }).click(); // on a phone the navbar's JOIN is in the menu
    await page.getByRole('button', { name: /^join/i }).first().click();
    await expect(page.getByRole('dialog', { name: 'Join Room' })).toBeVisible();
    expect(await smallFields(page)).toEqual([]);
  });

  test('the fields that appear after the visitor acts (Lucky Wheel rename, Team Maker player, Tournament seeds)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
    await page.goto('/tools/lucky-wheel');
    await hideConfigBanner(page);
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^Rename Prize 1/ }).evaluate((el) => (el as HTMLElement).click());
    expect(await smallFields(page), 'Lucky Wheel with a rename field open').toEqual([]);

    await page.goto('/tools/team-maker');
    await page.waitForTimeout(400);
    await page.locator('textarea').first().fill('Alex\nJordan\nTaylor\nMorgan');
    await page.getByRole('button', { name: /Generate Teams/ }).evaluate((el) => (el as HTMLElement).click());
    await expect(page.getByLabel('Add a player to Team 1').filter({ visible: true })).toBeVisible();
    expect(await smallFields(page), 'Team Maker with teams').toEqual([]);
  });
});

// The pages above are the ones a visitor reaches without a room; the room's fields (the sidebar's username box, a wheel entry, the
// trivia selects, a city trade's cash field) need a room, or an action first, so two more checks cover them: a read of every field
// in the source, and a scan of a party room's lobby and the first screen of each activity.

const FIELD_TAGS = new Set(['input', 'Input', 'textarea', 'Textarea', 'select']);
const SIZE_CLASS = /(?<![\w:-])text-(xs|sm|base|lg|xl|\d+xl|\[[^\]]+\])(?![\w-])/g;

/** The font size in px a class asks for with no breakpoint in front of it, or null if it is not a size. */
function pxOf(size: string): number | null {
  const named: Record<string, number> = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20 };
  if (size in named) return named[size];
  const big = /^(\d+)xl$/.exec(size);
  if (big) return 24;
  const arbitrary = /^\[([\d.]+)(px|rem|em)\]$/.exec(size);
  if (arbitrary) return parseFloat(arbitrary[1]) * (arbitrary[2] === 'px' ? 1 : 16);
  return null; // text-[length:var(--x)], text-[color:...]: not a size we can read, and not one the site uses
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? sourceFiles(full) : full.endsWith('.tsx') ? [full] : [];
  });
}

test('no field in the source asks for a font under 16px below the md breakpoint', () => {
  const found: string[] = [];
  for (const file of sourceFiles(path.join(__dirname, '..', 'src'))) {
    const source = fs.readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && FIELD_TAGS.has(node.tagName.getText())) {
        const className = node.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === 'className') as ts.JsxAttribute | undefined;
        const text = className?.initializer?.getText() ?? '';
        for (const match of text.matchAll(SIZE_CLASS)) {
          const px = pxOf(match[1]);
          if (px !== null && px < 16) {
            const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            found.push(`${path.relative(path.join(__dirname, '..'), file)}:${line} <${node.tagName.getText()}> text-${match[1]}`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  expect(found, 'a field under 16px is zoomed into by iOS; use `text-base md:text-sm` (or `md:text-xs`)').toEqual([]);
});

test.describe('a party room', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('every field in the lobby and on the first screen of each activity is at least 16px', async ({ page }) => {
    test.setTimeout(180_000);
    await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
    await page.goto('/create?type=party');
    await hideConfigBanner(page);
    await page.waitForSelector('[data-testid="create-room-button-client"]', { timeout: 30000 });
    await page.click('[data-testid="create-room-button-client"]');
    await page.waitForURL(/\/room\/[A-Z0-9]+/, { timeout: 45000 });
    await hideConfigBanner(page);
    await page.waitForTimeout(1500);

    const problems: Record<string, string[]> = {};
    const check = async (state: string) => {
      const small = await smallFields(page);
      if (small.length) problems[state] = small;
    };
    const switchGame = page.locator('button[aria-label="Switch game activity"]');
    await check('lobby');
    await switchGame.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const names = await page.locator('button[aria-label^="Select "]').evaluateAll((els) => els.map((el) => (el.getAttribute('aria-label') ?? '').replace('Select ', '')));
    expect(names.length, 'the picker lists the activities').toBeGreaterThanOrEqual(10);
    for (const name of names) {
      if (!(await page.locator(`button[aria-label="Select ${name}"]`).count())) await switchGame.click();
      await page.locator(`button[aria-label="Select ${name}"]`).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.waitForTimeout(800);
      await check(name);
      await switchGame.click();
    }
    expect(problems).toEqual({});
  });
});
