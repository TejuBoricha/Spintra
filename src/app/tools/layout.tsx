import React from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import type { Metadata } from "next";

// Applies to /tools (the index/browse page) specifically — each individual
// /tools/<name> page overrides this with its own metadata via its own
// nested layout.tsx (see src/lib/tool-metadata.ts), Next.js's normal
// child-wins metadata merging. Previously missing entirely: /tools inherited
// the root layout's homepage title/description verbatim.
export const metadata: Metadata = {
  title: "All Games & Tools — Spintra",
  description:
    "Browse all 14 Spintra tools — spinners, brackets, team makers, dice, trivia, and more. Play solo or turn any of them into a synced multiplayer room.",
  alternates: { canonical: "/tools" },
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="w-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-xs sm:text-sm text-amber-300 flex items-center justify-center gap-2 shrink-0">
        <Info className="w-4 h-4 shrink-0 text-amber-500" />
        <span>Want to play with friends?</span>
        <Link 
          href="/create" 
          className="underline font-bold text-amber-500 transition-colors mx-1"
        >
          Create a Multiplayer Room
        </Link>
        <span>to invite them!</span>
      </div>
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  );
}
