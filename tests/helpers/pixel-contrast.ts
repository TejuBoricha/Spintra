import type { Page } from '@playwright/test';

// Measures the text contrast a visitor actually sees, from pixels, not from CSS: the page is photographed twice, once
// as it is and once with every glyph made transparent, and inside the box of each piece of text the two pictures are
// compared. A pixel that differs is text; its contrast is the WCAG ratio between that pixel and the same pixel of the
// text-less picture (what is really behind it: a fill, a gradient, a translucent layer, another element). That holds
// however the colour is made (palette shade, opacity, a parent's opacity), which a computed style does not.
// The pictures are decoded in a blank page: the app's pages have a Content-Security-Policy, a blank page has none.
//
// Three cases need more than the plain comparison, and each is covered by tests/ux-contrast-calibration.spec.ts:
//  - text with no pixel of its own (its colour IS its background: nothing differs between the pictures) is invisible, and
//    must not pass for want of a measurement: when the background is flat it is judged from the computed colours;
//  - one or two characters have few fully covered pixels, so the pixel estimate can read low: on a flat background they
//    are judged from the computed colours too (strict, no allowance);
//  - a gradient or varying fill: the best end of it must not vouch for the worst, so the contrast is read at the worst
//    15% of the glyph positions, against the real background pixel there and the text's computed colour.

export type ContrastProblem = { text: string; where: string; ratio: number; need: number; size: number; weight: number; how: string };
export type PixelStat = { p90: number; worst: number; flat: boolean; n: number };
export type ContrastResult = { checked: number; unmeasured: string[]; problems: ContrastProblem[] };

const HIDE_TEXT =
  '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;}' +
  // gradient headlines are a background clipped to the glyphs: without the gradient there is nothing to compare, so drop it
  // in the text-less picture (the glyphs are then transparent and the page behind them shows)
  '.gradient-text,[class*="bg-clip-text"]{background:none!important;}';

type Rgba = { r: number; g: number; b: number; a: number };
export type TextBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  where: string;
  size: number;
  weight: number;
  /** the text's colour with every opacity applied, or null when it is clipped to a gradient or transparent */
  fg: Rgba | null;
  /** the contrast the computed colours give, when the background is flat (no gradient or image under the text) */
  computed: number | null;
};

/** Opens a blank page to decode screenshots in. Close it when done. */
export async function newContrastDecoder(page: Page): Promise<Page> {
  const helper = await page.context().newPage();
  await helper.goto('about:blank');
  return helper;
}

/** Every visible piece of text on the page, with its box in page coordinates (the page must be scrolled to the top). */
async function collectText(page: Page, scope?: string): Promise<TextBox[]> {
  return page.evaluate((scopeSelector) => {
    const root = (scopeSelector ? document.querySelector(scopeSelector) : document.body) ?? document.body;
    const out: TextBox[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const pageW = document.documentElement.scrollWidth;
    const pageH = document.documentElement.scrollHeight;

    // any CSS colour (oklab, lab, rgb...) to rgba, by painting it
    const cx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    cx.canvas.width = cx.canvas.height = 1;
    const parse = (css: string): Rgba => {
      cx.clearRect(0, 0, 1, 1);
      cx.fillStyle = '#000';
      cx.fillStyle = css;
      cx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const lin = (c: number) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const lum = (c: { r: number; g: number; b: number }) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const over = (top: Rgba, under: { r: number; g: number; b: number }) => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
    });

    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.nodeValue ?? '').replace(/\s+/g, ' ').trim();
      // a lone punctuation mark, or one thin vertical stem (I, l, i, 1, |), is a few anti-aliased pixels with no fully covered
      // one: the pixel estimate would read low, so these are not judged
      if (!/[\p{L}\p{N}]/u.test(text) || /^[Iil1|!]$/.test(text)) continue;
      const el = n.parentElement;
      if (!el || el.closest('script,style,noscript,title,[disabled],[aria-disabled="true"]')) continue; // inactive controls are exempt (WCAG 1.4.3)
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      let { left, top, right, bottom } = range.getBoundingClientRect();
      // an ancestor that clips (overflow other than visible) hides the part of the text outside it
      for (let a: HTMLElement | null = el; a && a !== document.body; a = a.parentElement) {
        const o = getComputedStyle(a);
        if (o.overflowX !== 'visible' || o.overflowY !== 'visible') {
          const r = a.getBoundingClientRect();
          left = Math.max(left, r.left);
          top = Math.max(top, r.top);
          right = Math.min(right, r.right);
          bottom = Math.min(bottom, r.bottom);
        }
      }
      left = Math.max(0, Math.floor(left));
      top = Math.max(0, Math.floor(top));
      right = Math.min(pageW, Math.ceil(right));
      bottom = Math.min(pageH, Math.ceil(bottom));
      if (right - left < 3 || bottom - top < 3) continue;

      // the text colour as painted (the fill colour, with every opacity on the way up applied) and the flat background under it
      let opacity = 1;
      for (let a: HTMLElement | null = el; a; a = a.parentElement) opacity *= parseFloat(getComputedStyle(a).opacity || '1');
      const fill = parse(cs.webkitTextFillColor || cs.color);
      const fg: Rgba | null = fill.a === 0 || opacity === 0 ? null : { ...fill, a: fill.a * opacity };
      const layers: Rgba[] = [];
      let flat = true;
      for (let a: HTMLElement | null = el; a; a = a.parentElement) {
        const o = getComputedStyle(a);
        if (o.backgroundImage !== 'none') {
          flat = false;
          break;
        }
        const bg = parse(o.backgroundColor);
        if (bg.a > 0) layers.push(bg);
        if (bg.a === 1) break;
      }
      let computed: number | null = null;
      if (fg && flat) {
        const base = layers.reverse().reduce<{ r: number; g: number; b: number }>((under, l) => over(l, under), { r: 255, g: 255, b: 255 });
        const l1 = lum(over(fg, base));
        const l2 = lum(base);
        computed = Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
      }

      const cls = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
      out.push({
        x: left,
        y: top,
        w: right - left,
        h: bottom - top,
        text: text.slice(0, 48),
        where: `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`,
        size: parseFloat(cs.fontSize) || 16,
        weight: parseInt(cs.fontWeight, 10) || 400,
        fg,
        computed,
      });
    }
    return out;
  }, scope ?? null);
}

async function analyse(decoder: Page, shown: Buffer, hidden: Buffer, boxes: TextBox[]) {
  return decoder.evaluate(
    async ([a64, b64, list]) => {
      const load = async (b64s: string) => {
        const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64s)).blob());
        const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(bmp, 0, 0);
        return { ctx, w: bmp.width, h: bmp.height };
      };
      const A = await load(a64 as string);
      const B = await load(b64 as string);
      const table = Array.from({ length: 256 }, (_, i) => {
        const c = i / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      const lum = (r: number, g: number, b: number) => 0.2126 * table[r] + 0.7152 * table[g] + 0.0722 * table[b];
      const ratioOf = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const pct = (arr: number[], q: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * q))];
      const r2 = (n: number) => Math.round(n * 100) / 100;

      return (list as { x: number; y: number; w: number; h: number; fg: { r: number; g: number; b: number; a: number } | null }[]).map((r) => {
        const w = Math.min(r.w, A.w - r.x);
        const h = Math.min(r.h, A.h - r.y);
        if (w < 3 || h < 3) return null;
        const da = A.ctx.getImageData(r.x, r.y, w, h).data;
        const db = B.ctx.getImageData(r.x, r.y, w, h).data;
        const diffs: number[] = [];
        const ratios: number[] = [];
        const bgLum: number[] = [];
        const fromCss: number[] = [];
        let dmax = 0;
        for (let i = 0; i < da.length; i += 4) {
          const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
          if (d === 0) continue;
          const lb = lum(db[i], db[i + 1], db[i + 2]);
          diffs.push(d);
          ratios.push(ratioOf(lum(da[i], da[i + 1], da[i + 2]), lb));
          bgLum.push(lb);
          if (r.fg) {
            // the text's own colour (computed) over the background pixel that is really there
            const a = r.fg.a;
            fromCss.push(ratioOf(lum(Math.round(r.fg.r * a + db[i] * (1 - a)), Math.round(r.fg.g * a + db[i + 1] * (1 - a)), Math.round(r.fg.b * a + db[i + 2] * (1 - a))), lb));
          }
          if (d > dmax) dmax = d;
        }
        if (diffs.length < 4) return null; // no glyph pixels found: the text is transparent, clipped, or behind something
        // flat or varying background under the glyphs
        const flat = Math.max(...bgLum) - Math.min(...bgLum) < 0.06;
        // glyph edges are blends of the text and the background (their contrast is lower than the text's own), so on a flat
        // background the text's contrast is read from the pixels that are nearly fully covered by the glyph
        const core = ratios.filter((_, i) => diffs[i] >= dmax * 0.7).sort((x, y) => x - y);
        const use = core.length >= 2 ? core : ratios.slice().sort((x, y) => x - y);
        // on a varying background the worst glyph positions count: the computed text colour against the real pixel behind it
        // (the pixel estimate would find the text's best end, not its worst)
        // (text clipped to a gradient has no computed colour: its pixels are used, but only the nearly fully covered ones, so a
        // soft shadow around the glyphs, which has far more pixels than the glyphs, cannot decide the reading)
        const worstSet = (fromCss.length ? fromCss : ratios.filter((_, i) => diffs[i] >= dmax * 0.6)).slice().sort((x, y) => x - y);
        return { p90: r2(pct(use, 0.9)), worst: r2(pct(worstSet, 0.15)), flat, n: diffs.length };
      });
    },
    [shown.toString('base64'), hidden.toString('base64'), boxes.map(({ x, y, w, h, fg }) => ({ x, y, w, h, fg }))] as [string, string, { x: number; y: number; w: number; h: number; fg: { r: number; g: number; b: number; a: number } | null }[]],
  );
}

/**
 * Photographs the page with and without text and measures every piece of text: its box, the pixel estimates (null when no
 * glyph pixels could be found: transparent, clipped, covered, or the same colour as its background) and the computed
 * contrast when the background is flat. Put the page in the state to judge first (reduced motion on, settled, scrolled
 * through so in-view content is there); this scrolls to the top itself.
 */
export async function measureText(page: Page, decoder: Page, opts: { scope?: string } = {}) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const boxes = await collectText(page, opts.scope);
  const shown = await page.screenshot({ fullPage: true, animations: 'disabled' });
  const style = await page.addStyleTag({ content: HIDE_TEXT });
  const hidden = await page.screenshot({ fullPage: true, animations: 'disabled' });
  await style.evaluate((el) => (el as Element).remove());
  const stats = (await analyse(decoder, shown, hidden, boxes)) as (PixelStat | null)[];
  return { boxes, stats };
}

/**
 * Returns every piece of text whose contrast is under WCAG AA (4.5 : 1, or 3 : 1 for large text: 24 px, or 18.66 px and
 * bold), and the text that could not be measured at all. `scope` limits it to one container. `tolerance` absorbs the
 * rounding of the measurement.
 */
export async function contrastProblems(page: Page, decoder: Page, opts: { scope?: string; tolerance?: number } = {}): Promise<ContrastResult> {
  const tolerance = opts.tolerance ?? 0.05;
  const { boxes, stats } = await measureText(page, decoder, opts);
  const problems: ContrastProblem[] = [];
  const unmeasured: string[] = [];
  boxes.forEach((b, i) => {
    const j = judge(b, stats[i]);
    if (!j) {
      unmeasured.push(`${b.where} "${b.text}"`);
      return;
    }
    if (j.ratio < j.floor - tolerance) problems.push({ text: b.text, where: b.where, ratio: j.ratio, need: j.need, size: b.size, weight: b.weight, how: j.how });
  });
  return { checked: boxes.length - unmeasured.length, unmeasured, problems };
}

/**
 * The verdict for one piece of text: the contrast to judge it by, how it was read, and the floor it is held to. Null when
 * there is nothing to judge it by (no pixel of its own and a gradient or image behind it).
 */
export function judge(b: TextBox, st: PixelStat | null) {
  const large = b.size >= 24 || (b.size >= 18.66 && b.weight >= 700);
  const need = large ? 3 : 4.5;
  const short = b.text.length <= 2;
  let ratio: number;
  let how: string;
  if (!st) {
    // no glyph pixels: if the computed colours say it cannot be seen either, that is the finding (text the colour of its
    // background); with a gradient or image behind it there is nothing to judge it by
    if (b.computed === null) return null;
    ratio = b.computed;
    how = 'no pixel of its own: computed colours';
  } else if (short && b.computed !== null) {
    // one or two characters have few fully covered pixels; on a flat background the computed colours are exact
    ratio = b.computed;
    how = 'short text: computed colours';
  } else if (!st.flat) {
    ratio = st.worst;
    how = 'varying background: worst glyph positions';
  } else {
    // flat background: the pixel estimate, with a 12% allowance for one or two characters (calibration spec)
    ratio = st.p90;
    how = 'pixels';
  }
  return { ratio, how, need, floor: how === 'pixels' && short ? need * 0.88 : need };
}

/** One line per problem, worst first, for an assertion message. */
export function describe(problems: ContrastProblem[]): string[] {
  return problems
    .slice()
    .sort((a, b) => a.ratio - b.ratio)
    .map((p) => `${p.ratio.toFixed(2)} : 1 (needs ${p.need}) "${p.text}" in ${p.where} (${p.size}px, ${p.weight}; ${p.how})`);
}

/** Reduced motion is on in these tests; scrolling through makes in-view content appear, then back to the top. */
export async function settleAndScrollThrough(page: Page) {
  await page.waitForLoadState('load');
  await page.waitForTimeout(500);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = (page.viewportSize()?.height ?? 800) * 0.8;
  for (let y = 0; y < height; y += step) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}
