import type { MetadataRoute } from "next";
import { GAMES } from "@/lib/games";

// Must match metadataBase in src/app/layout.tsx.
const BASE_URL = "https://spintra.io";

// When each page's content last changed, for the pages where that is known.
// Search engines use lastmod to decide what to recrawl and learn to ignore a site
// whose dates are not true, so: one date per page (changing one page never claims
// the others changed), a page with no known date has none (an omitted lastmod is
// fine; a made-up one is not), and nothing here is "now" at build time. Change a
// page's date when its content or title changes, not for a head-only change such as
// adding a canonical.
const LAST_MODIFIED: Record<string, string> = {
  "": "2026-10-07", // the sentence saying what Spintra is
  "/legal/terms": "2026-09-26", // the "Effective date" printed on the page
  "/legal/privacy": "2026-09-26",
  // The tool pages' titles were rewritten to lead with what people search for (audit X-5).
  "/tools/team-maker": "2026-10-07",
  "/tools/lucky-wheel": "2026-10-07",
  "/tools/name-draw": "2026-10-07",
  "/tools/tournament": "2026-10-07",
  "/tools/coin-flip": "2026-10-07",
  "/tools/dice": "2026-10-07",
  "/tools/guess-number": "2026-10-07",
  "/tools/rps": "2026-10-07",
  "/tools/truth-or-dare": "2026-10-07",
  "/tools/would-you-rather": "2026-10-07",
  "/tools/never-have-i-ever": "2026-10-07",
  "/tools/trivia": "2026-10-07",
  "/tools/bingo": "2026-10-07",
  "/tools/word-scramble": "2026-10-07",
};

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ["", "/tools", "/explore", "/create", "/for-teachers", "/spintra-city", "/legal/terms", "/legal/privacy"];
  const toolPaths = [...new Set(GAMES.map((g) => g.href))].filter((href) =>
    href.startsWith("/tools/")
  );

  return [...staticPaths, ...toolPaths].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: LAST_MODIFIED[path],
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
