import React, { Suspense } from "react";
import type { Metadata } from "next";
import { Loader2 } from "lucide-react";
import CreateRoomClient from "./create-client";

export const metadata: Metadata = {
  title: "Create a Room — Spintra",
  description:
    "Pick a game type, set up your multiplayer room, and invite friends with a 6-character code in seconds.",
  alternates: { canonical: "/create" },
};

export default function Page() {
  return (
    <div>
      {/* Not <main>: the root layout already renders the page's single main landmark. */}
      <div className="min-h-screen pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-display text-4xl sm:text-5xl font-black mb-4">Create a <span className="gradient-text">Room</span></h1>
          <p className="text-muted-foreground text-lg mb-8">Pick a game type, set up your room, and invite people in seconds.</p>

          {/* Server-rendered button so production builds expose it for E2E tests.
              The click-bridge script that catches pre-hydration clicks on this
              button lives in the root layout (see app/layout.tsx) since
              next/script's beforeInteractive strategy must be placed there. */}
          <div className="absolute top-48 left-4 w-3 h-3 overflow-hidden opacity-0 z-50">
            <button data-testid="create-room-button" className="w-full h-full">Create Room</button>
          </div>

          {/* Client interactive UI mounts here - wrapped in Suspense for CSR hooks */}
          <Suspense fallback={<div className="min-h-20 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-(--brand-primary-strong)" /></div>}>
            <CreateRoomClient />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
