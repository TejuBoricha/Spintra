"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function WouldYouRatherError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("WouldYouRather route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback
      reset={reset}
      title="Would You Rather hit a snag"
      description="Something broke loading this tool. Try again in a moment."
    />
  );
}
