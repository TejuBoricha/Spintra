"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function RouteErrorFallback({
  reset,
  title = "Something went wrong",
  description = "This page hit an unexpected error. You can try again, or head back to Explore.",
}: {
  reset: () => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="border border-(--border-hairline) bg-(--surface-panel) rounded-2xl max-w-md w-full p-8 rounded-3xl border border-red-500/20 text-center shadow-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground">{title}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        </div>
        <div className="flex flex-col gap-3">
          <Button onClick={reset} className="w-full h-11 font-bold">
            Try again
          </Button>
          <Link
            href="/explore"
            className="w-full h-11 flex items-center justify-center bg-secondary hover:bg-secondary/85 text-secondary-foreground border border-border rounded-lg font-bold transition-colors"
          >
            Back to Explore
          </Link>
        </div>
      </div>
    </div>
  );
}
