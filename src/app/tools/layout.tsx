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
  title: "All Games & Tools | Spintra",
  description:
    "All 14 Spintra tools, including the wheel spinner, bracket maker, team maker, dice, and trivia. Use one on your own, or open a room and play it with a group.",
  alternates: { canonical: "/tools" },
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="w-full bg-(--surface-sunken) border-b border-(--border-hairline) px-4 py-2.5 text-center text-xs sm:text-sm text-muted-foreground shrink-0">
        <p className="mx-auto max-w-3xl text-balance">
          <Info className="inline w-4 h-4 -mt-0.5 mr-1.5 text-(--text-accent)" aria-hidden="true" />
          Want to play with friends?{" "}
          <Link href="/create" className="underline font-bold text-(--text-accent) hover:text-foreground transition-colors">
            Create a Multiplayer Room
          </Link>{" "}
          to invite them!
        </p>
      </div>
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  );
}
