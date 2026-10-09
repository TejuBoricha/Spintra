// The geometry of the footer's game table (footer-table.tsx, footer-table.css). It is plain data, with no JSX, so a
// test can check it: tests/footer-table-geometry.spec.ts.
//
// The track is a figure of eight: x = 50 - AX cos t, y = 50 + AY sin 2t, in percent of the scene box. The paths and
// the resting positions below are the formulas' output, written out: the server renders this markup and every
// browser hydrates it, and Math.cos and Math.sin are not guaranteed to agree to the last digit between JavaScript
// engines, so a value that sat on a rounding boundary could differ and make React report a mismatch.

/** Horizontal and vertical reach of the track, in percent of the scene's width and height. */
export const AX = 33;
export const AY = 28.7; // about 52px at the desktop size, the same track as before the box got taller
export const STEPS = 96;

/** Points of the figure of eight (used in the browser, to bend the track around the cursor). */
export function curve(ax: number, ay: number, turn = 0, tilt = 0): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * Math.PI * 2;
    points.push([50 - ax * Math.cos(t + turn), 50 + ay * Math.sin(2 * t + tilt)]);
  }
  return points;
}

export function toPath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("") + "Z";
}

/** curve(AX, AY) as a path. */
export const TRACK_D =
  "M17.00 50.00L17.07 53.75L17.28 57.43L17.63 60.98L18.12 64.35L18.75 67.47L19.51 70.29L20.40 72.77L21.42 74.85L22.56 76.52L23.82 77.72L25.19 78.45L26.67 78.70L28.24 78.45L29.91 77.72L31.67 76.52L33.50 74.85L35.40 72.77L37.37 70.29L39.39 67.47L41.46 64.35L43.56 60.98L45.69 57.43L47.84 53.75L50.00 50.00L52.16 46.25L54.31 42.57L56.44 39.02L58.54 35.65L60.61 32.53L62.63 29.71L64.60 27.23L66.50 25.15L68.33 23.48L70.09 22.28L71.76 21.55L73.33 21.30L74.81 21.55L76.18 22.28L77.44 23.48L78.58 25.15L79.60 27.23L80.49 29.71L81.25 32.53L81.88 35.65L82.37 39.02L82.72 42.57L82.93 46.25L83.00 50.00L82.93 53.75L82.72 57.43L82.37 60.98L81.88 64.35L81.25 67.47L80.49 70.29L79.60 72.77L78.58 74.85L77.44 76.52L76.18 77.72L74.81 78.45L73.33 78.70L71.76 78.45L70.09 77.72L68.33 76.52L66.50 74.85L64.60 72.77L62.63 70.29L60.61 67.47L58.54 64.35L56.44 60.98L54.31 57.43L52.16 53.75L50.00 50.00L47.84 46.25L45.69 42.57L43.56 39.02L41.46 35.65L39.39 32.53L37.37 29.71L35.40 27.23L33.50 25.15L31.67 23.48L29.91 22.28L28.24 21.55L26.67 21.30L25.19 21.55L23.82 22.28L22.56 23.48L21.42 25.15L20.40 27.23L19.51 29.71L18.75 32.53L18.12 35.65L17.63 39.02L17.28 42.57L17.07 46.25L17.00 50.00Z";

/** The second, wider and tilted track in the far layer: curve(AX + 6, AY + 7, 0.35, 0.7). */
export const TRACK_WIDE_D =
  "M13.36 73.00L14.32 76.37L15.42 79.28L16.68 81.70L18.07 83.57L19.61 84.87L21.27 85.57L23.06 85.66L24.96 85.15L26.97 84.03L29.08 82.33L31.27 80.07L33.55 77.30L35.90 74.07L38.31 70.42L40.77 66.43L43.26 62.15L45.79 57.66L48.34 53.05L50.89 48.38L53.44 43.74L55.97 39.20L58.48 34.85L60.95 30.76L63.37 27.00L65.74 23.63L68.04 20.72L70.26 18.30L72.40 16.43L74.44 15.13L76.37 14.43L78.20 14.34L79.90 14.85L81.47 15.97L82.91 17.67L84.21 19.93L85.36 22.70L86.36 25.93L87.21 29.58L87.89 33.57L88.41 37.85L88.77 42.34L88.96 46.95L88.99 51.62L88.85 56.26L88.54 60.80L88.07 65.15L87.43 69.24L86.64 73.00L85.68 76.37L84.58 79.28L83.32 81.70L81.93 83.57L80.39 84.87L78.73 85.57L76.94 85.66L75.04 85.15L73.03 84.03L70.92 82.33L68.73 80.07L66.45 77.30L64.10 74.07L61.69 70.42L59.23 66.43L56.74 62.15L54.21 57.66L51.66 53.05L49.11 48.38L46.56 43.74L44.03 39.20L41.52 34.85L39.05 30.76L36.63 27.00L34.26 23.63L31.96 20.72L29.74 18.30L27.60 16.43L25.56 15.13L23.63 14.43L21.80 14.34L20.10 14.85L18.53 15.97L17.09 17.67L15.79 19.93L14.64 22.70L13.64 25.93L12.79 29.58L12.11 33.57L11.59 37.85L11.23 42.34L11.04 46.95L11.01 51.62L11.15 56.26L11.46 60.80L11.93 65.15L12.57 69.24L13.36 73.00Z";

/**
 * Where each piece sits 6.3 s into the 10 s loop, keyed by its phase along the track (the still composition under
 * reduced motion): x = -AX cos(2 pi s), y = AY sin(4 pi s) with s = 0.63 + phase.
 */
export const REST: Record<string, { x: string; y: string }> = {
  "0": { x: "22.59%", y: "28.64%" },
  "0.5": { x: "-22.59%", y: "28.64%" },
  "0.125": { x: "-1.04%", y: "-1.80%" },
  "0.375": { x: "-32.98%", y: "1.80%" },
  "0.25": { x: "-24.06%", y: "-28.64%" },
  "0.4375": { x: "-30.08%", y: "21.53%" },
};
