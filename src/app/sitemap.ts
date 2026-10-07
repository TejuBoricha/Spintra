import type { MetadataRoute } from "next";
import { GAMES } from "@/lib/games";

// Must match metadataBase in src/app/layout.tsx.
const BASE_URL = "https://spintra.io";

// When a page's content last changed, for the pages where that is known. Search
// engines use lastmod to decide what to recrawl and learn to ignore a site whose
// dates are not true, so a page with no known date has none (an omitted lastmod is
// fine; a made-up one is not), and the dates are fixed, never "now" at build time.
// Change a date when that page's content or title changes.
const TITLES_AND_HOME_UPDATED = "2026-10-07"; // tool page titles (audit X-5) and the home page sentence
const LEGAL_UPDATED = "2026-09-26"; // the "Effective date" printed on both legal pages

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ["", "/tools", "/explore", "/create", "/for-teachers", "/spintra-city", "/legal/terms", "/legal/privacy"];
  const toolPaths = [...new Set(GAMES.map((g) => g.href))].filter((href) =>
    href.startsWith("/tools/")
  );

  const lastModified = (path: string): string | undefined => {
    if (path === "" || toolPaths.includes(path)) return TITLES_AND_HOME_UPDATED;
    if (path.startsWith("/legal/")) return LEGAL_UPDATED;
    return undefined;
  };

  return [...staticPaths, ...toolPaths].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: lastModified(path),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
