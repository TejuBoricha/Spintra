import { test, expect, type Page } from '@playwright/test';

// Audit T-5 and T-6 on the Name Draw tool.
// T-5: the draw history was stored as positions in the list, so editing the list
//      (adding a name at the top, deleting one) made the history show different
//      people and changed who counted as already drawn. It now stores the names.
// T-6: at phone width the Reset, Share and Mute buttons were pushed off the right
//      edge of the screen and could not be reached.

const NAMES_PLACEHOLDER = /Paste names, one per line/;

async function draw(page: Page, alreadyDrawn: number) {
  await page.getByRole('button', { name: /^draw one$/i }).click();
  await expect(page.getByText(new RegExp(`^Drawn \\(${alreadyDrawn + 1}\\)$`))).toBeVisible({ timeout: 8000 });
}

/** The names in the history, oldest first. */
async function history(page: Page): Promise<string[]> {
  const rows = page.locator('span.font-mono', { hasText: /^#\d+$/ });
  const n = await rows.count();
  const out: { n: number; name: string }[] = [];
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    const num = Number((await row.innerText()).replace('#', ''));
    const name = await row.locator('xpath=following-sibling::span[1]').innerText();
    out.push({ n: num, name });
  }
  return out.sort((a, b) => a.n - b.n).map((r) => r.name);
}

test('editing the list after a draw does not change who the history says was drawn, or who can be drawn again', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/tools/name-draw', { waitUntil: 'networkidle' });
  await page.getByPlaceholder(NAMES_PLACEHOLDER).fill('Ann\nBo\nCy\nDi');

  await draw(page, 0);
  const [first] = await history(page);
  expect(['Ann', 'Bo', 'Cy', 'Di']).toContain(first);

  // Add a name at the top: every later line moves down one place.
  await page.getByPlaceholder(NAMES_PLACEHOLDER).fill('Zed\nAnn\nBo\nCy\nDi');
  expect(await history(page)).toEqual([first]);

  // Everyone else can still be drawn, and the person already drawn cannot be drawn again.
  for (let i = 1; i <= 4; i++) await draw(page, i);
  const all = await history(page);
  expect(all[0]).toBe(first);
  expect([...all].sort()).toEqual(['Ann', 'Bo', 'Cy', 'Di', 'Zed']);
});

test('two people with the same name are drawn one at a time', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/tools/name-draw', { waitUntil: 'networkidle' });
  await page.getByPlaceholder(NAMES_PLACEHOLDER).fill('Sam\nSam\nPat');
  for (let i = 0; i < 3; i++) await draw(page, i);
  expect([...(await history(page))].sort()).toEqual(['Pat', 'Sam', 'Sam']);
});

test('at phone width every draw button is on screen and the page does not scroll sideways', async ({ browser }) => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto('/tools/name-draw', { waitUntil: 'networkidle' });

  for (const name of [/^draw one$/i, /^draw \d+$/i, /reset draw history/i, /share results/i, /sound effects/i]) {
    const box = await page.getByRole('button', { name }).first().boundingBox();
    expect(box, `button ${String(name)} has a box`).not.toBeNull();
    expect(box!.x, `${String(name)} starts on screen`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${String(name)} ends on screen`).toBeLessThanOrEqual(390 + 0.5);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
