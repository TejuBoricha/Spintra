import { test, expect, type Page } from '@playwright/test';

// The home footer's "endless game table" (src/components/landing/footer-table.tsx): a living scene of game pieces on
// a figure-of-eight track, in the middle of the footer, so that reaching the bottom of the page still feels like
// Spintra is being played. It is decoration, so the checks are about what it must never do: get in the way of the
// footer's links, shift the layout, ignore reduced motion, react to a finger, run while nobody can see it, or hold
// colours a person cannot see in either theme; plus that the cursor easter egg works for a mouse.

const SCENE = '[data-testid="footer-table"]';

async function openHome(page: Page, theme: 'dark' | 'light' = 'dark') {
  await page.addInitScript(([t]) => {
    localStorage.setItem('spintra-theme', t);
    localStorage.setItem('spintra-cookie-consent', 'denied');
  }, [theme]);
  await page.goto('/');
  const scene = page.locator(SCENE);
  await scene.scrollIntoViewIfNeeded();
  await expect(scene).toBeVisible();
  return scene;
}

/** The centre of each piece's sprite, relative to the scene, and the scene's width. */
async function pieceCentres(page: Page) {
  return page.evaluate((sel) => {
    const scene = document.querySelector(sel)!.getBoundingClientRect();
    return {
      width: scene.width,
      centres: Array.from(document.querySelectorAll(`${sel} [data-pull] svg`)).map((s) => {
        const r = s.getBoundingClientRect();
        return { x: r.left + r.width / 2 - scene.left, y: r.top + r.height / 2 - scene.top };
      }),
    };
  }, SCENE);
}

const offset = (page: Page, which: string) =>
  page.locator(`${SCENE} [data-pull="${which}"]`).first().evaluate((el) => {
    const m = getComputedStyle(el).translate.match(/-?[\d.]+/g);
    return m ? Math.hypot(Number(m[0]), Number(m[1] ?? 0)) : 0;
  });

for (const [name, viewport] of [
  ['a desktop', { width: 1280, height: 800 }],
  ['a tablet', { width: 768, height: 1024 }],
  ['a phone', { width: 390, height: 844 }],
] as const) {
  test.describe(`on ${name}`, () => {
    test.use({ viewport });

    test('the scene is decoration: hidden from assistive technology, nothing focusable, no pointer events', async ({ page }) => {
      const scene = await openHome(page);
      await expect(scene).toHaveAttribute('aria-hidden', 'true');
      expect(await scene.evaluate((el) => getComputedStyle(el).pointerEvents), 'it never takes the pointer').toBe('none');
      expect(await scene.evaluate((el) => el.querySelectorAll('a, button, input, select, textarea, [tabindex]').length), 'no tab stops inside it').toBe(0);
    });

    test('every footer link is still the element under its own centre', async ({ page }) => {
      await openHome(page);
      const links = page.locator('footer a');
      expect(await links.count(), 'the seven footer links').toBe(7);
      for (let i = 0; i < 7; i++) {
        const link = links.nth(i);
        await link.scrollIntoViewIfNeeded();
        const hit = await link.evaluate((a) => {
          const r = a.getBoundingClientRect();
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return top === a || a.contains(top);
        });
        expect(hit, `"${(await link.textContent())?.trim()}" is what a click at its centre reaches`).toBe(true);
      }
    });

    test('the scene reserves its height, so nothing around it moves when it appears', async ({ page }) => {
      await page.addInitScript(() => {
        (window as unknown as { __footerShift: number }).__footerShift = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources?: { node?: Node }[] }[]) {
            if (e.hadRecentInput) continue;
            const inFooter = (e.sources ?? []).some((s) => {
              const el = s.node && (s.node.nodeType === 1 ? (s.node as Element) : s.node.parentElement);
              return !!el?.closest('footer');
            });
            if (inFooter) (window as unknown as { __footerShift: number }).__footerShift += e.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      const scene = await openHome(page);
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => (window as unknown as { __footerShift: number }).__footerShift), 'layout shift inside the footer').toBeLessThan(0.001);
      const box = (await scene.boundingBox())!;
      expect(box.width / box.height, 'the scene keeps its 16:5.4 shape').toBeGreaterThan(2.8);
      expect(box.width / box.height).toBeLessThan(3.2);
    });
  });
}

test.describe('motion', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.describe('allowed', () => {
    test.use({ reducedMotion: 'no-preference' });
    test('the pieces move', async ({ page }) => {
      await openHome(page);
      const before = await pieceCentres(page);
      await page.waitForTimeout(900);
      const after = await pieceCentres(page);
      const moved = before.centres.filter((c, i) => Math.hypot(c.x - after.centres[i].x, c.y - after.centres[i].y) > 3).length;
      expect(moved, 'most of the six pieces have moved in under a second').toBeGreaterThanOrEqual(4);
    });
  });

  test.describe('reduced', () => {
    test.use({ reducedMotion: 'reduce' });
    test('the scene is a still composition: every animation is paused, nothing moves, the pieces are spread out', async ({ page }) => {
      await openHome(page);
      await page.waitForTimeout(300);
      const running = await page.evaluate((sel) => {
        const scene = document.querySelector(sel)!;
        return document.getAnimations().filter((a) => a.playState === 'running' && scene.contains((a.effect as KeyframeEffect).target)).length;
      }, SCENE);
      expect(running, 'animations still running inside the scene').toBe(0);
      const a = await pieceCentres(page);
      await page.waitForTimeout(700);
      const b = await pieceCentres(page);
      a.centres.forEach((c, i) => expect(Math.hypot(c.x - b.centres[i].x, c.y - b.centres[i].y), `piece ${i} stays put`).toBeLessThan(0.5));
      // held at a moment where the pieces are well apart, not piled at the start of the loop
      let nearest = Infinity;
      for (let i = 0; i < a.centres.length; i++)
        for (let j = i + 1; j < a.centres.length; j++) nearest = Math.min(nearest, Math.hypot(a.centres[i].x - a.centres[j].x, a.centres[i].y - a.centres[j].y));
      expect(nearest / a.width, 'the two closest pieces, as a share of the scene width').toBeGreaterThan(0.05);
    });
  });

  test('it does no work while it is off screen', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('spintra-cookie-consent', 'denied'));
    await page.goto('/');
    const scene = page.locator(SCENE);
    await expect(scene).toHaveAttribute('data-live', 'false'); // the footer is thousands of pixels down
    await scene.scrollIntoViewIfNeeded();
    await expect(scene).toHaveAttribute('data-live', 'true');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(scene).toHaveAttribute('data-live', 'false');
    const paused = await page.evaluate((sel) => {
      const el = document.querySelector(sel)!;
      return document.getAnimations().filter((a) => el.contains((a.effect as KeyframeEffect).target)).every((a) => a.playState !== 'running');
    }, SCENE);
    expect(paused, 'every animation in the scene is paused while it is off screen').toBe(true);
  });

  test('it costs the page no long tasks, even while the cursor plays with it', async ({ page }) => {
    const scene = await openHome(page);
    await page.evaluate(() => {
      (window as unknown as { __long: number }).__long = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) (window as unknown as { __long: number }).__long += e.duration;
      }).observe({ type: 'longtask' });
    });
    const box = (await scene.boundingBox())!;
    for (let i = 0; i < 40; i++) {
      await page.mouse.move(box.x + (box.width * i) / 40, box.y + box.height / 2 + Math.sin(i / 3) * 40);
      await page.waitForTimeout(40);
    }
    expect(await page.evaluate(() => (window as unknown as { __long: number }).__long), 'milliseconds in long tasks').toBeLessThan(200);
  });
});

test.describe('the cursor easter egg', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('with a mouse, a nearby piece moves away, the track bends, and both settle back when the cursor leaves', async ({ page }) => {
    const scene = await openHome(page);
    const track = page.locator(`${SCENE} [data-track]`);
    const baseTrack = await track.getAttribute('d');
    const before = await offset(page, 'flee');
    expect(before, 'at rest nothing is pushed').toBeLessThan(0.5);
    const { centres } = await pieceCentres(page);
    const box = (await scene.boundingBox())!;
    // right on the first piece (the die)
    await page.mouse.move(box.x + centres[0].x + 6, box.y + centres[0].y + 6);
    await page.waitForTimeout(500);
    expect(await offset(page, 'flee'), 'the die has been pushed away').toBeGreaterThan(5);
    expect(await track.getAttribute('d'), 'the track has bent').not.toBe(baseTrack);
    await page.mouse.move(4, 4);
    await expect.poll(() => offset(page, 'flee'), { message: 'the die settles back', timeout: 4000 }).toBeLessThan(1.5);
    await expect.poll(() => track.getAttribute('d'), { message: 'the track straightens', timeout: 4000 }).toBe(baseTrack);
  });

  test.describe('on a touch device', () => {
    test.use({ hasTouch: true });
    test('nothing reacts: no pushing, no bending', async ({ page }) => {
      const scene = await openHome(page);
      const baseTrack = await page.locator(`${SCENE} [data-track]`).getAttribute('d');
      const { centres } = await pieceCentres(page);
      const box = (await scene.boundingBox())!;
      await page.mouse.move(box.x + centres[0].x, box.y + centres[0].y);
      await page.waitForTimeout(500);
      expect(await offset(page, 'flee')).toBe(0);
      expect(await page.locator(`${SCENE} [data-track]`).getAttribute('d')).toBe(baseTrack);
    });
  });
});

// Colour: the shapes have to be seen on the footer in both themes. A piece is seen by its fill or by an outline
// (the light rim in the dark theme, the ink outline in the light one); WCAG 1.4.11 asks 3:1 for the parts of a
// graphic that are needed to understand it, and the track is what the pieces travel on.
type Rgba = [number, number, number, number];
function parse(color: string): Rgba {
  const c = color.trim();
  if (c === 'transparent') return [0, 0, 0, 0];
  if (c.startsWith('#')) {
    const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const n = (c.match(/[\d.]+/g) ?? []).map(Number);
  return [n[0], n[1], n[2], n[3] ?? 1];
}
function luminance([r, g, b]: number[]) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(fg: Rgba, bg: Rgba) {
  const a = fg[3];
  const blended = [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
  const [hi, lo] = [luminance(blended), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

for (const theme of ['dark', 'light'] as const) {
  test(`${theme} theme: every piece and the track reach 3:1 against the footer`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openHome(page, theme);
    const { tokens, background } = await page.evaluate((sel) => {
      const cs = getComputedStyle(document.querySelector(sel)!);
      const read = (name: string) => cs.getPropertyValue(name).trim();
      return {
        background: getComputedStyle(document.body).backgroundColor,
        tokens: Object.fromEntries(['--ft-lime', '--ft-orange', '--ft-violet', '--ft-cyan', '--ft-paper', '--ft-ink', '--ft-rim', '--ft-track'].map((n) => [n, read(n)])),
      };
    }, SCENE);
    const bg = parse(background);
    const seen = (fill: string) => Math.max(contrast(parse(tokens[fill]), bg), contrast(parse(tokens['--ft-rim']), bg), contrast(parse(tokens['--ft-ink']), bg));
    const pieces: [string, string][] = [
      ['die and spark (lime)', '--ft-lime'],
      ['S chip (orange)', '--ft-orange'],
      ['card (paper)', '--ft-paper'],
      ['pawn (cyan)', '--ft-cyan'],
      ['violet chip', '--ft-violet'],
    ];
    for (const [what, fill] of pieces) expect(seen(fill), `${what} against the ${theme} footer`).toBeGreaterThanOrEqual(3);
    expect(contrast(parse(tokens['--ft-track']), bg), `the track against the ${theme} footer`).toBeGreaterThanOrEqual(3);
  });
}
