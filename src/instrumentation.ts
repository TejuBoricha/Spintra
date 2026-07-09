import * as Sentry from "@sentry/nextjs";

// Required for the Sentry Next.js SDK to actually load its server/edge
// config on Node.js and Edge runtimes respectively — sentry.server.config.ts
// and sentry.edge.config.ts at the project root do nothing on their own
// without this file importing them here. (Client-side init is handled
// separately: withSentryConfig, in next.config.ts, auto-injects
// sentry.client.config.ts into the browser bundle.)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
