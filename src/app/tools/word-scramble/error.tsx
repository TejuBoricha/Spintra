"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function WordScrambleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("WordScramble route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback
      reset={reset}
      title="Word Scramble hit a snag"
      description="Something broke loading this tool. Try again in a moment."
    />
  );
}
