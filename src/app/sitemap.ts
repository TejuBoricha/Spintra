import type { MetadataRoute } from "next";
import { GAMES } from "@/lib/games";

// Must match metadataBase in src/app/layout.tsx.
const BASE_URL = "https://spintra.io";

// When the content of the listed pages last changed. Search engines use this to
// decide what to recrawl, and they stop trusting a date that moves on every
// build, so it is a fixed date: change it when page content or titles change
// (the tool page titles were rewritten on this date, audit X-5).
const CONTENT_UPDATED = "2026-10-07";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ["", "/tools", "/explore", "/create", "/for-teachers", "/spintra-city", "/legal/terms", "/legal/privacy"];
  const toolPaths = [...new Set(GAMES.map((g) => g.href))].filter((href) =>
    href.startsWith("/tools/")
  );

  return [...staticPaths, ...toolPaths].map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: CONTENT_UPDATED,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
