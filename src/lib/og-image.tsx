import { GAMES } from "@/lib/games";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 };
export const OG_IMAGE_CONTENT_TYPE = "image/png";

/**
 * Ground-truth sRGB hex pairs for each tool's real on-page gradient
 * (GAMES[].color, e.g. "from-cyan-500 to-blue-500"). Tailwind v4's default
 * palette resolves through oklch()/lab(), which Satori (the renderer behind
 * next/og's ImageResponse) does not parse — so plain hex stops are required
 * here instead of the Tailwind class names. These were not guessed from a
 * memorized "standard palette" table (which would be wrong: Tailwind v4's
 * defaults differ from v3's for several colors) — they were extracted via
 * Playwright reading getComputedStyle() on the real rendered /tools grid,
 * then converted from the browser's reported lab() values to sRGB hex with
 * the `culori` library. See CHANGELOG_AI.md Session 63.
 */
const TOOL_GRADIENT_HEX: Record<string, [string, string]> = {
  "/tools/team-maker": ["#ad46ff", "#f6339a"],
  "/tools/lucky-wheel": ["#00b8db", "#2b7fff"],
  "/tools/name-draw": ["#fe9a00", "#ff6900"],
  "/tools/tournament": ["#00bc7d", "#00bba7"],
  "/tools/coin-flip": ["#f0b100", "#fe9a00"],
  "/tools/dice": ["#fb2c36", "#ff2056"],
  "/tools/guess-number": ["#2b7fff", "#615fff"],
  "/tools/rps": ["#ff6900", "#fb2c36"],
  "/tools/truth-or-dare": ["#f6339a", "#ff2056"],
  "/tools/would-you-rather": ["#615fff", "#ad46ff"],
  "/tools/never-have-i-ever": ["#8e51ff", "#ad46ff"],
  "/tools/trivia": ["#fdc700", "#ff6900"],
  "/tools/bingo": ["#00bba7", "#0092b8"],
  "/tools/word-scramble": ["#7ccf00", "#00a63e"],
};

/**
 * JSX tree for a Spintra OG/social-share image, rendered via Satori (Next's
 * next/og ImageResponse) — a constrained CSS/HTML subset, not a real browser.
 * Deliberately sticks to the reliably-supported subset (flexbox, solid
 * colors, linear-gradient, borderRadius) and avoids anything with uncertain
 * Satori support (blur filters, arbitrary nested SVG icons) so every card
 * renders correctly rather than silently breaking on some subset of them.
 * Shared by every route that needs a share-card image, not just the 14 tools.
 */
export function renderOgImage({
  title,
  desc,
  gradient,
  tagline = "Free · No sign-up · Play instantly",
}: {
  title: string;
  desc: string;
  gradient: [string, string];
  tagline?: string;
}) {
  const [fromHex, toHex] = gradient;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        backgroundImage: `linear-gradient(135deg, ${fromHex}, ${toHex})`,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.92)",
          }}
        />
        <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>
          Spintra
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 78, fontWeight: 800, color: "#ffffff", lineHeight: 1.05 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "rgba(255,255,255,0.9)" }}>
          {desc}
        </div>
      </div>

      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 600,
            color: "#ffffff",
            backgroundColor: "rgba(0,0,0,0.24)",
            borderRadius: 999,
            padding: "12px 28px",
          }}
        >
          {tagline}
        </div>
      </div>
    </div>
  );
}

export function renderToolOgImage(href: string) {
  const game = GAMES.find((g) => g.href === href);
  if (!game) throw new Error(`renderToolOgImage: no GAMES entry with href ${href}`);
  const gradient = TOOL_GRADIENT_HEX[href] ?? (["#6d3ee0", "#3ddaee"] as [string, string]);

  return renderOgImage({ title: game.label, desc: game.desc, gradient });
}
