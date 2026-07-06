"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function DiceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Dice route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback
      reset={reset}
      title="Dice hit a snag"
      description="Something broke loading this tool. Try again in a moment."
    />
  );
}
