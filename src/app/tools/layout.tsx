import React from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import type { Metadata } from "next";
import { SITE_OPEN_GRAPH } from "@/lib/site-metadata";

// Applies to /tools (the index/browse page) specifically — each individual
// /tools/<name> page overrides this with its own metadata via its own
// nested layout.tsx (see src/lib/tool-metadata.ts), Next.js's normal
// child-wins metadata merging. Previously missing entirely: /tools inherited
// the root layout's homepage title/description verbatim.
export const metadata: Metadata = {
  title: "All Games & Tools | Spintra",
  description:
    "Free quick tools and games: spinner wheel, team maker, name picker, brackets, dice, and trivia. Play solo or open a room with friends.",
  alternates: { canonical: "/tools" },
  openGraph: {
    ...SITE_OPEN_GRAPH,
    title: "All Games & Tools | Spintra",
    description:
      "Free quick tools and games: spinner wheel, team maker, name picker, brackets, dice, and trivia. Play solo or open a room with friends.",
    url: "/tools",
  },
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* One sentence in one element, so it reflows as a sentence on a phone (it was four flex children that wrapped on their own) */}
      <p className="w-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-xs sm:text-sm text-amber-900 dark:text-amber-300">
        <Info className="mr-2 inline-block h-4 w-4 align-[-0.2em] text-amber-700 dark:text-amber-500" />
        Want to play with friends?{" "}
        <Link href="/create" className="underline font-bold text-amber-800 dark:text-amber-500 transition-colors">
          Create a Multiplayer Room
        </Link>{" "}
        to invite them!
      </p>
      <div>
        {children}
      </div>
    </div>
  );
}
