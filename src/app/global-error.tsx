"use client";

import { useEffect } from "react";

// Only fires if the root layout itself throws (e.g. a Providers/font
// failure) — every other route's error.tsx handles a throw inside its own
// page content. Next.js requires this to render its own <html>/<body>,
// since it replaces the root layout entirely; deliberately self-contained
// (no shared components/providers) since those may be exactly what crashed.
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
      <body style={{ margin: 0, background: "var(--background)", color: "var(--foreground)", fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              width: "100%",
              padding: "2rem",
              borderRadius: "1.5rem",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              background: "rgba(255, 255, 255, 0.03)",
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: "1.5rem", fontWeight: 900, margin: "0 0 0.5rem" }}>
              Something went wrong
            </h1>
            <p style={{ color: "rgba(255, 255, 255, 0.6)", fontSize: "0.875rem", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
              The app hit an unexpected error. Try reloading the page.
            </p>
            <button
              onClick={reset}
              style={{
                width: "100%",
                height: "2.75rem",
                borderRadius: "9999px",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                background: "linear-gradient(to right, #a855f7, #6366f1)",
                color: "#fff",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
