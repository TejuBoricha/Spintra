import type { MetadataRoute } from "next";
import { GAMES } from "@/lib/games";

// Must match metadataBase in src/app/layout.tsx.
const BASE_URL = "https://spintra.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = ["", "/explore", "/create", "/legal/terms", "/legal/privacy"];
  const toolPaths = [...new Set(GAMES.map((g) => g.href))].filter((href) =>
    href.startsWith("/tools/")
  );

  return [...staticPaths, ...toolPaths].map((path) => ({
    url: `${BASE_URL}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.7,
  }));
}
