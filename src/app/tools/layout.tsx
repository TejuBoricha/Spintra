import React from "react";
import Link from "next/link";
import { Info } from "lucide-react";

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="w-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/20 px-4 py-2.5 text-center text-xs sm:text-sm text-amber-200 flex items-center justify-center gap-2">
        <Info className="w-4 h-4 text-amber-400 shrink-0" />
        <span>You are playing solo in Local Demo Mode.</span>
        <Link 
          href="/create" 
          className="underline font-bold text-amber-300 hover:text-amber-100 transition-colors ml-1"
        >
          Create a Multiplayer Room
        </Link>
        <span>to invite friends!</span>
      </div>
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  );
}
