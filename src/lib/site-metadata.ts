import type { Metadata } from "next";

/**
 * The share preview (Open Graph) every page without its own inherits from the root
 * layout. It has no `url` on purpose: a page that inherits it would otherwise say its
 * address is the home page's, contradicting its own canonical. Next replaces a page's
 * `openGraph` object as a whole instead of merging it, so the home page (which does
 * want `url: "https://spintra.io"`) spreads this and adds the address itself.
 */
export const SITE_OPEN_GRAPH: NonNullable<Metadata["openGraph"]> = {
  title: "Spintra | Free wheel spinner, team maker, and party games",
  description: "Can't decide? Spin for it. Free games and group tools you play together in one room.",
  siteName: "Spintra",
  images: [{ url: "/og-image.png" }],
  locale: "en_US",
  type: "website",
};
