import { ImageResponse } from "next/og";
import { renderOgImage, OG_IMAGE_SIZE, OG_IMAGE_CONTENT_TYPE } from "@/lib/og-image";

export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

// Reuses Bingo's already Playwright-verified gradient (src/lib/og-image.tsx)
// rather than guessing a fresh sky-500 hex pair — Tailwind v4's oklch()
// defaults aren't safe to hand-transcribe (see that file's header comment).
export default function Image() {
  return new ImageResponse(
    renderOgImage({
      title: "For Teachers",
      desc: "Free classroom tools — no sign-up, works anywhere",
      gradient: ["#00bba7", "#0092b8"],
    }),
    size
  );
}
