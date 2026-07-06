"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function NeverHaveIEverError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("NeverHaveIEver route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback
      reset={reset}
      title="Never Have I Ever hit a snag"
      description="Something broke loading this tool. Try again in a moment."
    />
  );
}
