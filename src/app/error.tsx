"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function HomeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Home route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback reset={reset} />
  );
}
