import { test, expect } from '@playwright/test';
import { hideConfigBanner } from './helpers/config-banner';

// UX audit (7 Oct 2026), finding U-22: Terms and Privacy ran 91 to 107 characters per line (60 to 75 is comfortable) and listed
// their numbered sections nowhere, so a person who came for one answer ("what do you store?"), or a school pointing a parent at
// one part, had to scroll. The column is `max-w-prose` now and a contents list links every section by an anchor.

for (const path of ['/legal/terms', '/legal/privacy']) {
  test.describe(path, () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('no line of text is longer than 80 characters', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
      await page.goto(path);
      await page.waitForLoadState('load');
      await hideConfigBanner(page);
      const longest = await page.evaluate(() => {
        let worst = { chars: 0, text: '' };
        for (const el of document.querySelectorAll('main p, main li')) {
          if (el.querySelector('p, li, div')) continue;
          // Each word's line (its top), then the longest line's length in characters, spaces included.
          const lines = new Map<number, string[]>();
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const re = /\S+/g;
            for (let m = re.exec(node.textContent || ''); m; m = re.exec(node.textContent || '')) {
              const range = document.createRange();
              range.setStart(node, m.index);
              range.setEnd(node, m.index + m[0].length);
              const rects = range.getClientRects();
              if (!rects.length) continue;
              const top = Math.round(rects[0].top);
              const key = [...lines.keys()].find((k) => Math.abs(k - top) <= 3) ?? top;
              lines.set(key, [...(lines.get(key) ?? []), m[0]]);
            }
          }
          if (lines.size < 2) continue; // a short paragraph is one line and says nothing about the measure
          for (const words of lines.values()) {
            const chars = words.join(' ').length;
            if (chars > worst.chars) worst = { chars, text: words.join(' ').slice(0, 60) };
          }
        }
        return worst;
      });
      expect(longest.chars, `the longest line is ${longest.chars} characters: "${longest.text}..."`).toBeLessThanOrEqual(80);
    });

    test('a contents list links every section, and a link brings its heading into view below the navbar', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
      await page.goto(path);
      await page.waitForLoadState('load');
      await hideConfigBanner(page);

      const contents = page.getByRole('navigation', { name: 'Contents' });
      await expect(contents).toBeVisible();
      const links = contents.getByRole('link');
      const headings = page.locator('main section > h2');
      const count = await headings.count();
      expect(count).toBeGreaterThanOrEqual(8);
      await expect(links).toHaveCount(count);

      for (let i = 0; i < count; i++) {
        const heading = headings.nth(i);
        const id = await heading.evaluate((el) => el.parentElement!.id);
        expect(id, `section ${i + 1} has an anchor`).not.toBe('');
        await expect(links.nth(i), `link ${i + 1} points at its section`).toHaveAttribute('href', `#${id}`);
        expect((await links.nth(i).innerText()).trim(), 'the link says what the heading says').toBe((await heading.innerText()).trim());
      }

      const last = headings.nth(count - 1);
      await links.nth(count - 1).click();
      await expect(page).toHaveURL(new RegExp(`#${await last.evaluate((el) => el.parentElement!.id)}$`));
      await expect(last).toBeInViewport();
      const top = (await last.boundingBox())!.y;
      expect(top, 'the heading is not under the fixed navbar (80px tall)').toBeGreaterThanOrEqual(80);
    });
  });
}
