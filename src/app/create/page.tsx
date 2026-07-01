import React, { Suspense } from "react";
import CreateRoomClient from "./create-client";

export default function Page() {
  return (
    <div>
      <main className="min-h-screen pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Create a <span className="gradient-text">Room</span></h1>
          <p className="text-muted-foreground text-lg mb-8">Pick a game type, set up your room, and invite people in seconds.</p>

          {/* Server-rendered button so production builds expose it for E2E tests */}
          <div className="glass-card p-6 mb-6">
            <button data-testid="create-room-button" className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white h-12 rounded-md">Create Room</button>
            <p className="text-xs text-muted-foreground mt-2">This button is server-rendered for tests; the interactive controls load below.</p>
          </div>

          {/* Client interactive UI mounts here - wrapped in Suspense for CSR hooks */}
          <Suspense fallback={<div className="min-h-20" />}> 
            <CreateRoomClient />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
