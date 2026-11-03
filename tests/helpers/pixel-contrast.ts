import type { Page } from '@playwright/test';

// A contrast check that looks at what is painted (WCAG 1.4.3, UX audit finding U-04). axe cannot judge text on gradients and
// translucent layers (it left 1,278 elements "needs review"), so its colour-contrast rule is off in ux-axe.spec.ts and this
// takes its place:
//
//  1. every visible piece of text is found (a rectangle per text node, plus the value or placeholder of an input);
//  2. the page is captured with all text made transparent, so what is left is exactly what sits behind the text, whatever
//     made it (a gradient, a translucent layer, a photo, an opacity on an ancestor);
//  3. the text's own colour (computed style, with its alpha and the opacity of every ancestor) is laid over each background
//     pixel behind it, and the ratio is judged at the 10th percentile, so the worst stretch of a gradient counts.
//
// Reading the glyph pixels instead would be wrong for small text: an anti-aliased edge is a blend of text and background, so
// 12px text read about 25% too low. The one exception is text painted through a gradient (`background-clip: text`), which has
// no single colour: it is read from the glyph pixels, the fully covered ones (and judged at the 10th percentile like the rest).
//
// Not judged: a toast (transient, and it covers other text), a disabled control (WCAG 1.4.3 exempts it), text that is not painted (closed <details>, opacity 0), and the page
// behind an open dialog or full-screen overlay (the backdrop dims it and nobody reads it).

export type ContrastFailure = { text: string; ratio: number; need: number; where: string };

type Item = {
  text: string;
  where: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  weight: number;
  /** The text colour as sRGB plus alpha (0 to 1), already resolved from any colour space the page used. */
  fg: [number, number, number, number];
  /** The product of the opacity of the element and every ancestor. */
  opacity: number;
  /** True when the text is painted through a gradient (`background-clip: text`). */
  gradient: boolean;
};

/** Runs in the page: every visible text rectangle and input text. */
function collectItems(): Item[] {
  const items: Item[] = [];
  const vw = document.documentElement.clientWidth;
  const sx = window.scrollX;
  const sy = window.scrollY;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  const rgba = (css: string): [number, number, number, number] => {
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = '#000';
    g.fillStyle = css; // the canvas resolves oklch(), color-mix() and the rest to sRGB
    g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  // while a dialog or a full-screen overlay is open, the page behind it is dimmed or covered and nobody reads it: judge that only.
  // This assumes a role="dialog" or aria-modal element IS modal, as every dialog on the site is (a non-modal notice must not carry
  // either, or the page behind it would stop being judged).
  const alphaOf = (css: string) => rgba(css)[3];
  const modal =
    Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"]')).find((d) => {
      const r = d.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(d).visibility !== 'hidden';
    }) ||
    Array.from(document.querySelectorAll('body *')).find((el) => {
      const c = getComputedStyle(el);
      if (c.position !== 'fixed' || c.pointerEvents === 'none' || !(parseInt(c.zIndex, 10) >= 40)) return false;
      const r = el.getBoundingClientRect();
      return r.width >= innerWidth * 0.95 && r.height >= innerHeight * 0.95 && alphaOf(c.backgroundColor) >= 0.3;
    });
  const isPainted = (el: Element) => {
    if (modal && !modal.contains(el)) return false;
    if (el.closest('button:disabled, input:disabled, textarea:disabled, select:disabled, fieldset:disabled, [aria-disabled="true"]')) return false;
    const details = el.closest('details');
    if (details && !details.open && !el.closest('summary')) return false;
    let opacity = 1;
    for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      opacity *= parseFloat(cs.opacity);
    }
    return opacity > 0.02;
  };
  const describe = (el: Element) => {
    const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
  };
  // the part of a text rectangle that neither the element nor an ancestor clips away (a truncated name keeps its full width in
  // the range, but only its first part is painted)
  const clipped = (el: Element, rect: { left: number; top: number; right: number; bottom: number }) => {
    let r = rect;
    for (let n: Element | null = el; n && n !== document.documentElement && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (!/(hidden|clip|auto|scroll)/.test(c.overflowX + c.overflowY)) continue;
      const b = n.getBoundingClientRect();
      r = { left: Math.max(r.left, b.left), top: Math.max(r.top, b.top), right: Math.min(r.right, b.right), bottom: Math.min(r.bottom, b.bottom) };
    }
    return r;
  };
  const push = (el: Element, text: string, full: { left: number; top: number; right: number; bottom: number }, placeholder: boolean) => {
    const rect = clipped(el, full);
    const w = rect.right - rect.left;
    const h = rect.bottom - rect.top;
    if (w < 3 || h < 3) return;
    const cs = getComputedStyle(el);
    let fixed = false;
    let opacity = 1;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const o = getComputedStyle(n);
      if (o.position === 'fixed') fixed = true;
      if (n !== document.documentElement) opacity *= parseFloat(o.opacity);
    }
    let gradient = false;
    let k = 0;
    for (let n: Element | null = el; n && k < 4; n = n.parentElement, k++) {
      const o = getComputedStyle(n);
      if ((o.backgroundClip === 'text' || (o as unknown as { webkitBackgroundClip: string }).webkitBackgroundClip === 'text') && o.backgroundImage !== 'none') gradient = true;
    }
    const fill = (cs as unknown as { webkitTextFillColor: string }).webkitTextFillColor;
    const source = placeholder ? getComputedStyle(el, '::placeholder').color : fill && fill !== 'rgba(0, 0, 0, 0)' ? fill : cs.color;
    items.push({
      text: text.trim().replace(/\s+/g, ' ').slice(0, 40),
      where: describe(el),
      x: Math.round(rect.left + (fixed ? 0 : sx)),
      y: Math.round(rect.top + (fixed ? 0 : sy)),
      w: Math.round(w),
      h: Math.round(h),
      fontSize: parseFloat(cs.fontSize),
      weight: parseInt(cs.fontWeight, 10) || 400,
      fg: rgba(source),
      opacity,
      gradient,
    });
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent || '';
    const owner = node.parentElement;
    if (!text.trim() || !owner || !isPainted(owner)) continue;
    if (/^(SCRIPT|STYLE|NOSCRIPT|OPTION)$/.test(owner.tagName)) continue;
    if (/(^|\s)sr-only(\s|$)/.test(owner.getAttribute('class') || '')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width >= 2 && r.height >= 2);
    if (!rects.length) continue;
    const union = {
      left: Math.min(...rects.map((r) => r.left)),
      top: Math.min(...rects.map((r) => r.top)),
      right: Math.max(...rects.map((r) => r.right)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
    };
    if (union.right < 0 || union.left > vw) continue;
    push(owner, text, union, false);
  }
  for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
    if (!isPainted(el) || /^(checkbox|radio|hidden|range|color|file|submit|button)$/.test(el.getAttribute('type') || '')) continue;
    const field = el as HTMLInputElement;
    const text = field.value || field.getAttribute('placeholder') || '';
    if (!text) continue;
    const r = field.getBoundingClientRect();
    const cs = getComputedStyle(field);
    push(
      field,
      text,
      {
        left: r.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth),
        top: r.top + parseFloat(cs.borderTopWidth),
        right: r.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth),
        bottom: r.bottom - parseFloat(cs.borderBottomWidth),
      },
      !field.value,
    );
  }
  return items;
}

/** Runs in the page: decodes the two screenshots and judges every item. */
async function judge(args: { items: Item[]; hidden: string; painted: string | null; page: { dpr: number; height: number } }): Promise<{ fails: ContrastFailure[]; judged: number }> {
  const decode = async (b64: string) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0);
    return { w: bitmap.width, h: bitmap.height, data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
  };
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const B = await decode(args.hidden);
  const A = args.painted ? await decode(args.painted) : null;
  // item rectangles are in CSS pixels and the image must be one capture of the whole page at scale 1: text below a clamped capture
  // (Chromium stops at 16384 px) or under another device scale would be judged against the wrong pixels, or not at all
  if (args.page.dpr !== 1) throw new Error(`the page is rendered at device scale ${args.page.dpr}: this check reads one image pixel per CSS pixel`);
  if (Math.abs(B.h - args.page.height) > 2) throw new Error(`the capture is ${B.h}px tall but the page is ${args.page.height}px: part of the page cannot be judged`);
  const fails: ContrastFailure[] = [];
  let judged = 0;
  for (const it of args.items) {
    const x0 = Math.max(0, it.x);
    const y0 = Math.max(0, it.y);
    const x1 = Math.min(B.w, it.x + it.w);
    const y1 = Math.min(B.h, it.y + it.h);
    if (x1 - x0 < 2 || y1 - y0 < 2) continue;
    const need = it.fontSize >= 24 || (it.fontSize >= 18.66 && it.weight >= 700) ? 3 : 4.5; // "large text", WCAG 1.4.3
    const ratios: number[] = [];
    if (it.gradient) {
      if (!A || A.w !== B.w || A.h !== B.h) throw new Error('the capture with the text and the one without it differ in size: the layout moved between them, so gradient text cannot be judged');
      let max = 0;
      const diffs: [number, number][] = [];
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * B.w + x) * 4;
          const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
          diffs.push([i, d]);
          if (d > max) max = d;
        }
      }
      if (max < 4) {
        // the glyphs are painted in (almost) the very colour behind them: as unreadable as text can be
        judged++;
        fails.push({ text: it.text, ratio: 1, need, where: it.where });
        continue;
      }
      for (const [i, d] of diffs) if (d >= max * 0.9) ratios.push(ratio(lum(A.data[i], A.data[i + 1], A.data[i + 2]), lum(B.data[i], B.data[i + 1], B.data[i + 2])));
      if (ratios.length < 2) continue;
    } else {
      const alpha = it.fg[3] * it.opacity;
      if (alpha < 0.02) continue; // not painted
      const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 600)));
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          const i = (y * B.w + x) * 4;
          const r = B.data[i];
          const g = B.data[i + 1];
          const b = B.data[i + 2];
          ratios.push(ratio(lum(it.fg[0] * alpha + r * (1 - alpha), it.fg[1] * alpha + g * (1 - alpha), it.fg[2] * alpha + b * (1 - alpha)), lum(r, g, b)));
        }
      }
    }
    ratios.sort((a, b) => a - b);
    const got = ratios[Math.floor(ratios.length * 0.1)];
    judged++;
    if (got < need - 0.05) fails.push({ text: it.text, ratio: Math.round(got * 100) / 100, need, where: it.where });
  }
  return { fails, judged };
}

// `color: transparent` also blanks whatever is painted with currentColor (bg-current, border-current, a ring): four places on the site, none
// behind text. Text over such an element would be judged against the page behind it.
const HIDE_TEXT = `
  *, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; -webkit-text-stroke: 0 !important; }
  *::placeholder { color: transparent !important; -webkit-text-fill-color: transparent !important; }
  svg text { fill: transparent !important; }
`;

/**
 * The text on the current page (or state) that does not meet WCAG 1.4.3, as one line each:
 * `3.34:1 (needs 4.5) "Join" in button.group/button.inline-flex`.
 */
export async function contrastProblems(page: Page): Promise<string[]> {
  // a toast is transient and sits over whatever is at the bottom of the screen, so the text under it would be judged against the
  // toast's own background; it is taken out for the duration of the check
  const toasts = await page.addStyleTag({ content: '[data-sonner-toaster] { display: none !important; }' });
  let hideText: Awaited<ReturnType<Page['addStyleTag']>> | null = null;
  try {
    // entrance animations that run when a section scrolls into view must have run, or their text is measured at opacity 0
    await page.evaluate(async () => {
      const height = document.documentElement.scrollHeight;
      for (let y = 0; y < height; y += Math.max(300, innerHeight * 0.7)) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 90));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(400);
    const items = await page.evaluate(collectItems);
    // an entrance or a pulse can be half done when the page is read: take the higher opacity of two reads 350 ms apart
    await page.waitForTimeout(350);
    const again = await page.evaluate(collectItems);
    for (const item of items) {
      const later = again.find((a) => a.text === item.text && a.x === item.x && a.y === item.y);
      if (later && later.opacity > item.opacity) item.opacity = later.opacity;
    }
    const painted = items.some((item) => item.gradient) ? (await page.screenshot({ fullPage: true, animations: 'disabled' })).toString('base64') : null;
    hideText = await page.addStyleTag({ content: HIDE_TEXT });
    // gradient text is painted by the gradient itself: take it away in the image of what sits behind the text
    await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        const cs = getComputedStyle(el);
        if (cs.backgroundClip === 'text' || (cs as unknown as { webkitBackgroundClip: string }).webkitBackgroundClip === 'text') {
          el.setAttribute('data-pixel-contrast-clip', JSON.stringify([el.style.getPropertyValue('background-image'), el.style.getPropertyPriority('background-image')]));
          el.style.setProperty('background-image', 'none', 'important');
        }
      }
    });
    await page.waitForTimeout(80);
    const hidden = (await page.screenshot({ fullPage: true, animations: 'disabled' })).toString('base64');
    const metrics = await page.evaluate(() => ({ dpr: window.devicePixelRatio, height: document.documentElement.scrollHeight }));
    const { fails, judged } = await page.evaluate(judge, { items, hidden, painted, page: metrics });
    // a dialog or overlay that is always on screen would exempt the whole page: the gate must not pass by judging nothing
    if (judged < 3) return [`only ${judged} of ${items.length} pieces of text were judged: the page was not really scanned (an overlay that hides the rest?)`];
    return fails.sort((a, b) => a.ratio - b.ratio).map((f) => `${f.ratio}:1 (needs ${f.need}) "${f.text}" in ${f.where}`);
  } finally {
    // the page is left as it was found, so a later screenshot, a trace or a second scan of the same page sees the real thing
    await hideText?.evaluate((el) => (el as Element).remove()).catch(() => {});
    await page
      .evaluate(() => {
        for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-pixel-contrast-clip]'))) {
          const [before, priority] = JSON.parse(el.getAttribute('data-pixel-contrast-clip') || '["",""]') as [string, string];
          if (before) el.style.setProperty('background-image', before, priority);
          else el.style.removeProperty('background-image');
          el.removeAttribute('data-pixel-contrast-clip');
        }
      })
      .catch(() => {});
    await toasts.evaluate((el) => (el as Element).remove()).catch(() => {});
  }
}
