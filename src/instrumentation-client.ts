import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Capture 10% of transactions for performance monitoring in production.
    // Adjust this value based on traffic volume.
    tracesSampleRate: 0.1,
    // Capture 100% of sessions that encounter an error.
    replaysOnErrorSampleRate: 1.0,
    // Capture 1% of all sessions for session replay.
    replaysSessionSampleRate: 0.01,
    // Suppress noisy console breadcrumbs in development.
    debug: false,
  });
}
