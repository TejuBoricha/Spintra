import { test, expect, type Page } from '@playwright/test';
import { judge, measureText, newContrastDecoder } from './helpers/pixel-contrast';

// The contrast gate (tests/ux-contrast.spec.ts and its two siblings) measures from pixels, so the measurement itself has to
// be right where pixels are hard: small text, lone characters, text the colour of its background, gradient fills and
// dimmed text. This checks the verdict the gate gives (`judge`) on text whose contrast is known: it must not call
// passing text failing, and must not let failing text through. These cases each failed the first version of the gate.

const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

type Cell = { style: string; text: string; size: number; weight: number };

/** Draws the cells in a grid on a blank page and returns each cell's verdict, in order. */
async function verdicts(page: Page, cells: Cell[]) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(
    `<body style="margin:0;background:#808080;font-family:Arial,Helvetica,sans-serif"><div style="display:grid;grid-template-columns:repeat(6,200px);gap:6px;padding:10px">` +
      cells.map((c) => `<div style="${c.style};font-size:${c.size}px;font-weight:${c.weight};padding:8px 10px">${c.text}</div>`).join('') +
      `</div></body>`,
  );
  const decoder = await newContrastDecoder(page);
  const { boxes, stats } = await measureText(page, decoder);
  await decoder.close();
  expect(boxes.length, 'one piece of text per cell').toBe(cells.length);
  return boxes.map((b, i) => ({ box: b, verdict: judge(b, stats[i]) }));
}

const PAIRS: [string, string][] = [
  ['#767676', '#ffffff'], // 4.54: the smallest grey that passes on white
  ['#595959', '#ffffff'], // 7.0
  ['#949494', '#ffffff'], // 3.0
  ['#ffffff', '#2563eb'], // 5.2
  ['#8b8d97', '#16171c'], // 5.4: the muted text token on a dark panel
  ['#ffffff', '#f59e0b'], // 2.1: white on amber, a failing pair of the audit
  ['#5c6b12', '#ebe6d8'], // the light theme's accent text on its sunken surface
];
const STYLES: [number, number][] = [[12, 400], [14, 600], [16, 400], [20, 700]];
const TEXTS = ['Heads or Tails', 'Wins', '6', 'B', 'M', 'Go'];

test('flat backgrounds: the verdict matches the known contrast, small sizes and one or two characters included', async ({ page }) => {
  const cells: (Cell & { expected: number })[] = [];
  for (const [fg, bg] of PAIRS) for (const [size, weight] of STYLES) for (const text of TEXTS) cells.push({ style: `color:${fg};background:${bg}`, text, size, weight, expected: ratio(fg, bg) });
  const out = await verdicts(page, cells);
  const misses: string[] = [];
  out.forEach(({ verdict }, i) => {
    const c = cells[i];
    if (!verdict) { misses.push(`${c.style} ${c.size}px "${c.text}": nothing to judge it by`); return; }
    // words: the pixel estimate within -5% / +3%; one or two characters come from the computed colours: exact
    const [lo, hi] = verdict.how === 'pixels' ? [0.95, 1.03] : [0.99, 1.01];
    if (verdict.ratio < c.expected * lo || verdict.ratio > c.expected * hi) misses.push(`${c.style} ${c.size}px ${c.weight} "${c.text}" (${verdict.how}): expected ${c.expected.toFixed(2)}, read ${verdict.ratio.toFixed(2)}`);
  });
  expect(misses, 'every cell is read within its tolerance of its known contrast').toEqual([]);
});

test('text the colour of its background has no pixel of its own and must still fail', async ({ page }) => {
  const cells: Cell[] = [
    { style: 'color:#ecfdf5;background:#ecfdf5', text: 'Mint on mint', size: 14, weight: 600 }, // the audit's 1.0 : 1
    { style: 'color:#f5f5f5;background:#f4f4f4', text: 'Almost the same grey', size: 16, weight: 400 },
    { style: 'color:#10b981;background:#10b981', text: 'Win', size: 20, weight: 700 },
  ];
  const out = await verdicts(page, cells);
  out.forEach(({ verdict }, i) => {
    expect(verdict, `${cells[i].text}: judged, not skipped`).not.toBeNull();
    expect(verdict!.ratio, `${cells[i].text}: reads as invisible`).toBeLessThan(1.2);
    expect(verdict!.ratio, `${cells[i].text}: fails its floor`).toBeLessThan(verdict!.floor - 0.05);
  });
});

test('a gradient fill is judged by its worst end: the best end cannot vouch for it', async ({ page }) => {
  const cells: (Cell & { fails: boolean })[] = [
    // white on amber at one end (2.1 : 1) and blue at the other: the text starts on the failing end
    { style: 'color:#fff;background:linear-gradient(90deg,#f59e0b,#1d4ed8)', text: 'Flip Coin and more', size: 14, weight: 600, fails: true },
    { style: 'color:#fff;background:linear-gradient(90deg,#fde047,#16a34a)', text: 'Next Question please', size: 14, weight: 600, fails: true },
    { style: 'color:#fff;background:linear-gradient(90deg,#1d4ed8,#7c2d12)', text: 'Passes at both ends', size: 14, weight: 600, fails: false },
    { style: 'color:#111;background:linear-gradient(90deg,#fef3c7,#fde68a)', text: 'Dark on pale gradient', size: 14, weight: 600, fails: false },
    { style: 'color:#fff;background:linear-gradient(90deg,#0e7490,#1d4ed8)', text: 'White on dark teal blue', size: 16, weight: 400, fails: false },
  ];
  const out = await verdicts(page, cells);
  const wrong: string[] = [];
  out.forEach(({ verdict }, i) => {
    const c = cells[i];
    if (!verdict) { wrong.push(`${c.text}: nothing to judge it by`); return; }
    const fails = verdict.ratio < verdict.floor - 0.05;
    if (fails !== c.fails) wrong.push(`${c.text}: expected ${c.fails ? 'a failure' : 'a pass'}, read ${verdict.ratio.toFixed(2)} (${verdict.how})`);
  });
  expect(wrong, 'gradient cells are judged correctly').toEqual([]);
});

test('dimmed text: the contrast after the opacity, for words and for one character', async ({ page }) => {
  // black at 40% over white is #999: 2.85 : 1
  const expected = ratio('#999999', '#ffffff');
  // the opacity is on the text, not on the cell that also holds the white background
  const dim = (t: string) => `<span style="color:#000;opacity:.4">${t}</span>`;
  const cells: Cell[] = [
    { style: 'background:#fff', text: dim('Drop dice in the tray'), size: 14, weight: 600 },
    { style: 'background:#fff', text: dim('6'), size: 14, weight: 600 },
    { style: 'color:#000;background:#fff', text: 'Opaque for comparison', size: 14, weight: 600 },
  ];
  const out = await verdicts(page, cells);
  expect(out[0].verdict!.ratio).toBeGreaterThan(expected * 0.9);
  expect(out[0].verdict!.ratio).toBeLessThan(expected * 1.1);
  expect(out[1].verdict!.ratio).toBeGreaterThan(expected * 0.97);
  expect(out[1].verdict!.ratio).toBeLessThan(expected * 1.03);
  expect(out[2].verdict!.ratio, 'the opaque text passes').toBeGreaterThan(4.5);
});
