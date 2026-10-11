import type { Page } from '@playwright/test';

// Measures what a keyboard user sees: for every Tab stop, a small screenshot with the element focused and
// the same spot with nothing focused (the element blurred, so a neighbour's ring cannot land in the picture),
// and the WCAG contrast between the ring (the pixel that changed the most) and what was behind it. Pixels, not computed styles, so it is true however a component draws focus
// (an outline, a ring, a border, a fill). The pictures are decoded in a blank page: the app's own pages have a
// Content-Security-Policy, and a blank page has none.

export type RingProblem = { stop: number; what: string; why: string };

const PAD = 8;

/**
 * Waits until every finite, time-driven animation has run to the end (cards that fade in as they scroll into
 * view would otherwise be photographed half transparent). Looping animations and scroll-linked ones never end,
 * so they are not waited for. Returns at once when nothing is animating.
 */
async function settle(page: Page) {
  await page
    .waitForFunction(
      () => document.getAnimations().every((a) => a.timeline !== document.timeline || a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
      undefined,
      { timeout: 3000 },
    )
    .catch(() => {});
}

/** Opens a blank page to decode screenshots in. Close it when done. */
export async function newDecoder(page: Page): Promise<Page> {
  const helper = await page.context().newPage();
  await helper.goto('about:blank');
  return helper;
}

async function ringBetween(decoder: Page, focused: Buffer, base: Buffer, minRatio: number) {
  return decoder.evaluate(
    async ([a, b, need]) => {
      const load = async (b64: string) => {
        const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
        const bmp = await createImageBitmap(blob);
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = c.getContext('2d')!;
        ctx.drawImage(bmp, 0, 0);
        return ctx.getImageData(0, 0, bmp.width, bmp.height);
      };
      const A = await load(a);
      const B = await load(b);
      if (A.width !== B.width || A.height !== B.height) return null;
      const lum = (r: number, g: number, bl: number) => {
        const f = (c: number) => {
          c /= 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(bl);
      };
      const ratioOf = (i: number) => {
        const l1 = lum(A.data[i], A.data[i + 1], A.data[i + 2]);
        const l2 = lum(B.data[i], B.data[i + 1], B.data[i + 2]);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };
      let changed = 0;
      let strong = 0;
      let best = 1;
      for (let i = 0; i < A.data.length; i += 4) {
        const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
        if (d <= 36) continue;
        changed++;
        const r = ratioOf(i);
        if (r > best) best = r;
        if (r >= need) strong++;
      }
      return { changed, strong, ratio: Math.round(best * 100) / 100 };
    },
    [focused.toString('base64'), base.toString('base64'), minRatio] as [string, string, number],
  );
}

/**
 * The "Skip to content" link only exists while it is focused (it is visually hidden otherwise), so there is no
 * unfocused picture to compare it with. Its indicator is read from its computed outline instead: an outline at
 * least 2px wide whose colour passes `minRatio` : 1 against the page behind it.
 */
export async function outlineProblem(handle: Awaited<ReturnType<Page['evaluateHandle']>>, minRatio: number): Promise<string | null> {
  const measured = await handle.evaluate(
    (el: unknown) => {
      const element = el as HTMLElement;
      const cs = getComputedStyle(element);
      const toRgb = (css: string) => {
        const c = new OffscreenCanvas(1, 1).getContext('2d')!;
        c.fillStyle = css;
        c.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = c.getImageData(0, 0, 1, 1).data;
        return { r, g, b, a };
      };
      // What is behind the element: every translucent layer on the way up, laid over each other from the page down
      // (starting from white, the browser's own canvas), not just the nearest one.
      const layers: { r: number; g: number; b: number; a: number }[] = [];
      for (let node: HTMLElement | null = element.parentElement; node; node = node.parentElement) {
        const bg = toRgb(getComputedStyle(node).backgroundColor);
        if (bg.a > 0) layers.push(bg);
        if (bg.a === 255) break;
      }
      const behind = layers.reverse().reduce(
        (under, layer) => {
          const a = layer.a / 255;
          return { r: layer.r * a + under.r * (1 - a), g: layer.g * a + under.g * (1 - a), b: layer.b * a + under.b * (1 - a), a: 255 };
        },
        { r: 255, g: 255, b: 255, a: 255 },
      );
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) || 0, ring: toRgb(cs.outlineColor), behind };
    },
  );
  if (measured.style === 'none' || measured.width < 2) return 'no visible focus indicator';
  const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
    const f = (c: number) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const [hi, lo] = [lum(measured.ring), lum(measured.behind)].sort((x, y) => y - x);
  const ratio = Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  return ratio >= minRatio ? null : `focus ring is ${ratio} : 1 at best (needs ${minRatio} : 1)`;
}

const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const f = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

/**
 * The skip link again, on pixels: it floats over the fixed, translucent navbar, so no chain of background colours
 * says what is behind it. The outline's colour is read from its computed style (it is the one thing a picture
 * cannot separate from the link's own fill) and set against the page as photographed, a few pixels outside the
 * outline, at the middle of each side. The weakest side counts.
 */
async function outlinePixelProblem(page: Page, decoder: Page, handle: Awaited<ReturnType<Page['evaluateHandle']>>, minRatio: number): Promise<string | null> {
  const info = await handle.evaluate((el: unknown) => {
    const element = el as HTMLElement;
    const cs = getComputedStyle(element);
    const canvas = new OffscreenCanvas(1, 1).getContext('2d')!;
    canvas.fillStyle = cs.outlineColor;
    canvas.fillRect(0, 0, 1, 1);
    const [r, g, b] = canvas.getImageData(0, 0, 1, 1).data;
    const box = element.getBoundingClientRect();
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) || 0, offset: parseFloat(cs.outlineOffset) || 0, ring: { r, g, b }, box: { x: box.x, y: box.y, w: box.width, h: box.height } };
  });
  if (info.style === 'none' || info.width < 2) return 'no visible focus indicator';
  const { box } = info;
  const gap = info.offset + info.width + 3;
  const clip = { x: Math.max(0, Math.floor(box.x - gap - 2)), y: Math.max(0, Math.floor(box.y - gap - 2)), width: Math.ceil(box.w + gap * 2 + 4), height: Math.ceil(box.h + gap * 2 + 4) };
  const shot = await page.screenshot({ clip });
  const points = [
    [box.x + box.w / 2, box.y - gap],
    [box.x + box.w / 2, box.y + box.h + gap],
    [box.x - gap, box.y + box.h / 2],
    [box.x + box.w + gap, box.y + box.h / 2],
  ]
    .map(([x, y]) => [Math.round(x - clip.x), Math.round(y - clip.y)])
    .filter(([x, y]) => x >= 0 && y >= 0 && x < clip.width && y < clip.height);
  if (!points.length) return null;
  const samples = await decoder.evaluate(
    async ([b64, pts]) => {
      const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
      const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d')!;
      ctx.drawImage(bmp, 0, 0);
      return (pts as number[][]).map(([x, y]) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3)));
    },
    [shot.toString('base64'), points] as [string, number[][]],
  );
  const ratios = samples.map(([r, g, b]) => {
    const [hi, lo] = [luminance(info.ring), luminance({ r, g, b })].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  });
  const weakest = Math.round(Math.min(...ratios) * 100) / 100;
  return weakest >= minRatio ? null : `focus ring is ${weakest} : 1 at best (needs ${minRatio} : 1)`;
}

/**
 * Presses Tab up to `maxStops` times from the top of the page and returns every stop whose focus indicator is
 * missing or weaker than `minRatio` : 1. The page should be in reduced-motion mode so nothing moves under the
 * pictures. Each stop is judged on the spot, so the last one counts too.
 */
export async function focusRingProblems(page: Page, decoder: Page, maxStops = 45, minRatio = 3): Promise<{ stops: number; measured: number; unmeasured: string[]; problems: RingProblem[] }> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement | null)?.blur();
  });
  const problems: RingProblem[] = [];
  const unmeasured: string[] = [];
  let stops = 0;
  let measured = 0;
  let firstLabel = '';

  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press('Tab');
    await settle(page);
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) return null;
      const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('title') || '').toString().trim().replace(/\s+/g, ' ').slice(0, 40);
      return { label: `${el.tagName.toLowerCase()}${name ? ` "${name}"` : ''}` };
    });
    if (!info) break; // focus left the page
    if (i === 0) firstLabel = info.label;
    else if (info.label === firstLabel && i > 3) break; // wrapped round to the first stop
    stops++;
    const handle = await page.evaluateHandle(() => document.activeElement);
    if (/skip to content/i.test(info.label)) {
      measured++;
      const why = await outlinePixelProblem(page, decoder, handle, minRatio);
      if (why) problems.push({ stop: i, what: info.label, why });
      continue;
    }
    const box = await handle.asElement()?.boundingBox();
    if (!box || box.width < 1 || box.height < 1) {
      unmeasured.push(`${info.label} (no box)`);
      continue;
    }
    const x = Math.max(0, Math.floor(box.x - PAD));
    const y = Math.max(0, Math.floor(box.y - PAD));
    const width = Math.min(viewport.width - x, Math.ceil(box.width + PAD * 2));
    const height = Math.min(viewport.height - y, Math.ceil(box.height + PAD * 2));
    if (width < 6 || height < 6 || width * height > 900 * 500) {
      unmeasured.push(`${info.label} (${width < 6 || height < 6 ? 'too small' : 'too large'} for a picture)`);
      continue;
    }
    const clip = { x, y, width, height };
    const shot = await page.screenshot({ clip });
    // Take focus off this element (and off every other), so the second picture has no ring in it at all;
    // then put it back so the next Tab continues from here.
    await handle.evaluate((el) => (el as HTMLElement).blur());
    await settle(page);
    const now = await handle.asElement()?.boundingBox();
    // The element moved (the page scrolled, or it slides on focus): there is no like-for-like picture to compare.
    if (!now || Math.abs(now.x - box.x) > 1.5 || Math.abs(now.y - box.y) > 1.5 || Math.abs(now.width - box.width) > 1.5) {
      unmeasured.push(`${info.label} (moved on blur)`);
    } else {
      measured++;
      const base = await page.screenshot({ clip });
      const diff = await ringBetween(decoder, shot, base, minRatio);
      if (diff) {
        if (diff.changed < 8) problems.push({ stop: i, what: info.label, why: 'no visible focus indicator' });
        else if (diff.strong < 8) problems.push({ stop: i, what: info.label, why: `focus ring is ${diff.ratio} : 1 at best (needs ${minRatio} : 1)` });
      }
    }
    await handle.evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
  }
  return { stops, measured, unmeasured, problems };
}
