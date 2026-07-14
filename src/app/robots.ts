import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Rooms are private, ephemeral, and code-gated; /api has no crawlable content.
      disallow: ["/room/", "/api/"],
    },
    sitemap: "https://spintra.io/sitemap.xml",
  };
}
