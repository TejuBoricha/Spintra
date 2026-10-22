"use client";

import { ErrorState } from "@/components/error-state";
import { Button, ButtonLink } from "@/components/ui/button";

export function RouteErrorFallback({
  reset,
  title = "Something went wrong",
  description = "This page hit an unexpected error. You can try again, or browse the tools.",
  escape = { href: "/tools", label: "Browse tools" },
}: {
  reset: () => void;
  title?: string;
  description?: string;
  /** The second way forward, after "Try again". */
  escape?: { href: string; label: string };
}) {
  return (
    <ErrorState emoji="disappointed_face" title={title} description={description} takeFocus>
      <Button onClick={reset} className="h-11 w-full">
        Try again
      </Button>
      <ButtonLink href={escape.href} variant="outline" className="h-11 w-full">
        {escape.label}
      </ButtonLink>
    </ErrorState>
  );
}
