import type { Metadata } from "next";
import { SITE_OPEN_GRAPH } from "@/lib/site-metadata";
import HomeClient from "./home-client";

// The home page itself is a client component (home-client.tsx), which cannot
// export metadata. This server page carries what only the home page should have:
// its own canonical and address (a canonical in the root layout would hand "/" to
// every page that has none of its own), and the markup that says who Spintra is.
// Title and description come from the root layout.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...SITE_OPEN_GRAPH, url: "https://spintra.io" },
};

// WebSite and Organization say who "Spintra" is: the name, its address and its
// logo. The word is also the Latin "spintria" (a Roman token) and search engines
// have no reason to prefer a new site over it until the site states its own name
// clearly (Google reads WebSite.name and alternateName for the site name shown in
// results). Home page only: that is where Google's documentation puts it. There
// are no sameAs links because the site has no official profiles to point to yet;
// add them here when it does.
const entity = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://spintra.io/#website",
      name: "Spintra",
      alternateName: "Spintra.io",
      url: "https://spintra.io",
      description:
        "Free online games and group tools: a wheel spinner, team maker, name picker, tournament brackets, dice, and party games you play together in one room.",
      inLanguage: "en",
      publisher: { "@id": "https://spintra.io/#organization" },
    },
    {
      "@type": "Organization",
      "@id": "https://spintra.io/#organization",
      name: "Spintra",
      url: "https://spintra.io",
      logo: { "@type": "ImageObject", url: "https://spintra.io/icon.png", width: 192, height: 192 },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(entity) }} />
      <HomeClient />
    </>
  );
}
