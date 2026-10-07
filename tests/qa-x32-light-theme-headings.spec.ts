import { test, expect, type Page } from '@playwright/test';

// Audit X-4: on the light theme the highlighted word in headings (the .gradient-text
// span) was a pale lime gradient on a cream page, about 1.07:1, nearly invisible on
// every tool page. The text now has its own gradient variable with a dark olive
// override on the light theme; the dark theme is unchanged. Measured from the real
// computed colours in the browser, not from the CSS source.

type Rgb = [number, number, number];

const lum = ([r, g, b]: Rgb) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: Rgb, b: Rgb) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

async function headingColours(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((t) => localStorage.setItem('spintra-theme', t), theme);
  await page.goto('/tools/name-draw', { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${theme}\\b`));
  return page.locator('.gradient-text').first().evaluate((el) => {
    const parse = (s: string) => [...s.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number]);
    const stops = parse(getComputedStyle(el).backgroundImage);
    // The colour the text sits on: the first ancestor with a solid background.
    let bg: [number, number, number] | null = null;
    for (let n: Element | null = el; n && !bg; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
      if (m && (m[4] === undefined || Number(m[4]) > 0.9)) bg = [Number(m[1]), Number(m[2]), Number(m[3])];
    }
    return { stops, bg };
  });
}

test('light theme: every colour of the highlighted heading word has at least 4.5:1 contrast on the page', async ({ page }) => {
  const { stops, bg } = await headingColours(page, 'light');
  expect(stops.length, 'the highlight is a gradient with colour stops').toBeGreaterThanOrEqual(2);
  expect(bg, 'found the page background').not.toBeNull();
  for (const stop of stops) {
    const ratio = contrast(stop, bg!);
    expect(ratio, `rgb(${stop.join(',')}) on rgb(${bg!.join(',')}) is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  }
});

test('dark theme: the highlighted heading word keeps its light lime and still reads clearly', async ({ page }) => {
  const { stops, bg } = await headingColours(page, 'dark');
  expect(stops.length).toBeGreaterThanOrEqual(2);
  expect(bg).not.toBeNull();
  for (const stop of stops) expect(contrast(stop, bg!)).toBeGreaterThanOrEqual(4.5);
  // Unchanged: still the bright lime, not the light theme's dark olive.
  expect(Math.max(...stops.map((s) => s[0]))).toBeGreaterThan(200);
});

test('a dark block inside a light page keeps the bright lime, not the light theme\'s olive', async ({ page }) => {
  // No such block exists today; `.dark` used to inherit `.light`'s override of the gradient,
  // which would put dark olive text on a dark surface the day one was added.
  await page.addInitScript(() => localStorage.setItem('spintra-theme', 'light'));
  await page.goto('/tools/name-draw', { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveClass(/\blight\b/);
  const stops = await page.evaluate(() => {
    const box = document.createElement('div');
    box.className = 'dark';
    box.innerHTML = '<span class="gradient-text">Dark block</span>';
    document.body.appendChild(box);
    const image = getComputedStyle(box.firstElementChild!).backgroundImage;
    box.remove();
    return [...image.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)].map((m) => Number(m[1]));
  });
  expect(stops.length, 'the highlight is a gradient with colour stops').toBeGreaterThanOrEqual(2);
  expect(Math.max(...stops), 'red channel of the brightest stop').toBeGreaterThan(200);
});
