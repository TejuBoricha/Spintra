import { test, expect } from '@playwright/test';
import { AX, AY, REST, TRACK_D, TRACK_WIDE_D, curve, toPath } from '../src/components/landing/footer-table-geometry';

// The footer scene's geometry is written out as text (footer-table-geometry.ts) so that the server and every browser
// render the same markup: Math.cos and Math.sin are not guaranteed to agree to the last digit between engines. This
// checks that the written-out values are still the output of the formulas, so changing AX or AY without writing the
// values out again is caught here and not as a track that no longer matches the pieces' lanes.

const numbers = (path: string) => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

function expectClose(actual: number[], expected: number[], what: string) {
  expect(actual.length, `${what}: same number of coordinates`).toBe(expected.length);
  actual.forEach((value, i) => expect(Math.abs(value - expected[i]), `${what}, coordinate ${i}`).toBeLessThanOrEqual(0.011));
}

test('the written-out track is the figure of eight the formula draws', () => {
  expectClose(numbers(TRACK_D), numbers(toPath(curve(AX, AY))), 'the track');
  expectClose(numbers(TRACK_WIDE_D), numbers(toPath(curve(AX + 6, AY + 7, 0.35, 0.7))), 'the wider track');
});

test('the written-out resting positions are where the lanes put each piece 6.3 s into the loop', () => {
  for (const [phase, at] of Object.entries(REST)) {
    const s = 6.3 / 10 + Number(phase);
    expectClose([parseFloat(at.x), parseFloat(at.y)], [-AX * Math.cos(2 * Math.PI * s), AY * Math.sin(4 * Math.PI * s)], `phase ${phase}`);
  }
  expect(Object.keys(REST).length, 'one resting position per piece').toBe(6);
});
