import type { Metadata } from "next";
import { GAMES } from "@/lib/games";

/**
 * Build per-tool <head> metadata from the canonical GAMES registry, so tool
 * pages rank as distinct pages (each was previously invisible to search
 * engines behind the one root title). Tool pages are client components and
 * cannot export metadata themselves — each tool's layout.tsx calls this.
 */
export function toolMetadata(href: string): Metadata {
  const game = GAMES.find((g) => g.href === href);
  if (!game) throw new Error(`toolMetadata: no GAMES entry with href ${href}`);
  const title = `${game.label} — Spintra`;
  return {
    title,
    description: game.featureDescription,
    alternates: { canonical: href },
    openGraph: {
      title,
      description: game.desc,
      url: href,
      type: "website",
    },
  };
}
