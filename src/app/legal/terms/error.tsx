"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function TermsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Terms route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback
      reset={reset}
      title="Couldn't load the Terms"
      description="Something broke loading this page. Try again in a moment."
    />
  );
}
