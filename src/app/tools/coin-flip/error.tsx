"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/route-error-fallback";

export default function CoinFlipError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("CoinFlip route error:", error);
  }, [error]);

  return (
    <RouteErrorFallback
      reset={reset}
      title="Coin Flip hit a snag"
      description="Something broke loading this tool. Try again in a moment."
    />
  );
}
