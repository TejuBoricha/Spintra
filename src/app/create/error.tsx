"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function CreateError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Create route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback
      reset={reset}
      title="Couldn't load room creation"
      description="Something broke on this page. Try again in a moment."
    />
  );
}
