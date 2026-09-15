import { ImageResponse } from "next/og";
import { renderOgImage, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

// Spintra City's real GAMES[] gradient (from-amber-500 to-yellow-500) resolved
// to sRGB hex the same way Session 63 did for the other 14 tool pages —
// Tailwind v4's oklch() defaults aren't safe to hand-transcribe (see
// og-image.tsx's header comment), so these were computed from the installed
// tailwindcss package's own theme.css oklch() values via the standard OKLab
// conversion matrices, then cross-checked against src/lib/og-image.tsx's
// existing Playwright-extracted `/tools/name-draw` (#fe9a00, same amber-500)
// and `/tools/coin-flip` (#f0b100, same yellow-500) entries — exact match.
export default function Image() {
  return new ImageResponse(
    renderOgImage({
      title: "Spintra City",
      desc: "A free Monopoly-style board game — no download, no sign-up",
      gradient: ["#fe9a00", "#f0b100"],
    }),
    size
  );
}
