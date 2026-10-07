/**
 * The CSS entrance classes (`reveal`, in globals.css) for the nth card of a grid: they slide
 * up and fade in, two cards per tenth of a second and half a second in all, so a grid
 * staggers without JavaScript. The first two cards start at once (no delay class).
 */
export function revealStagger(index: number): string {
  const step = Math.min(Math.floor(index / 2), 5);
  return step > 0 ? `reveal reveal-up reveal-delay-${step}` : "reveal reveal-up";
}
