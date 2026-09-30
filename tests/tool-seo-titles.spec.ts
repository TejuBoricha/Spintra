import { test, expect } from '@playwright/test';
import { TOOL_SEO_TITLES, toolMetadata } from '../src/lib/tool-metadata';
import { GAMES } from '../src/lib/games';

// Audit X-5: every tool page's <title> was just "<Label> | Spintra" (for example
// "Name Draw | Spintra"), with none of the words people search for. Each tool now
// leads with its search term. The titles are checked as data (every tool has one,
// they are distinct, short enough to show in results, and what the page metadata
// actually returns), so a new tool cannot quietly fall back to the bare label.

const toolGames = GAMES.filter((g) => g.href.startsWith('/tools/'));

test('every tool page has its own search-friendly title, distinct and short enough to show in results', () => {
  expect(toolGames.length).toBeGreaterThanOrEqual(14);
  const seen = new Set<string>();
  for (const g of toolGames) {
    const title = TOOL_SEO_TITLES[g.href];
    expect(title, `no SEO title for ${g.href}`).toBeTruthy();
    expect(title.endsWith(' | Spintra'), `${g.href}: ends with the site name`).toBe(true);
    expect(title.length, `${g.href}: "${title}" is ${title.length} characters`).toBeLessThanOrEqual(62);
    expect(title, `${g.href}: not just the tool's own label`).not.toBe(`${g.label} | Spintra`);
    expect(seen.has(title), `${g.href}: duplicate title`).toBe(false);
    seen.add(title);
  }
});

test('the page metadata uses those titles for the page and its social preview', () => {
  for (const g of toolGames) {
    const meta = toolMetadata(g.href);
    expect(meta.title).toBe(TOOL_SEO_TITLES[g.href]);
    expect((meta.openGraph as { title?: string }).title).toBe(TOOL_SEO_TITLES[g.href]);
  }
});

test('the titles carry the words people search for', () => {
  const must: Record<string, RegExp> = {
    '/tools/name-draw': /random name picker/i,
    '/tools/team-maker': /team generator/i,
    '/tools/lucky-wheel': /wheel spinner/i,
    '/tools/tournament': /bracket generator/i,
    '/tools/coin-flip': /coin flip/i,
    '/tools/dice': /dice roller/i,
  };
  for (const [href, re] of Object.entries(must)) expect(TOOL_SEO_TITLES[href], href).toMatch(re);
});
