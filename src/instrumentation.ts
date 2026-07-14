import * as Sentry from "@sentry/nextjs";

// Required for the Sentry Next.js SDK to actually load its server/edge
// config on Node.js and Edge runtimes respectively — sentry.server.config.ts
// and sentry.edge.config.ts at the project root do nothing on their own
// without this file importing them here. (Client-side init lives in
// src/instrumentation-client.ts, a separate required file Next.js/Sentry
// auto-detects — the older sentry.client.config.ts convention this
// project originally used doesn't work at all under Turbopack, which
// this project's dev/build always runs with; confirmed via the SDK's own
// webpack.js deprecation warning, and empirically: the DSN never made it
// into the browser bundle until this moved.)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
