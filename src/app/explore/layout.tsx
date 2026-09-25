import type { Metadata } from "next";
import type { ReactNode } from "react";

// The explore page itself is a client component and cannot export metadata.
export const metadata: Metadata = {
  title: "Explore Games & Rooms | Spintra",
  description:
    "See every Spintra game, from wheels and brackets to party games, and find public rooms that are open to join right now.",
  alternates: { canonical: "/explore" },
};

export default function ExploreLayout({ children }: { children: ReactNode }) {
  return children;
}
