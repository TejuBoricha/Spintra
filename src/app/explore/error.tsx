"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function ExploreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Explore route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback
      reset={reset}
      title="Explore hit a snag"
      description="Something broke loading the live feed. Try again in a moment."
    />
  );
}
