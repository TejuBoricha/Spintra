"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function RoomRedirectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("RoomRedirect route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback
      reset={reset}
      title="Couldn't load that"
      description="Something broke loading this page. Try again in a moment."
    />
  );
}
