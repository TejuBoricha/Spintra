import type { Metadata } from "next";
import type { ReactNode } from "react";

// The explore page itself is a client component and cannot export metadata.
export const metadata: Metadata = {
  title: "Explore Games & Rooms — Spintra",
  description:
    "Browse all Spintra games — wheels, brackets, team makers, party games — and discover trending public rooms to join instantly.",
  alternates: { canonical: "/explore" },
};

export default function ExploreLayout({ children }: { children: ReactNode }) {
  return children;
}
