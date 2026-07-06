"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function PrivacyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Privacy route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback
      reset={reset}
      title="Couldn't load the Privacy Policy"
      description="Something broke loading this page. Try again in a moment."
    />
  );
}
