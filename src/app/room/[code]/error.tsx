"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function RoomError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Room route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback
      reset={reset}
      title="This room hit a snag"
      description="Something broke loading this room. Try again, or head back to Explore and rejoin with the room code."
    />
  );
}
