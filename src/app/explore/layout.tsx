import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GAMES } from "@/lib/games";
import { jsonLdScript, SITE_OPEN_GRAPH } from "@/lib/site-metadata";

const BASE_URL = "https://spintra.io";

// The explore page itself is a client component and cannot export metadata.
export const metadata: Metadata = {
  title: "Explore Games & Rooms | Spintra",
  description:
    "See every Spintra game, from wheels and brackets to party games, and find public rooms that are open to join right now.",
  alternates: { canonical: "/explore" },
  openGraph: {
    ...SITE_OPEN_GRAPH,
    title: "Explore Games & Rooms | Spintra",
    description:
      "Explore all Spintra multiplayer games, decision wheels, and tournament brackets, or join active public rooms right now in your browser.",
    url: "/explore",
  },
};

const exploreItemList = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Spintra Multiplayer Games & Activities",
  description:
    "Browse multiplayer party games, group activities, and live public rooms on Spintra.",
  url: `${BASE_URL}/explore`,
  numberOfItems: GAMES.length,
  itemListElement: GAMES.map((game, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: game.label,
    description: game.desc,
    url: `${BASE_URL}${game.type === "city" ? "/spintra-city" : game.href}`,
  })),
};

export default function ExploreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(exploreItemList) }}
      />
      {children}
    </>
  );
}
