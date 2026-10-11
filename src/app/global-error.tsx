"use client";

import { useEffect } from "react";
import { GLOBAL_ERROR_CSS } from "./global-error-styles";

// Only fires if the root layout itself throws (e.g. a Providers/font
// failure) — every other route's error.tsx handles a throw inside its own
// page content. Next.js requires this to render its own <html>/<body>,
// since it replaces the root layout entirely; deliberately self-contained
// (no shared components/providers) since those may be exactly what crashed.
//
// That includes the stylesheet: the root layout is what imports globals.css, so none of the
// site's CSS variables exist here. The first version leaned on them (the page background and
// text colours, the brand gradient) and on a fixed white-at-60% paragraph, which left the explanation white on white
// with a light device theme and the heading black on dark grey with a dark one (UX audit U-08).
// The colours (in global-error-styles.ts) are literal and follow the visitor's light or dark setting by themselves.
// They follow the device, not the theme chosen on the site: that choice is in localStorage and reading it
// takes an inline script, which the Content-Security-Policy does not allow (script-src is 'self' only).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Something went wrong | Spintra</title>
        <style>{GLOBAL_ERROR_CSS}</style>
      </head>
      <body>
        <div className="ge-wrap">
          <div className="ge-card">
            <h1>Something went wrong</h1>
            <p>The app hit an unexpected error. Try reloading the page.</p>
            <button className="ge-btn" onClick={reset}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
